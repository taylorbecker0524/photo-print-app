'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPricePerPrintCents, getNextTier, MIN_ORDER_QTY, SHIPPING_FLAT_CENTS, formatCents } from '@/lib/pricing'
import { putPreview, putPrint, getPreviews, getPrints, prunePreviews } from '@/lib/photoStore'
import { setWithTTL, getWithTTL, clearStored } from '@/lib/storage'
// Stamp geometry, filters and the print renderer live in one module so the
// preview below and the file Prodigi receives are drawn by the same code.
import {
  FILTERS, getFCss, STAMP_FONTS, getStampFont,
  fmtDate, fmtTime, effectiveCapturedAt, drawStamp, renderForPrint,
  DEFAULT_CROP, printAspect, cropRect, isDefaultCrop, stampArea,
} from '@/lib/printRender'
import type { Filter, StampStyle, StampPos, StampFont, StampConfig, Crop } from '@/lib/printRender'

// `file` is absent on a photo restored after leaving the page: the browser will
// not hand a File back to us. Such a photo can still be shown and re-ordered as
// long as it was uploaded before, which `uploadedPaths` records. `fileName` is
// kept separately because it has to outlive the File.
// `crop` is optional because photos saved before the crop editor existed do not
// have one, and an absent crop means "the centre crop the lab used to do" —
// so an old saved cart renders exactly as it would have before.
type Photo = {width?:number;height?:number; id: string; file?: File; fileName: string; uploadedPaths?: Record<string,string>; url: string; sessionId: string; filter: Filter; stamp: StampConfig; size: string; crop?: Crop }
type OrderItem = { id: string; photoId: string; url: string; fileName: string; filter: Filter; stamp: StampConfig; size: string; crop?: Crop; quantity: number }
type Session = { id: string; name: string; date: Date; photoIds: string[]; isRenaming: boolean }

/** What we write to localStorage so the studio can rebuild itself. */
const SNAPSHOT_KEY = 'archive-studio'
type StudioSnapshot = {
  photos: Array<Omit<Photo,'file'|'url'>>
  sessions: Array<Omit<Session,'isRenaming'|'date'> & { date: string }>
  orderItems: Array<Omit<OrderItem,'url'>>
  finish: 'lustre' | 'gloss' | null
}

const SIZES = [
  { key: '4x6', label: '4x6"' }, { key: '5x7', label: '5x7"' },
  { key: '8x10', label: '8x10"' }, { key: 'square-4', label: '4x4"' },
  { key: 'square-5', label: '5x5"' }, { key: 'square-8', label: '8x8"' },
]
// Per-print price in dollars, from the single source of truth in lib/pricing —
// so the studio always shows exactly what checkout will charge.
// Money stays in whole cents until it is printed, so displayed lines always
// add up to the displayed total.
const fmtSession = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// FIX 4: classic format is now MM DD YYYY (was DD MM YYYY)

/**
 * Smallest pixel dimensions we will print a size at without saying something:
 * the short and long edge at 150 DPI. Above that, softness is theoretical;
 * below it, it is visible in a print you are holding.
 *
 * This drives a warning and never a block. A slightly soft print of a photo
 * from 1998 may be exactly what someone wants, and they know that better than
 * we do. The job here is to make it a choice rather than a surprise that
 * arrives in the post.
 */
const MIN_PRINT_PIXELS:Record<string,{short:number;long:number;label:string}>={
  "4x6":{short:600,long:900,label:"4x6"},
  "5x7":{short:750,long:1050,label:"5x7"},
  "8x10":{short:1200,long:1500,label:"8x10"},
  "square-4":{short:600,long:600,label:"4x4"},
  "square-5":{short:750,long:750,label:"5x5"},
  "square-8":{short:1200,long:1200,label:"8x8"},
}

/**
 * Decode the file to get its true dimensions. We deliberately do not trust the
 * EXIF width/height: a photo that has been through a messaging app often keeps
 * the dimensions it had before it was shrunk, which is precisely the case we
 * are trying to catch.
 *
 * Returns null if the image cannot be decoded (some HEIC files in some
 * browsers). Null means no warning — failing open is right here, because a
 * false alarm costs us a sale and a missed one costs a reprint.
 */
// Longest edge of the on-screen copy we keep for every photo.
//
// The grid used to render the original file straight from a blob URL. A phone
// photo is around twelve megapixels, and the browser decodes it at full size
// however small the thumbnail is drawn — so seventeen photos meant seventeen
// full decodes held at once. iOS Safari responds by throwing them away, which
// is why photos appeared as blank tiles, including one that was already in the
// order. A 1000px copy decodes to about three megabytes instead of fifty, and
// is still sharper than the largest place we display it.
//
// The original File is kept and remains what gets printed. Only the screen copy
// is small; a File is a handle to bytes on disk, not pixels in memory.
const PREVIEW_MAX_EDGE = 1000
const PREVIEW_QUALITY = 0.8

type Prepared = { w?: number; h?: number; url: string; isPreview: boolean; blob?: Blob }

/**
 * Decode a photo once and return both its true pixel dimensions and a small
 * on-screen copy. Doing this in a single decode also halves the work of an
 * import, which used to decode every file twice.
 *
 * Falls back to the original file if anything here fails: a heavier preview is
 * far better than a missing photo.
 */
async function preparePhoto(file:File):Promise<Prepared>{
  const fallback=():Prepared=>({url:URL.createObjectURL(file),isPreview:false})
  let bmp:ImageBitmap
  try{
    if(typeof createImageBitmap!=="function") return await measureOnly(file)
    bmp=await createImageBitmap(file,{imageOrientation:'from-image'} as any)
  }catch{
    try{ bmp=await createImageBitmap(file) }catch{ return await measureOnly(file) }
  }
  const w=bmp.width,h=bmp.height
  try{
    const longest=Math.max(w,h)
    const scale=longest>PREVIEW_MAX_EDGE?PREVIEW_MAX_EDGE/longest:1
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(w*scale))
    canvas.height=Math.max(1,Math.round(h*scale))
    const ctx=canvas.getContext('2d')
    if(!ctx) throw new Error('no 2d context')
    ctx.drawImage(bmp,0,0,canvas.width,canvas.height)
    const blob=await new Promise<Blob|null>(res=>canvas.toBlob(res,'image/jpeg',PREVIEW_QUALITY))
    if(!blob) throw new Error('encode failed')
    return {w,h,url:URL.createObjectURL(blob),isPreview:true,blob}
  }catch{
    // We still measured it, so keep the dimensions even though the small copy failed.
    return {w,h,...fallback()}
  }finally{
    if(typeof (bmp as any).close==="function")(bmp as any).close()
  }
}

/** Last resort for browsers without createImageBitmap: measure, display the original. */
async function measureOnly(file:File):Promise<Prepared>{
  const url=URL.createObjectURL(file)
  try{
    const dims=await new Promise<{w:number;h:number}|null>(resolve=>{
      const img=new Image()
      img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight})
      img.onerror=()=>resolve(null)
      img.src=url
    })
    return {w:dims?.w,h:dims?.h,url,isPreview:false}
  }catch{ return {url,isPreview:false} }
}

// A print crops the photo to the paper's shape before anything is put on paper,
// so the pixels that matter are the ones inside that crop, not the whole frame.
// A near-square photo ordered at 5x7 loses a third of its width; judging it on
// the uncropped file overstates what actually reaches the paper.
function effectivePixels(w:number,h:number,shortIn:number,longIn:number):{short:number;long:number}{
  const photoLong=Math.max(w,h),photoShort=Math.min(w,h)
  const photoAspect=photoLong/photoShort
  const printAspect=longIn/shortIn
  if(photoAspect>printAspect){
    // Photo is longer than the paper: the long edge is trimmed.
    return{short:photoShort,long:Math.round(photoShort*printAspect)}
  }
  // Photo is squarer than the paper: the short edge is trimmed.
  return{short:Math.round(photoLong/printAspect),long:photoLong}
}

/**
 * Zooming in throws pixels away, so the sharpness warning has to see the crop.
 * A 12MP photo cropped to a quarter of its frame is a 3MP photo, and saying
 * nothing until it arrives in the post is exactly the failure we are fixing.
 */
function isTooSmallForPrint(size:string,w?:number,h?:number,crop?:Crop):boolean{
  const need=MIN_PRINT_PIXELS[size]
  if(!need||!w||!h)return false
  const z=crop&&crop.mode==='fill'?Math.max(1,crop.zoom||1):1
  const eff=effectivePixels(w/z,h/z,need.short/150,need.long/150)
  return eff.short<need.short||eff.long<need.long
}
/**
 * Turn a measured photo into the sentence a customer can act on.
 *
 * Naming a size that WOULD be sharp is the part that matters. The big labs
 * tell you there is a problem and leave you to work out the fix; saying
 * "it will look sharp at 4x6" turns a dead end into one click.
 */
function resolutionNote(size:string,w?:number,h?:number,crop?:Crop):string|null{
  if(!w||!h||!isTooSmallForPrint(size,w,h,crop))return null
  const need=MIN_PRINT_PIXELS[size]
  const label=need?need.label:size
  const z=crop&&crop.mode==='fill'?Math.max(1,crop.zoom||1):1
  // Largest first, so we suggest the biggest size that still prints sharp.
  const fits=["8x10","square-8","5x7","square-5","4x6","square-4"].find(k=>!isTooSmallForPrint(k,w,h,crop))
  const base=z>1.02
    ? "Zoomed in this far, only "+Math.round(w/z)+" x "+Math.round(h/z)+" pixels reach the paper - it may print blurry at "+label+"."
    : "Low resolution - this photo is "+w+" x "+h+" and may print blurry at "+label+"."
  return fits?base+" It will look sharp at "+MIN_PRINT_PIXELS[fits].label+".":base
}

function itemResolutionNote(item:OrderItem,all:Photo[]):string|null{
  const ph=all.find(p=>p.id===item.photoId)
  return ph?resolutionNote(item.size,ph.width,ph.height,item.crop):null
}


async function readExif(file: File): Promise<{ date: string | null; lat: number | null; lon: number | null }> {
  try {
    const exifr = (await import('exifr')).default
    const result = await exifr.parse(file, { gps: true, tiff: true, exif: true })
    if (!result) return { date: null, lat: null, lon: null }
    let date: string | null = null
    const raw = result.DateTimeOriginal || result.DateTime || result.CreateDate
    if (raw) {
      try {
        if (raw instanceof Date) date = raw.toISOString()
        else {
          const s = String(raw)
          const [dp, tp] = s.split(' ')
          const [y, m, d] = dp.split(':')
          date = new Date(`${y}-${m}-${d}T${tp||'12:00:00'}`).toISOString()
        }
      } catch {}
    }
    const lat = result.latitude ?? result.GPSLatitude ?? null
    const lon = result.longitude ?? result.GPSLongitude ?? null
    return { date, lat, lon }
  } catch {
    return { date: null, lat: null, lon: null }
  }
}

// Reverse-geocode via our own /api/geocode proxy (server-side), which sets the
// User-Agent Nominatim requires and caches results to stay under the rate limit.
// Calling Nominatim directly from the browser violates their usage policy and
// breaks on bulk uploads.
// Photos from one outing share a location, so a 16-photo import used to fire
// 16 near-identical lookups and wait on every one. Round to ~100m and reuse the
// answer: a batch from a single place now costs one request instead of sixteen.
const geocodeCache=new Map<string,Promise<string>>()

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key=`${lat.toFixed(3)},${lon.toFixed(3)}`
  const hit=geocodeCache.get(key)
  if(hit) return hit
  const req=(async()=>{
    try {
      const r=await fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
      if(!r.ok) return ''
      const d=await r.json()
      return d.location ?? ''
    } catch { return '' }
  })()
  geocodeCache.set(key,req)
  // A failed lookup should not be cached forever — the next photo may succeed.
  req.then(v=>{ if(!v) geocodeCache.delete(key) }).catch(()=>geocodeCache.delete(key))
  return req
}

const DEFAULT_STAMP: StampConfig = {
  showDate:false,showTime:false,showLocation:false,locationText:'',customText:'',
  style:'burn',position:'bl',capturedAt:null,capturedAtOverride:null,
  hasExifDate:false,hasExifLocation:false,
  dateFormat:'classic',stampFont:'classic'
}


const C = {
  card:{background:'#EFE8DF',border:'0.5px solid rgba(43,42,40,0.1)',borderRadius:12,overflow:'hidden'} as React.CSSProperties,
  head:{padding:'10px 16px',borderBottom:'0.5px solid rgba(43,42,40,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between'} as React.CSSProperties,
  mono:{fontFamily:'Courier New, monospace',fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase' as const,color:'#8A6F5A'},
  input:{width:'100%',padding:'10px 12px',fontSize:14,border:'1px solid rgba(43,42,40,0.15)',borderRadius:8,background:'#F7F3EE',color:'#2B2A28',fontFamily:'inherit',outline:'none'} as React.CSSProperties,
  select:{width:'100%',padding:'10px 12px',fontSize:14,border:'1px solid rgba(43,42,40,0.15)',borderRadius:8,background:'#F7F3EE',color:'#2B2A28',fontFamily:'inherit',outline:'none',appearance:'none' as const} as React.CSSProperties,
  togRow:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid rgba(43,42,40,0.06)',gap:16,flexWrap:'nowrap'} as React.CSSProperties,
  accent:{padding:'14px 20px',background:'#D97A43',color:'#F7F3EE',border:'none',borderRadius:10,fontSize:13,letterSpacing:'0.08em',textTransform:'uppercase' as const,fontFamily:'inherit',cursor:'pointer',width:'100%'} as React.CSSProperties,
  ghost:{padding:'8px 14px',background:'transparent',color:'#2B2A28',border:'1px solid rgba(43,42,40,0.2)',borderRadius:8,fontSize:11,letterSpacing:'0.06em',textTransform:'uppercase' as const,fontFamily:'inherit',cursor:'pointer'} as React.CSSProperties,
}

function Toggle({checked,onChange}:{checked:boolean;onChange:()=>void}){
  return <button onClick={onChange} style={{position:'relative',width:44,height:24,borderRadius:24,border:'none',cursor:'pointer',background:checked?'#D97A43':'rgba(43,42,40,0.15)',transition:'background 0.2s',flexShrink:0}}>
    <span style={{position:'absolute',top:3,width:18,height:18,background:'#F7F3EE',borderRadius:'50%',transition:'left 0.2s',left:checked?22:3}}/>
  </button>
}

function StampBullets({stamp,filter}:{stamp:StampConfig;filter:Filter}){
  const items=[]
  const cap = effectiveCapturedAt(stamp)
  if(stamp.showDate&&cap) items.push(fmtDate(cap,stamp.dateFormat??'classic'))
  if(stamp.showTime&&cap) items.push(fmtTime(cap))
  if(stamp.showLocation&&stamp.locationText) items.push(stamp.locationText)
  if(stamp.customText) items.push(stamp.customText)
  if(stamp.style!=='none'){
    items.push(`${stamp.style==='burn'?'Classic burn':'Overlay'} - ${stamp.position==='bl'?'bottom left':stamp.position==='br'?'bottom right':stamp.position==='tl'?'top left':'top right'}`)
  }
  if(filter!=='original') items.push(`${FILTERS.find(f=>f.key===filter)?.label} filter`)
  return (
    <div style={{borderTop:'0.5px solid rgba(43,42,40,0.08)',paddingTop:8,marginBottom:8}}>
      <div style={{fontFamily:'Courier New, monospace',fontSize:10,color:'#8A6F5A',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Stamp details</div>
      {items.length===0?<div style={{fontSize:11,color:'#C4B5A5',fontStyle:'italic'}}>No stamp applied</div>:
        items.map((item,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#8A6F5A',marginBottom:3}}>
            <span style={{color:'#E8841A',fontSize:8}}>●</span>{item}
          </div>
        ))
      }
    </div>
  )
}


/**
 * ADJUST CROP.
 *
 * The bug this exists to kill: we uploaded the whole photo and let Prodigi's
 * `fillPrintArea` decide what to remove. A 3:4 phone photo on a 2:3 print loses
 * 11% of its width, centred, and on a square it loses 25% — which is how a
 * child ended up outside the edge of a print of his own family.
 *
 * So the decision moves in front of the customer. The bright rectangle is the
 * paper. Everything dimmed is gone. Drag the photo, pinch or slide to zoom, or
 * switch to "fit" and keep the whole frame with a border. Whatever is inside
 * that rectangle when they hit save is exactly the file we send, because the
 * export runs the same cropRect() this modal is drawing with.
 */
const MAX_ZOOM = 4
const SCRIM = 'rgba(24,22,20,0.74)'

function CropModal({photo,onClose,onSave}:{
  photo:Photo; onClose:()=>void; onSave:(crop:Crop,size:string)=>void
}){
  const [size,setSize]=useState(photo.size)
  const [crop,setCrop]=useState<Crop>(photo.crop?{...photo.crop}:{...DEFAULT_CROP})
  const [nat,setNat]=useState<{w:number;h:number}|null>(
    photo.width&&photo.height?{w:photo.width,h:photo.height}:null)
  const [stage,setStage]=useState({w:520,h:400})
  const stageRef=useRef<HTMLDivElement>(null)
  const stampRef=useRef<HTMLCanvasElement>(null)
  const dragRef=useRef<null|{x:number;y:number;cx:number;cy:number;scale:number}>(null)
  const pinchRef=useRef<null|{d:number;zoom:number}>(null)
  const ptrs=useRef<Map<number,{x:number;y:number}>>(new Map())

  useEffect(()=>{
    const fit=()=>setStage({
      w:Math.min(560,window.innerWidth-32),
      h:Math.min(430,Math.max(240,window.innerHeight-330)),
    })
    fit();window.addEventListener('resize',fit)
    return()=>window.removeEventListener('resize',fit)
  },[])

  // A photo restored from a previous visit may not have carried its measured
  // dimensions, and every number below depends on them.
  useEffect(()=>{
    if(nat)return
    const i=new Image()
    i.onload=()=>setNat({w:i.naturalWidth,h:i.naturalHeight})
    i.src=photo.url
  },[photo.url,nat])

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[onClose])

  const aspect = nat ? printAspect(size,nat.w,nat.h) : 1
  const fw0 = Math.min(stage.w*0.68, stage.h*0.88*aspect)
  const frameW = Math.max(40,fw0), frameH = Math.max(40,fw0/aspect)
  const frameLeft=(stage.w-frameW)/2, frameTop=(stage.h-frameH)/2

  // The frame never moves; the photo moves behind it. That makes the dimmed
  // area four fixed rectangles instead of a clip path that has to be recomputed
  // on every pointer move.
  const rect = nat ? cropRect(nat.w,nat.h,aspect,crop) : null
  const scale = rect ? frameW/rect.sw : 1
  const dispW = nat ? nat.w*scale : 0
  const dispH = nat ? nat.h*scale : 0
  const imgLeft = rect ? frameLeft - rect.sx*scale : 0
  const imgTop  = rect ? frameTop  - rect.sy*scale : 0
  const fitS = nat ? Math.min(frameW/nat.w,frameH/nat.h) : 1

  const setPan=useCallback((cx:number,cy:number,sw:number,sh:number)=>{
    if(!nat)return
    const hx=(sw/2)/nat.w, hy=(sh/2)/nat.h
    setCrop(c=>({...c,
      cx:Math.min(1-hx,Math.max(hx,cx)),
      cy:Math.min(1-hy,Math.max(hy,cy))}))
  },[nat])

  const setZoom=useCallback((z:number)=>{
    setCrop(c=>({...c,zoom:Math.min(MAX_ZOOM,Math.max(1,z))}))
  },[])

  // Wheel has to be a non-passive native listener: React's synthetic onWheel
  // cannot preventDefault, so the page would scroll away underneath the crop.
  useEffect(()=>{
    const el=stageRef.current
    if(!el)return
    const onWheel=(e:WheelEvent)=>{
      if(crop.mode==='fit')return
      e.preventDefault()
      setZoom(crop.zoom*(1-e.deltaY*0.0016))
    }
    el.addEventListener('wheel',onWheel,{passive:false})
    return()=>el.removeEventListener('wheel',onWheel)
  },[crop.mode,crop.zoom,setZoom])

  // Show the stamp where it will actually land: inside the paper, drawn by the
  // same routine the printer file uses. Seeing it sit safely in the corner is
  // the reassurance that the clipped stamps are over.
  useEffect(()=>{
    const c=stampRef.current
    if(!c)return
    c.width=Math.round(frameW);c.height=Math.round(frameH)
    const ctx=c.getContext('2d')
    if(!ctx||!nat)return
    ctx.clearRect(0,0,c.width,c.height)
    const area=stampArea(crop.mode,c.width,c.height,nat.w,nat.h)
    ctx.save()
    ctx.translate(area.x,area.y)
    drawStamp(ctx,area.w,area.h,photo.stamp)
    ctx.restore()
  },[frameW,frameH,photo.stamp,crop.mode,nat])

  const down=(e:React.PointerEvent)=>{
    if(crop.mode==='fit'||!rect)return
    try{(e.currentTarget as Element).setPointerCapture(e.pointerId)}catch{}
    ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(ptrs.current.size===1){
      dragRef.current={x:e.clientX,y:e.clientY,cx:crop.cx,cy:crop.cy,scale}
    }else if(ptrs.current.size===2){
      const v=Array.from(ptrs.current.values())
      pinchRef.current={d:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y)||1,zoom:crop.zoom}
      dragRef.current=null
    }
  }
  const move=(e:React.PointerEvent)=>{
    if(!ptrs.current.has(e.pointerId)||!nat||!rect)return
    ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(ptrs.current.size>=2&&pinchRef.current){
      const v=Array.from(ptrs.current.values())
      const d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y)||1
      setZoom(pinchRef.current.zoom*(d/pinchRef.current.d))
      return
    }
    const d=dragRef.current
    if(!d)return
    setPan(
      d.cx-(e.clientX-d.x)/(d.scale*nat.w),
      d.cy-(e.clientY-d.y)/(d.scale*nat.h),
      rect.sw,rect.sh)
  }
  const up=(e:React.PointerEvent)=>{
    ptrs.current.delete(e.pointerId)
    if(ptrs.current.size<2)pinchRef.current=null
    if(ptrs.current.size===0)dragRef.current=null
  }

  const warn = nat ? resolutionNote(size,nat.w,nat.h,crop) : null
  const lost = (()=>{
    if(!nat||crop.mode==='fit')return 0
    const r=cropRect(nat.w,nat.h,aspect,{...crop,zoom:1,cx:0.5,cy:0.5})
    return Math.round((1-(r.sw*r.sh)/(nat.w*nat.h))*100)
  })()

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(24,22,20,0.66)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#F7F3EE',borderRadius:14,overflow:'hidden',boxShadow:'0 12px 46px rgba(24,22,20,0.4)',maxWidth:'100%',maxHeight:'100%',overflowY:'auto'}}>

        <div style={{padding:'13px 16px',borderBottom:'1px solid rgba(43,42,40,0.09)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div>
            <div style={{fontFamily:'Georgia, serif',fontSize:17,color:'#2B2A28'}}>Adjust crop</div>
            <div style={{fontSize:11,color:'#8A6F5A',fontStyle:'italic'}}>
              {crop.mode==='fit'?'Nothing is cut - the paper shows at the edges':'The bright area is your print. Drag to move.'}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#8A6F5A',fontSize:20,lineHeight:1,padding:4}}>&times;</button>
        </div>

        <div ref={stageRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{position:'relative',width:stage.w,height:stage.h,background:'#1C1A18',overflow:'hidden',touchAction:'none',userSelect:'none',cursor:crop.mode==='fit'?'default':'grab'}}>
          {nat&&crop.mode==='fit'&&(
            <div style={{position:'absolute',left:frameLeft,top:frameTop,width:frameW,height:frameH,background:'#FFFFFF'}}/>
          )}
          {nat&&(
            <img src={photo.url} alt="" draggable={false} style={crop.mode==='fit'
              ?{position:'absolute',left:frameLeft+(frameW-nat.w*fitS)/2,top:frameTop+(frameH-nat.h*fitS)/2,width:nat.w*fitS,height:nat.h*fitS,maxWidth:'none',display:'block',filter:getFCss(photo.filter)}
              :{position:'absolute',left:imgLeft,top:imgTop,width:dispW,height:dispH,maxWidth:'none',display:'block',filter:getFCss(photo.filter)}}/>
          )}

          <div style={{position:'absolute',left:0,right:0,top:0,height:Math.max(0,frameTop),background:SCRIM,pointerEvents:'none'}}/>
          <div style={{position:'absolute',left:0,right:0,top:frameTop+frameH,bottom:0,background:SCRIM,pointerEvents:'none'}}/>
          <div style={{position:'absolute',left:0,width:Math.max(0,frameLeft),top:frameTop,height:frameH,background:SCRIM,pointerEvents:'none'}}/>
          <div style={{position:'absolute',left:frameLeft+frameW,right:0,top:frameTop,height:frameH,background:SCRIM,pointerEvents:'none'}}/>

          <div style={{position:'absolute',left:frameLeft,top:frameTop,width:frameW,height:frameH,boxShadow:'0 0 0 2px #F7F3EE',pointerEvents:'none'}}>
            <div style={{position:'absolute',left:'33.33%',top:0,bottom:0,width:1,background:'rgba(247,243,238,0.28)'}}/>
            <div style={{position:'absolute',left:'66.66%',top:0,bottom:0,width:1,background:'rgba(247,243,238,0.28)'}}/>
            <div style={{position:'absolute',top:'33.33%',left:0,right:0,height:1,background:'rgba(247,243,238,0.28)'}}/>
            <div style={{position:'absolute',top:'66.66%',left:0,right:0,height:1,background:'rgba(247,243,238,0.28)'}}/>
            <canvas ref={stampRef} style={{position:'absolute',left:0,top:0,width:'100%',height:'100%'}}/>
          </div>

          {!nat&&(
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#C4B5A5',fontSize:12,fontFamily:'Courier New, monospace'}}>Loading photo...</div>
          )}
        </div>

        <div style={{padding:'14px 16px 16px',width:stage.w,maxWidth:'100%'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,opacity:crop.mode==='fit'?0.4:1}}>
            <span style={{...C.mono,width:44,flex:'none'}}>Zoom</span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom}
              disabled={crop.mode==='fit'}
              onChange={e=>setZoom(parseFloat(e.target.value))}
              style={{flex:1,accentColor:'#D97A43',cursor:crop.mode==='fit'?'default':'pointer'}}/>
            <button onClick={()=>setCrop({...DEFAULT_CROP,mode:crop.mode})} disabled={crop.mode==='fit'}
              style={{...C.ghost,padding:'6px 10px',fontSize:10,cursor:crop.mode==='fit'?'default':'pointer'}}>Reset</button>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <span style={{...C.mono,width:44,flex:'none'}}>Size</span>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {SIZES.map(sz=>(
                <button key={sz.key} onClick={()=>setSize(sz.key)}
                  style={{padding:'6px 10px',fontFamily:'Courier New, monospace',fontSize:10.5,borderRadius:6,cursor:'pointer',
                    border:`1px solid ${size===sz.key?'#2B2A28':'rgba(43,42,40,0.18)'}`,
                    background:size===sz.key?'#2B2A28':'#F7F3EE',
                    color:size===sz.key?'#F7F3EE':'#8A6F5A'}}>{sz.label}</button>
              ))}
            </div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:11,borderTop:'1px solid rgba(43,42,40,0.09)'}}>
            <Toggle checked={crop.mode==='fit'} onChange={()=>setCrop(c=>({...c,mode:c.mode==='fit'?'fill':'fit'}))}/>
            <span style={{fontSize:12.5,color:'#8A6F5A',lineHeight:1.4}}>
              Fit the whole photo instead <i>(adds a thin white border)</i>
            </span>
          </div>

          {crop.mode==='fill'&&lost>0&&(
            <p style={{fontSize:11,color:'#8A6F5A',marginTop:9,fontStyle:'italic'}}>
              A {SIZES.find(x=>x.key===size)?.label} is a different shape to this photo, so about {lost}% of it cannot fit. You choose which {lost}%.
            </p>
          )}
          {warn&&(
            <p style={{fontSize:11,color:'#8A3A10',background:'#F6E4D6',borderRadius:7,padding:'8px 10px',marginTop:9,lineHeight:1.45}}>{warn}</p>
          )}

          <div style={{display:'flex',gap:9,marginTop:14}}>
            <button onClick={onClose} style={{...C.ghost,flex:1,padding:'11px',textAlign:'center'}}>Cancel</button>
            <button onClick={()=>onSave(crop,size)} style={{...C.accent,flex:1.6,padding:'11px',width:'auto'}}>Save crop</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StudioPage(){
  const router=useRouter()
  const fileInputRef=useRef<HTMLInputElement>(null)
  const addMoreRef=useRef<HTMLInputElement>(null)
  const [cropPhotoId,setCropPhotoId]=useState<string|null>(null)
  const photoCanvasRef=useRef<HTMLCanvasElement>(null)   // FIX 2/3: photo (filtered) on bottom layer
  const stampCanvasRef=useRef<HTMLCanvasElement>(null)   // FIX 2/3: stamp on top, no filter
  const [photos,setPhotos]=useState<Photo[]>([])
  const [sessions,setSessions]=useState<Session[]>([])
  const [orderItems,setOrderItems]=useState<OrderItem[]>([])
  const [activePhotoId,setActivePhotoId]=useState<string|null>(null)
  const [previewIndex,setPreviewIndex]=useState(0)
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [renameValue,setRenameValue]=useState('')
  const [addedState,setAddedState]=useState(false)
  const [showSessionPrompt,setShowSessionPrompt]=useState(false)
  const [pendingFiles,setPendingFiles]=useState<FileList|null>(null)
  // Reading EXIF and dimensions for a large import takes real time. Without a
  // counter the page looks frozen, so people tap again or back out.
  const [importState,setImportState]=useState<{done:number;total:number}|null>(null)
  // FIX 12: controlled bulk override values — these are the source of truth
  // for bulk text fields. When the selection changes, we re-apply current
  // overrides to any newly-added selected photo via a sync effect.
  const [bulkLocationText,setBulkLocationText]=useState('')
  const [bulkCustomText,setBulkCustomText]=useState('')
  const [bulkDateOverride,setBulkDateOverride]=useState('')  // FIX 13: 'YYYY-MM-DD' or '' for no override
  const [isMobile,setIsMobile]=useState(false)
  // FIX A1 (P0 launch blocker): upload state for the photo-upload-then-checkout flow
  const [uploadState,setUploadState]=useState<{active:boolean;current:number;total:number;error:string}>({active:false,current:0,total:0,error:''})
  // FIX (Finish): order-level required print finish — lustre or gloss
  const [finish,setFinish]=useState<'lustre'|'gloss'|null>(null)

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return ()=>window.removeEventListener('resize',check)},[])

  // FIX 16: load Google Fonts for the three stamp fonts, then trigger a redraw.
  // Without this, the canvas would render with the fallback font on first paint.
  const [fontsReady,setFontsReady]=useState(false)
  useEffect(()=>{
    const id='archive-stamp-fonts'
    if(!document.getElementById(id)){
      const link=document.createElement('link')
      link.id=id; link.rel='stylesheet'
      link.href='https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&family=Special+Elite&display=swap'
      document.head.appendChild(link)
    }
    // Wait for all three fonts to actually be ready, then flip state to force redraw
    if((document as any).fonts?.ready){
      Promise.all([
        (document as any).fonts.load('16px "Share Tech Mono"'),
        (document as any).fonts.load('16px "VT323"'),
        (document as any).fonts.load('16px "Special Elite"'),
      ]).then(()=>setFontsReady(true)).catch(()=>setFontsReady(true))
    } else {
      setFontsReady(true)
    }
  },[])

  useEffect(()=>{
    if(photos.length===0) return
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
    window.addEventListener('beforeunload',warn)
    return ()=>window.removeEventListener('beforeunload',warn)
  },[photos.length])

  // ---------------------------------------------------------------------
  // Surviving a trip to checkout.
  //
  // Leaving this page unmounts it, so an order built over several minutes used
  // to vanish the moment someone tapped the logo — no warning, nothing to come
  // back to. We keep two things: the shape of the order in localStorage, and
  // the preview images in IndexedDB. Between them the studio can rebuild
  // itself. The original files cannot be kept, which is why a photo that was
  // already uploaded carries its storage path: that is what still makes it
  // printable after a reload.
  const restoreStartedRef = useRef(false)
  // Distinct from "restore started". The save effect runs on mount too, and if
  // it were allowed to fire while photos was still empty it would clear the
  // snapshot and prune every stored preview — destroying the order it exists to
  // protect. It stays silent until restore has actually finished.
  const [hydrated,setHydrated] = useState(false)

  useEffect(()=>{
    // restoreStartedRef alone guarantees this runs once, so there is no second
    // run to cancel. There used to be a `cancelled` flag as well, and in
    // development it broke restore outright: React deliberately mounts effects
    // twice, the cleanup set cancelled=true, and the one real run then skipped
    // both setPhotos and setHydrated — leaving a studio that showed the empty
    // upload screen while the saved order sat in storage untouched. Production
    // does not double-mount so it worked there, which is the worst kind of bug:
    // one you can only see in the environment where you are not looking.
    if(restoreStartedRef.current) return
    restoreStartedRef.current = true
    ;(async()=>{
      try{
        const snap = getWithTTL<StudioSnapshot>(SNAPSHOT_KEY)
        if(!snap || !snap.photos?.length) return
        const ids = snap.photos.map(p=>p.id)
        const [previews, prints] = await Promise.all([getPreviews(ids), getPrints(ids)])
        const restored: Photo[] = snap.photos.flatMap(p=>{
          const blob = previews.get(p.id)
          // No preview means nothing to show. Dropping it is better than a blank
          // tile, which is the bug we just spent the morning removing.
          if(!blob) return []
          // The print copy is what makes this photo orderable again. Wrapping it
          // back into a File lets the rest of the studio and checkout treat a
          // restored photo exactly like a freshly picked one, with no special
          // cases anywhere downstream.
          const print = prints.get(p.id)
          const file = print
            ? new File([print], p.fileName || 'photo.jpg', { type: print.type || 'image/jpeg' })
            : undefined
          return [{...p, url: URL.createObjectURL(blob), file}]
        })
        if(restored.length===0) return
        const liveIds = new Set(restored.map(p=>p.id))
        setPhotos(restored)
        setSessions((snap.sessions ?? []).map(sess=>({
          ...sess,
          date: new Date(sess.date),
          photoIds: sess.photoIds.filter(id=>liveIds.has(id)),
          isRenaming: false,
        })).filter(sess=>sess.photoIds.length>0))
        setOrderItems((snap.orderItems ?? [])
          .filter(i=>liveIds.has(i.photoId))
          .map(i=>({...i, url: restored.find(p=>p.id===i.photoId)!.url})))
        if(snap.finish==='lustre'||snap.finish==='gloss') setFinish(snap.finish)
      } finally {
        setHydrated(true)
      }
    })()
  },[])

  // Save after every change. Only metadata goes here — the images live in
  // IndexedDB, and a File cannot be written to either.
  useEffect(()=>{
    if(!hydrated) return
    if(photos.length===0){ clearStored(SNAPSHOT_KEY); void prunePreviews([]); return }
    const snap: StudioSnapshot = {
      photos: photos.map(({file,url,...rest})=>rest),
      sessions: sessions.map(({isRenaming,date,...rest})=>({...rest,date:date.toISOString()})),
      orderItems: orderItems.map(({url,...rest})=>rest),
      finish,
    }
    setWithTTL(SNAPSHOT_KEY, snap)
    void prunePreviews(photos.map(p=>p.id))
  },[hydrated,photos,sessions,orderItems,finish])

  // FIX (Memory leak): revoke blob URLs on unmount so they don't leak.
  // We use a ref to avoid revoking URLs that might still be in use during state updates.
  const photoUrlsRef = useRef<string[]>([])
  useEffect(()=>{
    photoUrlsRef.current = photos.map(p=>p.url)
  },[photos])
  useEffect(()=>{
    return ()=>{
      photoUrlsRef.current.forEach(url=>{
        if(url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
    }
  },[])

  const activePhoto=photos.find(p=>p.id===activePhotoId)
  const selectedPhotos=Array.from(selectedIds).map(id=>photos.find(p=>p.id===id)).filter(Boolean) as Photo[]
  const previewPhoto=selectedPhotos.length>1?selectedPhotos[previewIndex]:activePhoto
  const totalQty=orderItems.reduce((s,i)=>s+i.quantity,0)
  const orderTotalCents=orderItems.reduce((s,i)=>s+getPricePerPrintCents(i.size,totalQty)*i.quantity,0)
  const nextTier = totalQty>0 ? getNextTier(totalQty) : null
  const belowMinimum = totalQty>0 && totalQty < MIN_ORDER_QTY
  // Photos whose real pixel dimensions fall below roughly 150 DPI at the size
  // chosen. Counted from orderItems because that is what actually gets printed,
  // and looked up against photos for the dimensions we measured at upload.
  const softCount=orderItems.filter(i=>{const p=photos.find(ph=>ph.id===i.photoId);return p?isTooSmallForPrint(i.size,p.width,p.height):false}).length
  const isMultiSelect = selectedIds.size > 1


  // FIX 9: Derive bulk control values from the actual state of selected photos.
  // If all selected photos share a value, that value is "selected". If they
  // disagree, return a sentinel 'mixed' so the UI shows no highlight + a hint.
  type Maybe<T> = T | 'mixed' | null
  function sharedValue<T>(items:Photo[], pick:(p:Photo)=>T): Maybe<T> {
    if(items.length===0) return null
    const first=pick(items[0])
    return items.every(p=>pick(p)===first) ? first : 'mixed'
  }
  const bulkSharedFilter = sharedValue(selectedPhotos, p=>p.filter)
  const bulkSharedStyle = sharedValue(selectedPhotos, p=>p.stamp.style)
  const bulkSharedSize = sharedValue(selectedPhotos, p=>p.size)
  const bulkSharedShowDate = sharedValue(selectedPhotos, p=>p.stamp.showDate)
  const bulkSharedShowTime = sharedValue(selectedPhotos, p=>p.stamp.showTime)
  const bulkSharedShowLocation = sharedValue(selectedPhotos, p=>p.stamp.showLocation)
  const bulkSharedDateFormat = sharedValue(selectedPhotos, p=>p.stamp.dateFormat)
  const bulkSharedPosition = sharedValue(selectedPhotos, p=>p.stamp.position)
  const bulkSharedFont = sharedValue(selectedPhotos, p=>p.stamp.stampFont ?? 'classic')

  const processFiles=useCallback(async(files:FileList,sessionId:string)=>{
    const newPhotoIds:string[]=[]
    const imageFiles=Array.from(files).filter(f=>f.type.startsWith('image/'))
    // Process in bounded batches instead of one giant Promise.all. Decoding EXIF
    // for hundreds of full-size photos at once spikes memory and fires hundreds
    // of simultaneous geocode requests; a small concurrency window keeps bulk
    // uploads smooth and rate-limit-friendly.
    const CHUNK_SIZE=6
    const newPhotos:Photo[]=[]
    setImportState({done:0,total:imageFiles.length})
    for(let start=0;start<imageFiles.length;start+=CHUNK_SIZE){
      const batch=imageFiles.slice(start,start+CHUNK_SIZE)
      const processed=await Promise.all(batch.map(async(f)=>{
        const id=Math.random().toString(36).slice(2)
        newPhotoIds.push(id)
        const exif=await readExif(f)
        const prep=await preparePhoto(f)
        let locationText='',hasExifLocation=false
        if(exif.lat!==null&&exif.lon!==null){locationText=await reverseGeocode(exif.lat,exif.lon);hasExifLocation=!!locationText}
        if(prep.blob) void putPreview(id,prep.blob)
        // Make and keep the print-quality copy now, in the background.
        //
        // A preview is all that used to survive a reload, and a preview cannot
        // be printed — so returning to a saved cart produced an order that
        // could be rebuilt but not placed. Doing this at import means the bytes
        // are already there when someone comes back tomorrow. It is the same
        // work checkout would have done, moved earlier, so nothing is wasted.
        //
        // Deliberately not awaited: the grid paints as soon as the preview is
        // ready, exactly as before, and this lands a few seconds later. A
        // reload inside that window falls back to the re-add prompt.
        void (async()=>{
          try{
            const {compressForPrint} = await import('@/lib/compress')
            const out = await compressForPrint(f)
            await putPrint(id, out.blob)
          }catch{
            // Storage full, private mode, a codec that will not decode: none of
            // these should interrupt an import. The re-add prompt covers it.
          }
        })()
        return{width:prep.w,height:prep.h,id,file:f,fileName:f.name,url:prep.url,sessionId,filter:'original' as Filter,
          stamp:{...DEFAULT_STAMP,capturedAt:exif.date,hasExifDate:!!exif.date,hasExifLocation,locationText,showDate:!!exif.date,showLocation:hasExifLocation},size:'4x6',crop:{...DEFAULT_CROP}}
      }))
      newPhotos.push(...processed)
      // Paint each batch as it lands. Holding all of them until the last photo
      // finished is why a 16-photo import showed an empty page for so long.
      setPhotos(prev=>[...prev,...processed])
      setSessions(prev=>prev.map(s=>s.id===sessionId?{...s,photoIds:[...s.photoIds,...processed.map(p=>p.id)]}:s))
      setImportState({done:Math.min(start+CHUNK_SIZE,imageFiles.length),total:imageFiles.length})
    }
    setImportState(null)
    if(newPhotos.length>0) setActivePhotoId(prev=>prev??newPhotos[0].id)
  },[])

  const handleInitialFiles=useCallback(async(files:FileList|null)=>{
    if(!files) return
    if(sessions.length>0){setPendingFiles(files);setShowSessionPrompt(true);return}
    const sessionId=Math.random().toString(36).slice(2)
    setSessions(prev=>[{id:sessionId,name:fmtSession(new Date()),date:new Date(),photoIds:[],isRenaming:false},...prev])
    await processFiles(files,sessionId)
  },[sessions,processFiles])

  const handleSessionChoice=async(choice:'existing'|'new')=>{
    setShowSessionPrompt(false)
    if(!pendingFiles) return
    if(choice==='new'){
      const sessionId=Math.random().toString(36).slice(2)
      setSessions(prev=>[{id:sessionId,name:fmtSession(new Date()),date:new Date(),photoIds:[],isRenaming:false},...prev])
      await processFiles(pendingFiles,sessionId)
    } else {
      await processFiles(pendingFiles,sessions[0].id)
    }
    setPendingFiles(null)
  }

  // FIX 2/3/11: Two-canvas approach. Bottom canvas renders the photo with CSS
  // filter applied (Safari-compatible). Top canvas renders the stamp without
  // filter. Stack them with absolute positioning so the stamp keeps its
  // orange burn color regardless of which filter is applied. The effect now
  // depends on previewPhoto.stamp (not stringified), so changes to the stamp
  // of ANY photo redraw the preview — fixing photos 2+ showing no stamp.
  useEffect(()=>{
    if(!previewPhoto) return
    const photoCanvas=photoCanvasRef.current
    const stampCanvas=stampCanvasRef.current
    if(!photoCanvas||!stampCanvas) return
    const parent=photoCanvas.parentElement
    const maxW=Math.min(parent?.clientWidth??700,700),maxH=420

    // FRONT side
    //
    // Nothing used to cancel an in-flight load when this effect re-ran, so two
    // quick selection changes raced and whichever image finished LAST painted
    // the canvas. A previously previewed photo is warm in cache and resolves
    // almost instantly, so the stale one often won — the preview would sit on
    // the wrong photo until you toggled the selection again. The guard below
    // makes the newest selection always win.
    let cancelled=false
    const img=new Image()
    img.onload=()=>{
      if(cancelled) return
      // The preview is now the PAPER, not the photo. It used to show the whole
      // uploaded image while Prodigi quietly cropped 11% off the sides to make
      // it fit — so the one picture the customer never saw was the one that
      // actually got printed. Same shape, same crop, same renderer as the
      // export: if it is not on this canvas it is not on the print.
      const srcW=img.naturalWidth,srcH=img.naturalHeight
      const crop=previewPhoto.crop??DEFAULT_CROP
      const aspect=printAspect(previewPhoto.size,srcW,srcH)
      let cw=Math.min(maxW,srcW),ch=cw/aspect
      if(ch>maxH){ch=maxH;cw=ch*aspect}
      photoCanvas.width=Math.round(cw);photoCanvas.height=Math.round(ch)
      stampCanvas.width=Math.round(cw);stampCanvas.height=Math.round(ch)

      // Bottom canvas: photo only (CSS filter applied to the canvas element below)
      const pctx=photoCanvas.getContext('2d')!
      pctx.clearRect(0,0,cw,ch)
      if(crop.mode==='fit'){
        pctx.fillStyle='#FFFFFF';pctx.fillRect(0,0,cw,ch)
        const fs=Math.min(cw/srcW,ch/srcH)
        pctx.drawImage(img,0,0,srcW,srcH,(cw-srcW*fs)/2,(ch-srcH*fs)/2,srcW*fs,srcH*fs)
      }else{
        const r=cropRect(srcW,srcH,aspect,crop)
        pctx.drawImage(img,r.sx,r.sy,r.sw,r.sh,0,0,cw,ch)
      }

      // Top canvas: stamp only, no filter
      const sctx=stampCanvas.getContext('2d')!
      sctx.clearRect(0,0,cw,ch)
      const area=stampArea(crop.mode,cw,ch,srcW,srcH)
      sctx.save()
      sctx.translate(area.x,area.y)
      // The exact routine that burns the stamp into the print file. Sharing it
      // is the point: the reason prints came back bare was two renderers, one
      // of which quietly did nothing.
      drawStamp(sctx,area.w,area.h,previewPhoto.stamp)
      sctx.restore()
    }
    img.src=previewPhoto.url
    if(img.complete && img.naturalWidth > 0) img.onload?.(new Event('load') as any)
    return ()=>{ cancelled=true; img.onload=null }
  },[previewPhoto?.id,previewPhoto?.url,previewPhoto?.filter,
     previewPhoto?.stamp.showDate,previewPhoto?.stamp.showTime,previewPhoto?.stamp.showLocation,
     previewPhoto?.stamp.locationText,previewPhoto?.stamp.customText,previewPhoto?.stamp.style,
     previewPhoto?.stamp.position,previewPhoto?.stamp.dateFormat,
     previewPhoto?.stamp.stampFont,previewPhoto?.stamp.capturedAt,previewPhoto?.stamp.capturedAtOverride,
     previewPhoto?.size,previewPhoto?.crop?.mode,previewPhoto?.crop?.zoom,previewPhoto?.crop?.cx,previewPhoto?.crop?.cy,
     previewIndex,fontsReady])

  const updatePhoto=(id:string,u:Partial<Photo>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,...u}:p));setAddedState(false)}
  const updateStamp=(id:string,u:Partial<StampConfig>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,stamp:{...p.stamp,...u}}:p));setAddedState(false)}
  /**
   * A saved crop reaches the cart immediately, unlike a filter or a stamp,
   * which wait to be re-added. That asymmetry is deliberate: someone who opens
   * this modal is fixing a photo that was about to print with a person's head
   * cut off, and leaving the old crop sitting in the basket would ship exactly
   * the print they just came here to prevent.
   */
  const saveCrop=(id:string,crop:Crop,size:string)=>{
    setPhotos(prev=>prev.map(p=>p.id===id?{...p,crop,size}:p))
    setOrderItems(prev=>prev.map(i=>i.photoId===id?{...i,crop}:i))
    setCropPhotoId(null)
  }
  const detectLocation=useCallback(()=>{navigator.geolocation?.getCurrentPosition(async pos=>{const loc=await reverseGeocode(pos.coords.latitude,pos.coords.longitude);if(loc&&activePhotoId)updateStamp(activePhotoId,{locationText:loc,showLocation:true})})},[activePhotoId])

  // FIX 12: Bulk apply helpers now read from current selectedIds at call time
  const applyBulkFilter=(f: Filter)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,filter:f}:p))
  }
  const applyBulkStyle=(s: StampStyle)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,stamp:{...p.stamp,style:s}}:p))
  }
  const applyBulkStamp=(u: Partial<StampConfig>)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,stamp:{...p.stamp,...u}}:p))
    setAddedState(false)
  }
  const applyBulkSize=(size: string)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,size}:p))
    setAddedState(false)
  }
  const detectBulkLocation=()=>{
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const loc=await reverseGeocode(pos.coords.latitude,pos.coords.longitude)
      if(loc){setBulkLocationText(loc); applyBulkStamp({locationText:loc,showLocation:true})}
    })
  }

  // FIX 12/17a: when bulk text/date overrides change (user typed) push to all selected.
  // When selection changes, push current override to newly-added photos.
  // Override is non-destructive — sets capturedAtOverride, preserving original capturedAt.
  const lastBulkSync = useRef<{ids:string[],loc:string,custom:string,dateOverride:string}>({ids:[],loc:'',custom:'',dateOverride:''})
  useEffect(()=>{
    const currentIds = Array.from(selectedIds)
    const lastIds = lastBulkSync.current.ids
    const newlyAdded = currentIds.filter(id=>!lastIds.includes(id))
    if(newlyAdded.length>0){
      setPhotos(prev=>prev.map(p=>{
        if(!newlyAdded.includes(p.id)) return p
        const stampUpdates: Partial<StampConfig> = {}
        if(bulkLocationText) {stampUpdates.locationText=bulkLocationText; stampUpdates.showLocation=true}
        if(bulkCustomText) stampUpdates.customText=bulkCustomText
        if(bulkDateOverride){
          const[y,m,d]=bulkDateOverride.split('-')
          const dt=new Date(+y,+m-1,+d,12,0,0)
          stampUpdates.capturedAtOverride = dt.toISOString()
          stampUpdates.showDate = true
        }
        return Object.keys(stampUpdates).length>0 ? {...p,stamp:{...p.stamp,...stampUpdates}} : p
      }))
    }
    lastBulkSync.current = {ids:currentIds, loc:bulkLocationText, custom:bulkCustomText, dateOverride:bulkDateOverride}
  },[selectedIds, bulkLocationText, bulkCustomText, bulkDateOverride])

  // FIX 9: When user clears selection (drops below 2), reset bulk text overrides
  useEffect(()=>{
    if(selectedIds.size<2){
      setBulkLocationText('')
      setBulkCustomText('')
      setBulkDateOverride('')
      lastBulkSync.current = {ids:[], loc:'', custom:'', dateOverride:''}
    }
  },[selectedIds.size])

  // Unchecking a photo used to leave activePhotoId pointing at it. Drop back to
  // one checked photo and the panel is in single-photo mode, which edits
  // activePhoto — so the next filter landed on the photo just unchecked while
  // the UI showed a different one selected. Keep the edit target inside the
  // selection at all times.
  // Adding or removing one photo from the selection.
  //
  // The preview follows the photo just tapped rather than staying on the first
  // one chosen: tapping a photo and seeing a different one is disorienting, and
  // it is what made the old preview bug so hard to tell apart from a glitch.
  const toggleSelect=(id:string)=>{
    const wasSelected=selectedIds.has(id)
    const next=new Set(selectedIds)
    if(wasSelected) next.delete(id); else next.add(id)
    setSelectedIds(next)
    const remaining=Array.from(next)
    if(wasSelected){
      setPreviewIndex(0)
      setActivePhotoId(remaining.length>0?remaining[remaining.length-1]:null)
    }else{
      setPreviewIndex(Math.max(0,remaining.indexOf(id)))
      setActivePhotoId(id)
    }
    setAddedState(false)
  }

  // Select or clear every photo at once.
  //
  // Lives beside toggleSelect because it has to do the same bookkeeping: the
  // right-hand panel edits activePhoto, so leaving activePhotoId outside the
  // selection is what previously made a filter land on the wrong photo.
  const allSelected = photos.length>0 && selectedIds.size===photos.length
  const toggleSelectAll=()=>{
    if(allSelected){
      setSelectedIds(new Set())
      setActivePhotoId(null)
      setPreviewIndex(0)
      setAddedState(false)
      return
    }
    const ids=photos.map(p=>p.id)
    setSelectedIds(new Set(ids))
    setPreviewIndex(0)
    setActivePhotoId(ids[0] ?? null)
    setAddedState(false)
  }

  // Per-batch select, for when photos arrived in more than one upload. Stamping
  // "Cornwall" onto every photo is the common case for one batch and wrong for
  // two, so a whole-library select is not enough on its own.
  const toggleSelectSession=(photoIds:string[])=>{
    const ids=photos.filter(p=>photoIds.includes(p.id)).map(p=>p.id)
    if(ids.length===0) return
    const everyOneIn=ids.every(id=>selectedIds.has(id))
    const next=new Set(selectedIds)
    for(const id of ids){ if(everyOneIn) next.delete(id); else next.add(id) }
    setSelectedIds(next)
    const remaining=Array.from(next)
    setPreviewIndex(0)
    setActivePhotoId(remaining.length>0?remaining[0]:null)
    setAddedState(false)
  }

  // Re-adding one photo whose print-quality copy did not survive.
  //
  // Browsers clear site storage whenever they like, and a photo imported just
  // before a reload may not have finished its print copy. When that happens the
  // studio still shows the picture but cannot print it. This used to surface as
  // a filename at the checkout button, with no way to act on it — which is no
  // use at all when every file is called "Screenshot 2026-09-22 at 1.35.37 PM".
  // Now the tile itself says so, and this puts the photo back in one tap.
  const reAddRef = useRef<HTMLInputElement|null>(null)
  const reAddTargetRef = useRef<string|null>(null)
  const needsReAdd = (photo:Photo)=> !photo.file && !Object.keys(photo.uploadedPaths ?? {}).length
  const photosNeedingReAdd = photos.filter(needsReAdd)

  const startReAdd=(photoId:string)=>{
    reAddTargetRef.current = photoId
    reAddRef.current?.click()
  }

  const handleReAddFile=async(files:FileList|null)=>{
    const id = reAddTargetRef.current
    reAddTargetRef.current = null
    const f = files?.[0]
    if(!id || !f) return
    if(!f.type.startsWith('image/')) return
    const prep = await preparePhoto(f)
    if(prep.blob) void putPreview(id, prep.blob)
    void (async()=>{
      try{
        const {compressForPrint} = await import('@/lib/compress')
        const out = await compressForPrint(f)
        await putPrint(id, out.blob)
      }catch{ /* the tile stays flagged, which is the honest outcome */ }
    })()
    // Replace the picture as well as the file: someone re-picking a photo may
    // well choose a different one, and showing the old thumbnail against new
    // print data would be a lie about what gets printed.
    setPhotos(prev=>prev.map(p=>p.id===id
      ? {...p, file:f, fileName:f.name, url:prep.url, width:prep.w, height:prep.h, uploadedPaths:undefined}
      : p))
    setOrderItems(prev=>prev.map(i=>i.photoId===id?{...i, url:prep.url, fileName:f.name}:i))
  }

  const addToOrder=(photo:Photo)=>{
    setOrderItems(prev=>{
      const existing=prev.find(i=>i.photoId===photo.id&&i.size===photo.size&&i.filter===photo.filter&&JSON.stringify(i.stamp)===JSON.stringify(photo.stamp)&&JSON.stringify(i.crop??DEFAULT_CROP)===JSON.stringify(photo.crop??DEFAULT_CROP))
      if(existing) return prev.map(i=>i.id===existing.id?{...i,quantity:i.quantity+1}:i)
      return[...prev,{id:Math.random().toString(36).slice(2),photoId:photo.id,url:photo.url,fileName:photo.fileName,filter:photo.filter,stamp:{...photo.stamp},size:photo.size,crop:{...(photo.crop??DEFAULT_CROP)},quantity:1}]
    })
    setAddedState(true)
  }

  const updateOrderQty=(itemId:string,delta:number)=>setOrderItems(prev=>prev.map(i=>i.id===itemId?{...i,quantity:Math.max(0,i.quantity+delta)}:i).filter(i=>i.quantity>0))
  const photoInOrder=(photoId:string)=>orderItems.filter(i=>i.photoId===photoId).reduce((s,i)=>s+i.quantity,0)
  // FIX A1 (P0 launch blocker): compress + upload each unique photo to Supabase,
  // then write the real storage paths into the cart before navigating to checkout.
  // Without this, photoPath was a placeholder string and Prodigi got `url: undefined`.
  const goToCheckout=async()=>{
    if(uploadState.active) return
    // Minimum order: fixed shipping and card fees make smaller orders lose money.
    if(totalQty < MIN_ORDER_QTY){
      setUploadState({active:false,current:0,total:0,error:`Orders start at ${MIN_ORDER_QTY} prints — please add ${MIN_ORDER_QTY - totalQty} more.`})
      return
    }
    // FIX (Finish): require finish before checkout
    if(!finish){
      setUploadState({active:false,current:0,total:0,error:'Please choose a print finish (lustre or gloss) before continuing'})
      return
    }
    // What gets uploaded is now the RENDERED photo — filter applied, stamp
    // burned in — so two cart entries of the same photo with different stamps
    // are two different files. The dedupe key has to say so: keying on photoId
    // alone would print one of them twice and silently drop the other.
    // Size and crop belong in the key now that the render produces a file cut to
    // the exact shape of the paper: the same photo at 4x6 and at 4x4 is two
    // different pictures, and leaving them out would print one of them twice.
    const renderKey = (i: OrderItem) =>
      `${i.photoId}|${i.filter}|${i.size}|${JSON.stringify(i.crop??DEFAULT_CROP)}|${JSON.stringify(i.stamp)}`
    const uniqueRenders = Array.from(
      new Map(orderItems.map(i=>[renderKey(i), i])).entries()
    )
    setUploadState({active:true,current:0,total:uniqueRenders.length,error:''})

    // Render + upload each distinct version, mapping render key → supabase path
    const pathMap: Record<string,string> = {}
    try {
      const {uploadCompressed} = await import('@/lib/compress')
      for(let i=0; i<uniqueRenders.length; i++){
        const [key, item] = uniqueRenders[i]
        const photo = photos.find(p=>p.id===item.photoId)
        if(!photo) throw new Error(`Photo ${item.photoId} not found in state`)
        // Already uploaded on an earlier run at this cart — reuse it. This is
        // what lets someone return from checkout, change their mind about a
        // size, and check out again without sending every photo a second time.
        // Cached per render key, so changing a stamp and coming back re-renders
        // rather than silently reusing the old picture.
        const cached = photo.uploadedPaths?.[key]
        if(cached){
          pathMap[key] = cached
          setUploadState(s=>({...s,current:i+1}))
          continue
        }
        // Restored from a previous visit but never uploaded: we hold a preview
        // of it, which is nowhere near print quality. Say which photo, so the
        // fix is obvious rather than a puzzle.
        if(!photo.file){
          // A backstop. The tile is flagged and there is a banner at the top of
          // the studio, so reaching here means both were ignored — say where to
          // look rather than naming a file the customer cannot pick out of a
          // grid of identically named screenshots.
          throw new Error(`One of your photos needs adding again before it can be printed. Scroll up — it is marked "Needs re-adding" with a button to fix it.`)
        }
        // THE fix. This used to be compressForPrint(photo.file), which redrew
        // the untouched original onto a blank canvas: the date stamp and the
        // filter existed only in the preview and never reached the printer.
        // Rendering here means the file Prodigi receives is the picture the
        // customer was looking at.
        const rendered = await renderForPrint(photo.file, item.filter, item.stamp, item.size, item.crop)
        const path = await uploadCompressed(rendered.blob, photo.fileName)
        pathMap[key] = path
        // Remember it, so a return trip to the studio does not re-upload.
        setPhotos(prev=>prev.map(p=>p.id===photo.id
          ? {...p, uploadedPaths:{...(p.uploadedPaths ?? {}), [key]:path}}
          : p))
        setUploadState(s=>({...s,current:i+1}))
      }
    } catch(err:any) {
      setUploadState({active:false,current:0,total:0,error: err?.message ?? 'Upload failed. Please try again.'})
      return
    }

    // Build the cart payload with real supabase paths
    const cart = orderItems.map(i=>({
      size:i.size,
      quantity:i.quantity,
      stamp:i.stamp,
      filter:i.filter,
      fileName:i.fileName,
      photoPath: pathMap[renderKey(i)],
    }))
    // FIX (Cart persistence): localStorage with 7-day TTL so abandoned carts survive
    const {setWithTTL} = await import('@/lib/storage')
    setWithTTL('print-cart', cart)
    setWithTTL('print-finish', finish)
    setUploadState({active:false,current:0,total:0,error:''})
    router.push('/checkout')
  }

  // FIX 2: CSS filter only on the photo canvas (bottom layer). Stamp canvas (top) stays unfiltered.
  const canvasCssFilter = previewPhoto ? getFCss(previewPhoto.filter) : 'none'

  if(photos.length===0) return(
    <div style={{maxWidth:680,margin:'0 auto',padding:'40px 20px'}}>
      <h1 style={{fontFamily:'Georgia, serif',fontSize:32,fontWeight:400,color:'#2B2A28',marginBottom:6,textAlign:'center'}}>Upload your photos</h1>
      <p style={{textAlign:'center',fontSize:14,color:'#8A6F5A',marginBottom:8}}>Drop as many as you like - choose which ones to print after</p>
      <p style={{textAlign:'center',fontSize:12,color:'#8A6F5A',marginBottom:20,fontFamily:'Courier New, monospace'}}>We will automatically read the date and location from your photos</p>
      <div style={{background:'#EFE8DF',borderRadius:10,padding:'14px 16px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <p style={{fontSize:13,color:'#8A6F5A',fontStyle:'italic'}}>Create a free archive to save your photos and easily track orders</p>
        <a href="/login" style={{fontFamily:'Courier New, monospace',fontSize:10,color:'#D97A43',textDecoration:'none',letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Sign in</a>
      </div>
      {/* Most photos that arrive via text or social media have been recompressed,
          which strips the date and GPS we stamp with. Say so before they upload,
          rather than letting them discover it on a printed photo. */}
      <p style={{ fontSize: 12, color: '#8A6F5A', lineHeight: 1.5, margin: '0 0 10px' }}>Photos sent by text or downloaded from social media usually lose their date and location. For the best results, upload the original from your photo library.</p>
      <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleInitialFiles(e.dataTransfer.files)}} onClick={()=>fileInputRef.current?.click()}
        style={{border:'1.5px dashed rgba(43,42,40,0.2)',borderRadius:20,background:'#EFE8DF',padding:'56px 24px',textAlign:'center',cursor:'pointer'}}>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>handleInitialFiles(e.target.files)}/>
        <div style={{width:60,height:60,borderRadius:'50%',background:'#F7F3EE',border:'1px solid rgba(43,42,40,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8A6F5A" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
        </div>
        <p style={{fontFamily:'Georgia, serif',fontSize:24,color:'#2B2A28',marginBottom:8}}>Drop your photos here</p>
        <p style={{fontSize:14,color:'#8A6F5A'}}>or <span style={{color:'#D97A43',textDecoration:'underline'}}>browse your camera roll</span></p>
      </div>
    </div>
  )

  return(
    <div style={{maxWidth:1100,margin:'0 auto',padding:'20px 16px 100px',width:'100%'}}>
      {showSessionPrompt&&(
        <div style={{position:'fixed',inset:0,background:'rgba(43,42,40,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#F7F3EE',borderRadius:16,padding:'28px 32px',maxWidth:400,width:'90%',textAlign:'center'}}>
            <h3 style={{fontFamily:'Georgia, serif',fontSize:22,fontWeight:400,color:'#2B2A28',marginBottom:8}}>Add photos to...</h3>
            <p style={{fontSize:13,color:'#8A6F5A',marginBottom:20}}>Would you like to add these photos to your existing session or start a new one?</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>handleSessionChoice('existing')} style={{...C.accent,flex:1,padding:'12px'}}>Existing session</button>
              <button onClick={()=>handleSessionChoice('new')} style={{...C.ghost,flex:1,padding:'12px',textAlign:'center'}}>New session</button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:'#EFE8DF',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'nowrap',border:'1px solid rgba(43,42,40,0.12)'}}>
        {[{icon:'📷',label:'Customize'},{icon:'🔖',label:'Stamp'},{icon:'🛒',label:'Add to order'},{icon:'✅',label:'Checkout'}].map((s,i)=>(
          <span key={i} style={{fontFamily:'Courier New, monospace',fontSize:isMobile?10:11,color:'#2B2A28',letterSpacing:'0.03em',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
            <span>{s.icon}</span><span>{s.label}</span>
          </span>
        ))}
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <h2 style={{fontFamily:'Georgia, serif',fontSize:26,fontWeight:400,color:'#2B2A28'}}>Your photos</h2>
        <div style={{display:'flex',gap:8}}>
          {/* Sits with the actions rather than beside the "Your photos" heading:
              a control next to a heading makes the heading look clickable, and
              splits what is one toolbar into two. */}
          <button onClick={toggleSelectAll} disabled={!!importState}
            style={{...C.ghost,fontSize:11,padding:'8px 14px',opacity:importState?0.5:1,cursor:importState?'wait':'pointer',
              ...(allSelected?{borderColor:'#D97A43',color:'#D97A43'}:{})}}>
            {allSelected?'Deselect all':`Select all ${photos.length}`}
          </button>
          <input ref={addMoreRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>handleInitialFiles(e.target.files)}/>
          <button onClick={()=>addMoreRef.current?.click()} disabled={!!importState} style={{...C.ghost,fontSize:11,padding:'8px 14px',opacity:importState?0.5:1,cursor:importState?'wait':'pointer'}}>+ Add more</button>
        </div>
      </div>

      {/* Reading dates and locations out of a big batch takes a few seconds.
          Say so, or the page looks broken and people tap again. */}
      {importState&&(
        <div style={{marginBottom:16,background:'#EFE8DF',border:'1px solid rgba(43,42,40,0.1)',borderRadius:10,padding:'10px 14px'}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10,marginBottom:7}}>
            <span style={{fontFamily:'Georgia, serif',fontSize:14,color:'#2B2A28'}}>Reading your photos…</span>
            <span style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#8A6F5A'}}>{importState.done} of {importState.total}</span>
          </div>
          <div style={{height:5,borderRadius:5,background:'rgba(43,42,40,0.1)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${importState.total?Math.round(importState.done/importState.total*100):0}%`,background:'#D97A43',borderRadius:5,transition:'width .3s ease'}}/>
          </div>
        </div>
      )}

      {/* Say it here, on arrival, rather than at the checkout button. Finding out
          that an order cannot be placed only after building the whole thing is
          what made this infuriating rather than merely inconvenient. */}
      {photosNeedingReAdd.length>0&&(
        <div style={{marginBottom:16,background:'#FDF3E7',border:'1px solid #E8A33D',borderRadius:10,padding:'12px 14px'}}>
          <p style={{fontFamily:'Georgia, serif',fontSize:14,color:'#2B2A28',marginBottom:4}}>
            {photosNeedingReAdd.length===1?'One photo needs':`${photosNeedingReAdd.length} photos need`} to be added again
          </p>
          <p style={{fontSize:12,color:'#8A6F5A',lineHeight:1.5}}>
            Your browser kept a small copy to show you, but not one big enough to print.
            The {photosNeedingReAdd.length===1?'photo is':'photos are'} marked below — tap <strong>Re-add</strong> on {photosNeedingReAdd.length===1?'it':'each'} to pick {photosNeedingReAdd.length===1?'it':'them'} again.
          </p>
        </div>
      )}
      <input ref={reAddRef} type="file" accept="image/*" style={{display:'none'}}
        onChange={e=>{void handleReAddFile(e.target.files); e.target.value=''}}/>

      {/* FIX 15: removed the duplicate dark mobile filter bar — the right-panel Filter card covers mobile too */}

      <div style={{display:'grid',gridTemplateColumns:activePhotoId||selectedIds.size>0?'minmax(0,1fr) 320px':'1fr',gap:20}} className="studio-grid">
        <div>
          {sessions.map(session=>{
            const sp=photos.filter(p=>session.photoIds.includes(p.id));if(!sp.length) return null
            return(
              <div key={session.id} style={{marginBottom:32}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
                  {session.isRenaming?(
                    <input value={renameValue} onChange={e=>setRenameValue(e.target.value)}
                      onBlur={()=>setSessions(prev=>prev.map(s=>s.id===session.id?{...s,name:renameValue||s.name,isRenaming:false}:s))}
                      onKeyDown={e=>{if(e.key==='Enter')setSessions(prev=>prev.map(s=>s.id===session.id?{...s,name:renameValue||s.name,isRenaming:false}:s))}}
                      autoFocus style={{fontFamily:'Georgia, serif',fontSize:20,fontWeight:400,color:'#2B2A28',border:'none',borderBottom:'1px solid #D97A43',background:'transparent',outline:'none',padding:'2px 4px'}}/>
                  ):(
                    <h3 style={{fontFamily:'Georgia, serif',fontSize:20,fontWeight:400,color:'#2B2A28'}}>{session.name}</h3>
                  )}
                  <button onClick={()=>{setRenameValue(session.name);setSessions(prev=>prev.map(s=>s.id===session.id?{...s,isRenaming:true}:s))}}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#8A6F5A',fontFamily:'Courier New, monospace',textDecoration:'underline'}}>rename</button>
                  <span style={{fontFamily:'Courier New, monospace',fontSize:10,color:'#C4B5A5'}}>{sp.length} photos</span>
                  {/* Only worth showing once there is more than one batch to
                      tell apart — with a single batch the header button above
                      already selects everything, and two controls doing the
                      same thing is just noise. */}
                  {sessions.length>1&&(
                    <button onClick={()=>toggleSelectSession(session.photoIds)}
                      style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#8A6F5A',fontFamily:'Courier New, monospace',textDecoration:'underline'}}>
                      {sp.every(p=>selectedIds.has(p.id))?'deselect these':'select these'}
                    </button>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))',gap:12}}>
                  {sp.map(photo=>{
                    const inOrder=photoInOrder(photo.id),isActive=photo.id===activePhotoId,isSel=selectedIds.has(photo.id)
                    return(
                      <div key={photo.id} style={{position:'relative'}}>
                        {/* The visible box stays 22px, but the tappable area is padded
                            out to ~44px — the smallest target a thumb reliably hits. */}
                        <div onClick={e=>{e.stopPropagation();toggleSelect(photo.id)}}
                          style={{position:'absolute',top:0,left:0,width:44,height:44,padding:6,zIndex:10,cursor:'pointer'}}>
                          <div style={{width:22,height:22,borderRadius:5,border:`2px solid ${isSel?'#D97A43':'rgba(255,255,255,0.9)'}`,background:isSel?'#D97A43':'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {isSel&&<span style={{color:'white',fontSize:12,fontWeight:700}}>✓</span>}
                          </div>
                        </div>
                        <div onClick={()=>{
                          // Selection mode, as in a phone's photo library: once anything
                          // is ticked, every tap adds or removes just that photo. Tapping
                          // a photo used to clear the whole selection, which on a phone —
                          // where the checkbox is a small target inside a large tile —
                          // happened constantly and lost real work. Now nothing in the
                          // grid can wipe a selection; only the Clear button does.
                          if(selectedIds.size>0){ toggleSelect(photo.id); return }
                          setActivePhotoId(photo.id===activePhotoId?null:photo.id)
                          setAddedState(false)
                        }}
                          style={{aspectRatio:'1',borderRadius:10,overflow:'hidden',border:`2.5px solid ${isActive||isSel?'#D97A43':'transparent'}`,cursor:'pointer',position:'relative'}}>
                          {/* FIX 8: removed filter style from grid thumbnails */}
                          <img src={photo.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                        </div>
                        {inOrder>0&&<div style={{position:'absolute',top:-6,right:-6,width:22,height:22,background:'#D97A43',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',border:'2px solid #F7F3EE',zIndex:10}}>{inOrder}</div>}
                        {needsReAdd(photo)&&(
                          <div style={{position:'absolute',inset:0,background:'rgba(43,42,40,0.62)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,zIndex:11,padding:6,textAlign:'center'}}>
                            <span style={{fontFamily:'Courier New, monospace',fontSize:9,letterSpacing:'0.06em',textTransform:'uppercase',color:'#F7F3EE'}}>Needs re-adding</span>
                            <button onClick={e=>{e.stopPropagation();startReAdd(photo.id)}}
                              style={{background:'#D97A43',color:'#F7F3EE',border:'none',borderRadius:6,padding:'6px 12px',fontSize:11,fontFamily:'Courier New, monospace',letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>Re-add</button>
                          </div>
                        )}
                        {isTooSmallForPrint(photo.size,photo.width,photo.height)&&(
                          <div title="Low resolution - may print blurry at this size" style={{ position: "absolute", bottom: 6, right: 6, width: 19, height: 19, borderRadius: "50%", background: "#E8A33D", color: "#3A2A10", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}>!</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {(activePhoto||selectedPhotos.length>0)&&(
            <div style={{marginTop:8,...C.card}}>
              <div style={C.head}>
                <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
                  <span style={C.mono}>Preview {selectedPhotos.length>1?`(${previewIndex+1} of ${selectedPhotos.length})`:''}</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {selectedPhotos.length>1&&(
                    <>
                      <button onClick={()=>setPreviewIndex(i=>Math.max(0,i-1))} disabled={previewIndex===0} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:previewIndex===0?'#C4B5A5':'#2B2A28'}}>&#8592;</button>
                      <button onClick={()=>setPreviewIndex(i=>Math.min(selectedPhotos.length-1,i+1))} disabled={previewIndex===selectedPhotos.length-1} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:previewIndex===selectedPhotos.length-1?'#C4B5A5':'#2B2A28'}}>&#8594;</button>
                    </>
                  )}
                  <button onClick={()=>{setActivePhotoId(null);setSelectedIds(new Set())}} style={{background:'none',border:'none',cursor:'pointer',color:'#8A6F5A',fontSize:20}}>x</button>
                </div>
              </div>
              {/* FIX 2/3: two stacked canvases — photo (filtered) on bottom, stamp on top */}
              <div onClick={()=>previewPhoto&&setCropPhotoId(previewPhoto.id)} style={{background:'#1C1A18',display:'flex',alignItems:'center',justifyContent:'center',padding:12,transition:'background 0.2s',cursor:previewPhoto?'pointer':'default'}}>
                <div style={{position:'relative',display:'inline-block',maxWidth:'100%'}}>
                  <canvas ref={photoCanvasRef} style={{maxWidth:'100%',maxHeight:400,display:'block',borderRadius:3,filter:canvasCssFilter,transition:'filter 0.15s'}}/>
                  <canvas ref={stampCanvasRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}/>
                </div>
              </div>
              {/* This canvas is the paper, not the photo. Say so, and put the
                  way to change it right underneath. */}
              {previewPhoto&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'9px 12px',borderTop:'0.5px solid rgba(43,42,40,0.08)',flexWrap:'wrap'}}>
                  <span style={{fontSize:11,color:'#8A6F5A',fontStyle:'italic',lineHeight:1.4}}>
                    {(previewPhoto.crop?.mode==='fit')
                      ? 'Whole photo, with a white border where the shapes differ.'
                      : 'This is the print. Anything outside it is trimmed off.'}
                  </span>
                  <button onClick={()=>setCropPhotoId(previewPhoto.id)} style={{...C.ghost,whiteSpace:'nowrap'}}>
                    {isDefaultCrop(previewPhoto.crop)?'Adjust crop':'Crop adjusted - edit'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        {(activePhotoId||selectedIds.size>0)&&(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* FIX 10: bulk mode banner replaces per-card "— N selected" suffixes */}
            {isMultiSelect&&(
              <div style={{background:'#2B2A28',color:'#F7F3EE',borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div>
                  <p style={{fontFamily:'Georgia, serif',fontSize:15,fontWeight:500,marginBottom:2}}>Editing {selectedIds.size} photos</p>
                  <p style={{fontSize:11,color:'rgba(247,243,238,0.6)',fontStyle:'italic'}}>Changes here apply to all selected</p>
                </div>
                <button onClick={()=>setSelectedIds(new Set())} style={{background:'rgba(247,243,238,0.1)',color:'#F7F3EE',border:'1px solid rgba(247,243,238,0.2)',borderRadius:6,padding:'6px 12px',fontSize:11,fontFamily:'Courier New, monospace',letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>Clear</button>
              </div>
            )}

            {/* FIX (Finish): Order Settings card — applies to entire order, required */}
            <div style={C.card}>
              <div style={C.head}>
                <span style={C.mono}>Order settings</span>
              </div>
              <div style={{padding:'10px 12px 12px'}}>
                <p style={{fontSize:13,color:'#2B2A28',fontWeight:500,marginBottom:2}}>Finish <span style={{color:'#D97A43'}}>*</span></p>
                <p style={{fontSize:11,color:'#8A6F5A',marginBottom:8,lineHeight:1.4}}>Surface only. Both are pro photo paper. Applies to all photos.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {(['lustre','gloss'] as const).map(f=>{
                    const isActive = finish===f
                    return (
                      <button key={f} onClick={()=>setFinish(f)}
                        style={{padding:'9px 10px',background:isActive?'#F2D5C0':'#F7F3EE',color:isActive?'#8A3A10':'#2B2A28',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                        <div style={{fontSize:12,fontWeight:500,textTransform:'capitalize',marginBottom:2}}>{f}</div>
                        <div style={{fontSize:10,opacity:0.8,lineHeight:1.3}}>{f==='lustre'?'Semi-matte, soft sheen':'Shiny, vivid color'}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* FILTER */}
            <div style={C.card}>
              <div style={C.head}>
                <span style={C.mono}>Filter</span>
              </div>
              <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {FILTERS.map(f=>{
                  const isActive = isMultiSelect ? bulkSharedFilter===f.key : activePhoto?.filter===f.key
                  return (
                    <button key={f.key} onClick={()=>isMultiSelect ? applyBulkFilter(f.key) : activePhoto && updatePhoto(activePhoto.id,{filter:f.key})}
                      style={{padding:'8px 4px',fontSize:11,fontFamily:'Courier New, monospace',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:isActive?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:isActive?'#8A3A10':'#2B2A28',minHeight:36}}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
              {isMultiSelect&&bulkSharedFilter==='mixed'&&<p style={{fontSize:11,color:'#D97A43',fontStyle:'italic',padding:'0 12px 10px'}}>Mixed filters — pick one to apply to all</p>}
            </div>

            {/* SINGLE-PHOTO Timestamp card */}
            {activePhoto&&!isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Timestamp</span></div>
                <div style={{padding:'8px 16px 14px'}}>
                  {activePhoto.stamp.capturedAt ? (
                    <div style={C.togRow}>
                      <div style={{flex:1}}>
                        <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Date</p>
                        <input type="date" defaultValue={activePhoto.stamp.capturedAt.slice(0,10)}
                          onChange={e=>{if(e.target.value){const dt=new Date(activePhoto.stamp.capturedAt!);const[y,m,d]=e.target.value.split('-');dt.setFullYear(+y,+m-1,+d);updateStamp(activePhoto.id,{capturedAt:dt.toISOString(),hasExifDate:true})}}}
                          style={{...C.input,fontSize:13,padding:'8px 10px'}}/>
                        <div style={{display:'flex',gap:6,marginTop:6}}>
                          {/* FIX 4: classic format label updated to MM DD YYYY */}
                          {(['classic','modern'] as const).map(fmt=>(
                            <button key={fmt} onClick={()=>updateStamp(activePhoto.id,{dateFormat:fmt})}
                              style={{flex:1,padding:'5px 8px',fontSize:10,fontFamily:'Courier New, monospace',border:`1px solid ${(activePhoto.stamp.dateFormat??'classic')===fmt?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:6,background:(activePhoto.stamp.dateFormat??'classic')===fmt?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:(activePhoto.stamp.dateFormat??'classic')===fmt?'#8A3A10':'#8A6F5A'}}>
                              {fmt==='classic'?'05 17 2026':'May 17, 2026'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Toggle checked={activePhoto.stamp.showDate} onChange={()=>updateStamp(activePhoto.id,{showDate:!activePhoto.stamp.showDate})}/>
                    </div>
                  ) : (
                    <div style={{padding:'10px 0',borderBottom:'0.5px solid rgba(43,42,40,0.06)'}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Date</p>
                      <p style={{fontSize:11,color:'#D97A43',marginBottom:6}}>No date found - add one:</p>
                      <input type="date" onChange={e=>{if(e.target.value){const[y,m,d]=e.target.value.split('-');const dt=new Date(+y,+m-1,+d,12);updateStamp(activePhoto.id,{capturedAt:dt.toISOString(),hasExifDate:true,showDate:true})}}}
                        style={{...C.input,fontSize:13,padding:'8px 10px'}}/>
                    </div>
                  )}
                  <div style={C.togRow}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Time</p>
                      {activePhoto.stamp.capturedAt?(
                        <input type="time" defaultValue={activePhoto.stamp.capturedAt.slice(11,16)}
                          onChange={e=>{if(e.target.value&&activePhoto.stamp.capturedAt){const dt=new Date(activePhoto.stamp.capturedAt);const[h,m]=e.target.value.split(':');dt.setHours(+h,+m);updateStamp(activePhoto.id,{capturedAt:dt.toISOString()})}}}
                          style={{...C.input,fontSize:13,padding:'8px 10px'}}/>
                      ):(
                        <p style={{fontSize:12,color:'#C4B5A5'}}>Add date first</p>
                      )}
                    </div>
                    <Toggle checked={activePhoto.stamp.showTime&&!!activePhoto.stamp.capturedAt} onChange={()=>updateStamp(activePhoto.id,{showTime:!activePhoto.stamp.showTime})}/>
                  </div>
                  <div style={C.togRow}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Location</p>
                      <input style={{...C.input,fontSize:13,padding:'8px 10px'}} placeholder="e.g. Tampa, FL"
                        value={activePhoto.stamp.locationText} onChange={e=>updateStamp(activePhoto.id,{locationText:e.target.value})}/>
                      {!activePhoto.stamp.locationText&&(
                        <button onClick={detectLocation} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#D97A43',textDecoration:'underline',padding:'4px 0',fontFamily:'inherit'}}>Use my current location</button>
                      )}
                    </div>
                    <Toggle checked={activePhoto.stamp.showLocation&&!!activePhoto.stamp.locationText} onChange={()=>updateStamp(activePhoto.id,{showLocation:!activePhoto.stamp.showLocation})}/>
                  </div>
                  <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Custom text</span>
                  <input style={C.input} placeholder="e.g. Amalfi Coast, 2025" value={activePhoto.stamp.customText} onChange={e=>updateStamp(activePhoto.id,{customText:e.target.value})}/>
                </div>
              </div>
            )}

            {/* SINGLE-PHOTO Stamp */}
            {activePhoto&&!isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Stamp</span></div>
                <div style={{padding:'12px 14px'}}>
                      {/* FIX (Compact): Style + Position 2-col grid */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                        <div>
                          <span style={{...C.mono,display:'block',marginBottom:4}}>Style</span>
                          <select style={{...C.select,fontSize:12,padding:'7px 8px'}} value={activePhoto.stamp.style} onChange={e=>updateStamp(activePhoto.id,{style:e.target.value as StampStyle})}>
                            <option value="burn">Classic burn</option>
                            <option value="overlay">Subtle overlay</option>
                            <option value="none">No stamp</option>
                          </select>
                        </div>
                        <div>
                          <span style={{...C.mono,display:'block',marginBottom:4}}>Position</span>
                          <select style={{...C.select,fontSize:12,padding:'7px 8px'}} value={activePhoto.stamp.position} onChange={e=>updateStamp(activePhoto.id,{position:e.target.value as StampPos})} disabled={activePhoto.stamp.style==='none'}>
                            <option value="bl">Bottom left</option>
                            <option value="br">Bottom right</option>
                            <option value="tl">Top left</option>
                            <option value="tr">Top right</option>
                          </select>
                        </div>
                      </div>
                      {activePhoto.stamp.style!=='none'&&(
                        <>
                          <span style={{...C.mono,display:'block',marginBottom:4}}>Font</span>
                          <select style={{...C.select,fontSize:13,padding:'7px 10px'}} value={activePhoto.stamp.stampFont??'classic'} onChange={e=>updateStamp(activePhoto.id,{stampFont:e.target.value as StampFont})}>
                            {STAMP_FONTS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                        </>
                      )}
                </div>
              </div>
            )}

            {/* SINGLE-PHOTO Default size */}
            {activePhoto&&!isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Default size</span></div>
                <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {SIZES.map(s=>(
                    <button key={s.key} onClick={()=>updatePhoto(activePhoto.id,{size:s.key})}
                      style={{padding:'8px',fontSize:12,border:`1px solid ${activePhoto.size===s.key?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:activePhoto.size===s.key?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:activePhoto.size===s.key?'#8A3A10':'#2B2A28',fontFamily:'inherit',minHeight:40}}>{s.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* SINGLE-PHOTO Add to order */}
            {activePhoto&&!isMultiSelect&&(
              <button onClick={()=>addToOrder(activePhoto)} disabled={addedState}
                style={{...C.accent,background:addedState?'#C4B5A5':'#D97A43',cursor:addedState?'default':'pointer'}}>
                {addedState?'Added to order ✓':'Add to order with these settings'}
              </button>
            )}

            {/* BULK Timestamp — FIX 5/9/12 */}
            {isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Timestamp</span></div>
                <div style={{padding:'8px 16px 14px'}}>
                  <p style={{fontSize:11,color:'#8A6F5A',fontStyle:'italic',marginBottom:10,lineHeight:1.4}}>
                    Each photo keeps its own captured date &amp; location. Changes here apply to all selected.
                  </p>
                  {/* FIX 13/17a: bulk date override input — non-destructive, stored in capturedAtOverride */}
                  <div style={{padding:'10px 0',borderBottom:'0.5px solid rgba(43,42,40,0.06)'}}>
                    <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Set date for all selected</p>
                    <p style={{fontSize:11,color:'#8A6F5A',marginBottom:6}}>Overrides each photo's captured date. Clear to restore originals.</p>
                    <input type="date" value={bulkDateOverride}
                      onChange={e=>{
                        const v=e.target.value
                        setBulkDateOverride(v)
                        const ids=Array.from(selectedIds)
                        if(v){
                          // Set override to noon on the chosen date (no time picker in bulk)
                          const[y,m,d]=v.split('-')
                          const dt=new Date(+y,+m-1,+d,12,0,0)
                          const iso=dt.toISOString()
                          setPhotos(prev=>prev.map(p=>ids.includes(p.id)
                            ? {...p,stamp:{...p.stamp,capturedAtOverride:iso,showDate:true}}
                            : p))
                        } else {
                          // Cleared: remove override, original capturedAt is restored automatically
                          setPhotos(prev=>prev.map(p=>ids.includes(p.id)
                            ? {...p,stamp:{...p.stamp,capturedAtOverride:null}}
                            : p))
                        }
                      }}
                      style={{...C.input,fontSize:13,padding:'8px 10px'}}/>
                  </div>
                  <div style={C.togRow}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Show date</p>
                      {/* FIX 17b: subtitle reflects whether override is active */}
                      <p style={{fontSize:11,color:'#8A6F5A'}}>
                        {bulkDateOverride
                          ? `Showing ${(()=>{const[y,m,d]=bulkDateOverride.split('-');return `${m} ${d} ${y}`})()} on all selected`
                          : "Uses each photo's own capture date"}
                      </p>
                      {!bulkDateOverride && bulkSharedShowDate===true && selectedPhotos.some(p=>!effectiveCapturedAt(p.stamp)) && (
                        <p style={{fontSize:11,color:'#D97A43',marginTop:4,fontStyle:'italic'}}>Some photos have no date — use "Set date for all selected" above</p>
                      )}
                      <div style={{display:'flex',gap:6,marginTop:6}}>
                        {(['classic','modern'] as const).map(fmt=>{
                          const isActive = bulkSharedDateFormat===fmt
                          return (
                            <button key={fmt} onClick={()=>applyBulkStamp({dateFormat:fmt})}
                              style={{flex:1,padding:'5px 8px',fontSize:10,fontFamily:'Courier New, monospace',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:6,background:isActive?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:isActive?'#8A3A10':'#8A6F5A'}}>
                              {fmt==='classic'?'05 17 2026':'May 17, 2026'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <Toggle checked={bulkSharedShowDate===true} onChange={()=>applyBulkStamp({showDate:!(bulkSharedShowDate===true)})}/>
                  </div>
                  <div style={C.togRow}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Show time</p>
                      <p style={{fontSize:11,color:'#8A6F5A'}}>
                        {bulkDateOverride
                          ? 'Set to noon on the override date (no time picker in bulk)'
                          : "Uses each photo's own capture time"}
                      </p>
                      {!bulkDateOverride && bulkSharedShowTime===true && selectedPhotos.some(p=>!effectiveCapturedAt(p.stamp)) && (
                        <p style={{fontSize:11,color:'#D97A43',marginTop:4,fontStyle:'italic'}}>Some photos have no time — set a date above first</p>
                      )}
                    </div>
                    <Toggle checked={bulkSharedShowTime===true} onChange={()=>applyBulkStamp({showTime:!(bulkSharedShowTime===true)})}/>
                  </div>
                  <div style={C.togRow}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:14,color:'#2B2A28',fontWeight:500,marginBottom:4}}>Location</p>
                      <input style={{...C.input,fontSize:13,padding:'8px 10px'}} placeholder="Type to apply to all selected"
                        value={bulkLocationText}
                        onChange={e=>{setBulkLocationText(e.target.value); applyBulkStamp({locationText:e.target.value,showLocation:!!e.target.value})}}/>
                      <button onClick={detectBulkLocation} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#D97A43',textDecoration:'underline',padding:'4px 0',fontFamily:'inherit'}}>Use my current location</button>
                    </div>
                    <Toggle checked={bulkSharedShowLocation===true} onChange={()=>applyBulkStamp({showLocation:!(bulkSharedShowLocation===true)})}/>
                  </div>
                  <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Custom text</span>
                  <input style={C.input} placeholder="Type to apply to all selected"
                    value={bulkCustomText}
                    onChange={e=>{setBulkCustomText(e.target.value); applyBulkStamp({customText:e.target.value})}}/>
                </div>
              </div>
            )}

            {/* BULK Stamp */}
            {isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Stamp</span></div>
                <div style={{padding:'14px 16px'}}>
                      <span style={{...C.mono,display:'block',marginBottom:4,marginTop:12}}>Style</span>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                        {(['burn','overlay','none'] as StampStyle[]).map(s=>{
                          const isActive = bulkSharedStyle===s
                          return (
                            <button key={s} onClick={()=>applyBulkStyle(s)}
                              style={{padding:'8px',fontSize:11,fontFamily:'Courier New, monospace',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:isActive?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:isActive?'#8A3A10':'#2B2A28',minHeight:36}}>
                              {s==='burn'?'Classic burn':s==='overlay'?'Overlay':'No stamp'}
                            </button>
                          )
                        })}
                      </div>
                      {bulkSharedStyle==='mixed'&&<p style={{fontSize:11,color:'#D97A43',fontStyle:'italic',marginTop:6}}>Mixed styles — pick one to apply to all</p>}
                      {bulkSharedStyle!=='none'&&bulkSharedStyle!=='mixed'&&(
                        <>
                          <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Font</span>
                          <select style={C.select} value={bulkSharedFont==='mixed'?'':(bulkSharedFont as string ?? 'classic')} onChange={e=>applyBulkStamp({stampFont:e.target.value as StampFont})}>
                            {bulkSharedFont==='mixed'&&<option value="" disabled>Mixed — pick one</option>}
                            {STAMP_FONTS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                          <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Position</span>
                          <select style={C.select} value={bulkSharedPosition==='mixed'?'':(bulkSharedPosition as string ?? '')} onChange={e=>applyBulkStamp({position:e.target.value as StampPos})}>
                            <option value="" disabled>Choose position</option>
                            <option value="bl">Bottom left</option>
                            <option value="br">Bottom right</option>
                            <option value="tl">Top left</option>
                            <option value="tr">Top right</option>
                          </select>
                        </>
                      )}
                </div>
              </div>
            )}

            {/* BULK Default size — FIX 9 */}
            {isMultiSelect&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Default size</span></div>
                <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {SIZES.map(s=>{
                    const isActive = bulkSharedSize===s.key
                    return (
                      <button key={s.key} onClick={()=>applyBulkSize(s.key)}
                        style={{padding:'8px',fontSize:12,border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:isActive?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:isActive?'#8A3A10':'#2B2A28',fontFamily:'inherit',minHeight:40}}>{s.label}</button>
                    )
                  })}
                </div>
                {bulkSharedSize==='mixed'&&<p style={{fontSize:11,color:'#D97A43',fontStyle:'italic',padding:'0 12px 10px'}}>Mixed sizes — pick one to apply to all</p>}
              </div>
            )}

            {/* BULK Add to order */}
            {isMultiSelect&&(
              <button onClick={()=>{selectedPhotos.forEach(p=>addToOrder(p));setSelectedIds(new Set())}}
                style={{...C.accent}}>
                Add {selectedIds.size} photos to order
              </button>
            )}
          </div>
        )}
      </div>

      {/* The order sits below the editing controls: it grows as you go, and
          burying the filters under it meant more scrolling with every print. */}
        {orderItems.length>0&&(
          <div style={{marginTop:36}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{fontFamily:'Georgia, serif',fontSize:26,fontWeight:400,color:'#2B2A28'}}>In your order</h2>
              <span style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#8A6F5A'}}>{totalQty} prints</span>
            </div>
            {/* Wraps to new rows rather than running off the side of the phone.
                A sideways strip meant the order kept growing out of view. */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))',gap:12,paddingBottom:12}}>
              {orderItems.map((item,idx)=>(
                <div key={item.id} style={{...C.card,width:'100%',minWidth:0}}>
                  <div style={{position:'relative'}}>
                    <img src={item.url} alt="" style={{width:'100%',height:140,objectFit:'cover',display:'block',filter:getFCss(item.filter)}}/>
                    <div style={{position:'absolute',top:6,left:6,background:'rgba(43,42,40,0.72)',color:'#F7F3EE',borderRadius:4,padding:'2px 8px',fontFamily:'Courier New, monospace',fontSize:10}}>#{idx+1}</div>
                  </div>
                  <div style={{padding:'10px 12px'}}>
                    <select value={item.size} onChange={e=>setOrderItems(prev=>prev.map(i=>i.id===item.id?{...i,size:e.target.value}:i))}
                      style={{...C.select,fontSize:12,padding:'6px 8px',marginBottom:8}}>
                      {SIZES.map(s=><option key={s.key} value={s.key}>{s.label} - {formatCents(getPricePerPrintCents(s.key,totalQty))}/ea</option>)}
                    </select>
                    {(()=>{
                      const n=itemResolutionNote(item,photos)
                      return n?(
                        <div style={{ fontSize: 11, color: "#8A5A12", background: "#FAEEDA", border: "1px solid rgba(217,122,67,.3)", borderRadius: 8, padding: "6px 8px", marginTop: 6, lineHeight: 1.4 }}>{n}</div>
                      ):null
                    })()}
                    <StampBullets stamp={item.stamp} filter={item.filter}/>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <button onClick={()=>updateOrderQty(item.id,-1)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(43,42,40,0.2)',background:'#F7F3EE',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>-</button>
                        <span style={{fontSize:15,fontWeight:500,minWidth:20,textAlign:'center'}}>{item.quantity}</span>
                        <button onClick={()=>updateOrderQty(item.id,1)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(43,42,40,0.2)',background:'#F7F3EE',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontFamily:'Courier New, monospace',fontSize:12,fontWeight:500}}>{formatCents(getPricePerPrintCents(item.size,totalQty)*item.quantity)}</span>
                        <button onClick={()=>setOrderItems(prev=>prev.filter(i=>i.id!==item.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#C4B5A5',fontSize:18}}>x</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{position:'sticky',bottom:16,marginTop:16,background:'#2B2A28',borderRadius:14,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 8px 32px rgba(43,42,40,0.2)',zIndex:50,gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                {uploadState.error&&(
                  <p style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#F5A878',marginBottom:4}}>{uploadState.error}</p>
                )}
                {uploadState.active?(
                  <>
                    <p style={{fontFamily:'Courier New, monospace',fontSize:10,color:'rgba(247,243,238,0.55)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>Preparing photos {uploadState.current} of {uploadState.total}</p>
                    <p style={{fontFamily:'Georgia, serif',fontSize:18,color:'#F7F3EE',fontWeight:400}}>Hang tight…</p>
                  </>
                ):(
                  <>
                    <p style={{fontFamily:'Courier New, monospace',fontSize:10,color:'rgba(247,243,238,0.55)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>
                      {totalQty} prints{finish?` · ${finish} finish`:''} - flat {formatCents(SHIPPING_FLAT_CENTS)} shipping
                    </p>
                    <p style={{fontFamily:'Georgia, serif',fontSize:22,color:'#F7F3EE',fontWeight:400}}>{formatCents(orderTotalCents)}<span style={{fontSize:11,opacity:0.55,marginLeft:6}}>+ {formatCents(SHIPPING_FLAT_CENTS)} shipping</span></p>
                    {belowMinimum?(
                      <p style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#F5A878',letterSpacing:'0.03em',marginTop:6}}>
                        + Orders start at {MIN_ORDER_QTY} prints - add {MIN_ORDER_QTY-totalQty} more to check out
                      </p>
                    ):nextTier&&(
                      <p style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#F5A878',letterSpacing:'0.03em',marginTop:6}}>
                        + Add {nextTier.needed} more print{nextTier.needed>1?'s':''} to reach the {nextTier.minQty}+ price
                      </p>
                    )}
                    {softCount>0&&(
                      <p style={{ fontSize: 11, color: "#E8A33D", margin: "4px 0 0", lineHeight: 1.45 }}>
                        {softCount===1?"1 photo may look soft":softCount+" photos may look soft"} at the size chosen. They will still print, but a smaller size will be sharper.
                      </p>
                    )}
                  </>
                )}
              </div>
              <button onClick={goToCheckout} disabled={uploadState.active||!finish||belowMinimum} style={{...C.accent,width:'auto',padding:'13px 24px',fontSize:13,flexShrink:0,opacity:(uploadState.active||!finish||belowMinimum)?0.5:1,cursor:(uploadState.active||!finish||belowMinimum)?'not-allowed':'pointer'}}>
                {uploadState.active?'Uploading…':!finish?'Choose finish':belowMinimum?`Add ${MIN_ORDER_QTY-totalQty} more`:'Checkout'}
              </button>
            </div>
          </div>
        )}

        {cropPhotoId&&(()=>{
          const cp=photos.find(p=>p.id===cropPhotoId)
          if(!cp)return null
          return <CropModal photo={cp} onClose={()=>setCropPhotoId(null)}
            onSave={(crop,size)=>saveCrop(cp.id,crop,size)}/>
        })()}
    </div>
  )
}
