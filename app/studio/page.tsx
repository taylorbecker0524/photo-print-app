'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPricePerPrintCents, getNextTier, MIN_ORDER_QTY } from '@/lib/pricing'

type Filter = 'original' | 'film' | 'sepia' | 'bw' | 'faded' | 'vivid' | 'cool'
type StampStyle = 'burn' | 'overlay' | 'none'
type StampPos = 'bl' | 'br' | 'tl' | 'tr'
type StampLocation = 'front' | 'back'
type StampFont = 'classic' | 'pixel' | 'typewriter'  // FIX 16
type StampConfig = {
  showDate: boolean; showTime: boolean; showLocation: boolean
  locationText: string; customText: string; style: StampStyle
  position: StampPos; capturedAt: string | null
  capturedAtOverride: string | null  // FIX 17a: bulk override, preserves original capturedAt
  hasExifDate: boolean; hasExifLocation: boolean
  dateFormat: 'modern' | 'classic'
  stampLocation: StampLocation
  stampFont: StampFont
}
type Photo = { id: string; file: File; url: string; sessionId: string; filter: Filter; stamp: StampConfig; size: string }
type OrderItem = { id: string; photoId: string; url: string; fileName: string; filter: Filter; stamp: StampConfig; size: string; quantity: number }
type Session = { id: string; name: string; date: Date; photoIds: string[]; isRenaming: boolean }

const SIZES = [
  { key: '4x6', label: '4x6"' }, { key: '5x7', label: '5x7"' },
  { key: '8x10', label: '8x10"' }, { key: 'square-4', label: '4x4"' },
  { key: 'square-5', label: '5x5"' }, { key: 'square-8', label: '8x8"' },
]
const FILTERS: { key: Filter; label: string; css: string }[] = [
  { key: 'original', label: 'Original', css: 'none' },
  { key: 'film', label: 'Film', css: 'sepia(0.2) contrast(1.1) saturate(0.9) brightness(0.95)' },
  { key: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.05)' },
  { key: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { key: 'faded', label: 'Faded', css: 'contrast(0.85) saturate(0.7) brightness(1.05)' },
  { key: 'vivid', label: 'Vivid', css: 'saturate(1.4) contrast(1.1)' },
  { key: 'cool', label: 'Cool', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.02)' },
]
const getFCss = (f: Filter) => FILTERS.find(x => x.key === f)?.css ?? 'none'
// Per-print price in dollars, from the single source of truth in lib/pricing —
// so the studio always shows exactly what checkout will charge.
const getPrice = (size: string, qty: number) => getPricePerPrintCents(size, qty) / 100
const fmtSession = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// FIX 4: classic format is now MM DD YYYY (was DD MM YYYY)
const fmtDate = (iso: string, fmt: 'modern'|'classic' = 'classic') => {
  const d = new Date(iso)
  return fmt === 'classic'
    ? `${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}`
    : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})

// FIX 17a: effective date = override if set, else original capturedAt
const effectiveCapturedAt = (s:StampConfig): string | null => s.capturedAtOverride ?? s.capturedAt

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
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r=await fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
    if(!r.ok) return ''
    const d=await r.json()
    return d.location ?? ''
  } catch { return '' }
}

const DEFAULT_STAMP: StampConfig = {
  showDate:false,showTime:false,showLocation:false,locationText:'',customText:'',
  style:'burn',position:'bl',capturedAt:null,capturedAtOverride:null,
  hasExifDate:false,hasExifLocation:false,
  dateFormat:'classic',stampLocation:'front',stampFont:'classic'
}

// FIX 16: three curated stamp font options. css = canvas font string; webFont = Google Font CSS family
const STAMP_FONTS: { key: StampFont; label: string; family: string; weight: number; sizeMult: number }[] = [
  { key: 'classic',    label: 'Classic burn (LCD)',    family: '"Share Tech Mono", "Courier New", monospace', weight: 400, sizeMult: 1.0 },
  { key: 'pixel',      label: 'Pixel print',           family: '"VT323", "Courier New", monospace',           weight: 400, sizeMult: 1.35 },
  { key: 'typewriter', label: 'Typewriter (vintage)',  family: '"Special Elite", Georgia, serif',             weight: 400, sizeMult: 1.05 },
]
const getStampFont = (key: StampFont) => STAMP_FONTS.find(f=>f.key===key) ?? STAMP_FONTS[0]

// FIX 5: build lines for FRONT stamp (date+time on separate lines for vertical layout)
// FIX 5: build lines for BACK stamp (date+time on SAME line)
function buildStampLinesForFront(stamp:StampConfig):string[]{
  const lines:string[]=[]
  const cap = effectiveCapturedAt(stamp)
  if(stamp.showDate&&cap){
    lines.push(fmtDate(cap, stamp.dateFormat??'classic'))
    if(stamp.showTime) lines.push(fmtTime(cap))
  } else if(stamp.showTime&&cap) {
    lines.push(fmtTime(cap))
  }
  if(stamp.showLocation&&stamp.locationText) lines.push(stamp.locationText)
  if(stamp.customText) lines.push(stamp.customText)
  return lines
}
function buildStampLinesForBack(stamp:StampConfig):string[]{
  const lines:string[]=[]
  const fmt=stamp.dateFormat??'classic'
  const cap = effectiveCapturedAt(stamp)
  // FIX 5: date + time joined on one line for back of photo
  if(stamp.showDate&&cap&&stamp.showTime){
    lines.push(`${fmtDate(cap, fmt)}   ${fmtTime(cap)}`)
  } else if(stamp.showDate&&cap){
    lines.push(fmtDate(cap, fmt))
  } else if(stamp.showTime&&cap){
    lines.push(fmtTime(cap))
  }
  if(stamp.showLocation&&stamp.locationText) lines.push(stamp.locationText)
  if(stamp.customText) lines.push(stamp.customText)
  return lines
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
  if(stamp.style!=='none'||stamp.stampLocation==='back'){
    if(stamp.stampLocation==='back') items.push('Back of photo (plain black text)')
    else items.push(`${stamp.style==='burn'?'Classic burn':'Overlay'} - ${stamp.position==='bl'?'bottom left':stamp.position==='br'?'bottom right':stamp.position==='tl'?'top left':'top right'}`)
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

export default function StudioPage(){
  const router=useRouter()
  const fileInputRef=useRef<HTMLInputElement>(null)
  const addMoreRef=useRef<HTMLInputElement>(null)
  const photoCanvasRef=useRef<HTMLCanvasElement>(null)   // FIX 2/3: photo (filtered) on bottom layer
  const stampCanvasRef=useRef<HTMLCanvasElement>(null)   // FIX 2/3: stamp on top, no filter
  const [photos,setPhotos]=useState<Photo[]>([])
  const [sessions,setSessions]=useState<Session[]>([])
  const [orderItems,setOrderItems]=useState<OrderItem[]>([])
  const [activePhotoId,setActivePhotoId]=useState<string|null>(null)
  const [previewIndex,setPreviewIndex]=useState(0)
  const [previewSide,setPreviewSide]=useState<'front'|'back'>('front')
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [renameValue,setRenameValue]=useState('')
  const [addedState,setAddedState]=useState(false)
  const [showSessionPrompt,setShowSessionPrompt]=useState(false)
  const [pendingFiles,setPendingFiles]=useState<FileList|null>(null)
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
  const orderTotal=orderItems.reduce((s,i)=>s+getPrice(i.size,totalQty)*i.quantity,0)
  const nextTier = totalQty>0 ? getNextTier(totalQty) : null
  const belowMinimum = totalQty>0 && totalQty < MIN_ORDER_QTY
  const isMultiSelect = selectedIds.size > 1

  useEffect(()=>{
    if(previewPhoto?.stamp.stampLocation==='back') setPreviewSide('back')
    else setPreviewSide('front')
  },[previewPhoto?.stamp.stampLocation,activePhotoId])

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
  const bulkSharedStampLocation = sharedValue(selectedPhotos, p=>p.stamp.stampLocation)
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
    for(let start=0;start<imageFiles.length;start+=CHUNK_SIZE){
      const batch=imageFiles.slice(start,start+CHUNK_SIZE)
      const processed=await Promise.all(batch.map(async(f)=>{
        const id=Math.random().toString(36).slice(2)
        newPhotoIds.push(id)
        const exif=await readExif(f)
        let locationText='',hasExifLocation=false
        if(exif.lat!==null&&exif.lon!==null){locationText=await reverseGeocode(exif.lat,exif.lon);hasExifLocation=!!locationText}
        return{id,file:f,url:URL.createObjectURL(f),sessionId,filter:'original' as Filter,
          stamp:{...DEFAULT_STAMP,capturedAt:exif.date,hasExifDate:!!exif.date,hasExifLocation,locationText,showDate:!!exif.date,showLocation:hasExifLocation},size:'4x6'}
      }))
      newPhotos.push(...processed)
    }
    setPhotos(prev=>[...prev,...newPhotos])
    setSessions(prev=>prev.map(s=>s.id===sessionId?{...s,photoIds:[...s.photoIds,...newPhotoIds]}:s))
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

    if(previewSide==='back'){
      // Render paper-back surface on the photo canvas; clear stamp canvas
      const aspect = 4/6
      let cw=Math.min(maxW,500), ch=cw/aspect
      if(ch>maxH){ch=maxH;cw=ch*aspect}
      photoCanvas.width=Math.round(cw);photoCanvas.height=Math.round(ch)
      stampCanvas.width=Math.round(cw);stampCanvas.height=Math.round(ch)
      const ctx=photoCanvas.getContext('2d')!
      ctx.fillStyle='#F2EBDD';ctx.fillRect(0,0,cw,ch)
      const grd=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*0.3,cw/2,ch/2,Math.max(cw,ch)*0.7)
      grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(1,'rgba(43,42,40,0.08)')
      ctx.fillStyle=grd;ctx.fillRect(0,0,cw,ch)
      // Back-of-photo stamp lines (date+time on same line per FIX 5)
      const lines=buildStampLinesForBack(previewPhoto.stamp)
      if(lines.length){
        const fontDef=getStampFont(previewPhoto.stamp.stampFont??'classic')
        const fs=cw*0.028*fontDef.sizeMult,pad=cw*0.04,lineH=fs*1.55
        ctx.font=`${fontDef.weight} ${Math.round(fs)}px ${fontDef.family}`
        ctx.fillStyle='#2B2A28'
        const startY=ch-pad-lineH*(lines.length-1)
        lines.forEach((l,i)=>ctx.fillText(l,pad,startY+i*lineH))
      }
      // Clear the stamp canvas (back uses only the bottom layer)
      const sctx=stampCanvas.getContext('2d')!
      sctx.clearRect(0,0,stampCanvas.width,stampCanvas.height)
      return
    }

    // FRONT side
    const img=new Image()
    img.onload=()=>{
      let cw=Math.min(maxW,img.naturalWidth),ch=(cw/img.naturalWidth)*img.naturalHeight
      if(ch>maxH){ch=maxH;cw=(ch/img.naturalHeight)*img.naturalWidth}
      photoCanvas.width=Math.round(cw);photoCanvas.height=Math.round(ch)
      stampCanvas.width=Math.round(cw);stampCanvas.height=Math.round(ch)

      // Bottom canvas: photo only (CSS filter applied to the canvas element below)
      const pctx=photoCanvas.getContext('2d')!
      pctx.clearRect(0,0,cw,ch)
      pctx.drawImage(img,0,0,cw,ch)

      // Top canvas: stamp only, no filter
      const sctx=stampCanvas.getContext('2d')!
      sctx.clearRect(0,0,cw,ch)
      const{stamp}=previewPhoto
      if(stamp.stampLocation==='back'||stamp.style==='none') return
      const lines=buildStampLinesForFront(stamp)
      if(!lines.length) return
      const fontDef=getStampFont(stamp.stampFont??'classic')
      const fs=cw*0.022*fontDef.sizeMult,pad=cw*0.025,lineH=fs*1.45
      sctx.font=`${stamp.style==='burn'?'bold':fontDef.weight} ${Math.round(fs)}px ${fontDef.family}`
      const boxW=Math.max(...lines.map(l=>sctx.measureText(l).width))+pad*2,boxH=lines.length*lineH+pad*0.8
      let bx=pad,by=ch-boxH-pad
      if(stamp.position==='br') bx=cw-boxW-pad
      if(stamp.position==='tl') by=pad
      if(stamp.position==='tr'){bx=cw-boxW-pad;by=pad}
      if(stamp.style==='burn'){
        sctx.fillStyle='#E8841A';sctx.shadowColor='rgba(232,132,26,0.6)';sctx.shadowBlur=3
        lines.forEach((l,i)=>sctx.fillText(l,bx,by+pad*0.4+(i+1)*lineH-lineH*0.2))
        sctx.shadowBlur=0
      } else {
        sctx.fillStyle='rgba(247,243,238,0.65)';sctx.fillRect(bx,by,boxW,boxH)
        sctx.fillStyle='rgba(43,42,40,0.85)'
        lines.forEach((l,i)=>sctx.fillText(l,bx+pad*0.8,by+pad*0.4+(i+1)*lineH-lineH*0.2))
      }
    }
    img.src=previewPhoto.url
    if(img.complete && img.naturalWidth > 0) img.onload?.(new Event('load') as any)
  },[previewPhoto?.id,previewPhoto?.url,previewPhoto?.filter,
     previewPhoto?.stamp.showDate,previewPhoto?.stamp.showTime,previewPhoto?.stamp.showLocation,
     previewPhoto?.stamp.locationText,previewPhoto?.stamp.customText,previewPhoto?.stamp.style,
     previewPhoto?.stamp.position,previewPhoto?.stamp.dateFormat,previewPhoto?.stamp.stampLocation,
     previewPhoto?.stamp.stampFont,previewPhoto?.stamp.capturedAt,previewPhoto?.stamp.capturedAtOverride,previewIndex,previewSide,fontsReady])

  const updatePhoto=(id:string,u:Partial<Photo>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,...u}:p));setAddedState(false)}
  const updateStamp=(id:string,u:Partial<StampConfig>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,stamp:{...p.stamp,...u}}:p));setAddedState(false)}
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

  const toggleSelect=(id:string)=>{
    setSelectedIds(prev=>{
      const n=new Set(prev)
      n.has(id)?n.delete(id):n.add(id)
      setPreviewIndex(0)
      return n
    })
    setActivePhotoId(id)
    setAddedState(false)
  }

  const addToOrder=(photo:Photo)=>{
    setOrderItems(prev=>{
      const existing=prev.find(i=>i.photoId===photo.id&&i.size===photo.size&&i.filter===photo.filter&&JSON.stringify(i.stamp)===JSON.stringify(photo.stamp))
      if(existing) return prev.map(i=>i.id===existing.id?{...i,quantity:i.quantity+1}:i)
      return[...prev,{id:Math.random().toString(36).slice(2),photoId:photo.id,url:photo.url,fileName:photo.file.name,filter:photo.filter,stamp:{...photo.stamp},size:photo.size,quantity:1}]
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
    // Dedupe photos across order items — a single photo might be in multiple cart entries
    const uniquePhotoIds = Array.from(new Set(orderItems.map(i=>i.photoId)))
    setUploadState({active:true,current:0,total:uniquePhotoIds.length,error:''})

    // Compress + upload each unique photo, mapping photoId → supabase path
    const pathMap: Record<string,string> = {}
    try {
      const {compressForPrint, uploadCompressed} = await import('@/lib/compress')
      for(let i=0; i<uniquePhotoIds.length; i++){
        const photoId = uniquePhotoIds[i]
        const photo = photos.find(p=>p.id===photoId)
        if(!photo) throw new Error(`Photo ${photoId} not found in state`)
        const compressed = await compressForPrint(photo.file)
        const path = await uploadCompressed(compressed.blob, photo.file.name)
        pathMap[photoId] = path
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
      photoPath: pathMap[i.photoId],
    }))
    // FIX (Cart persistence): localStorage with 7-day TTL so abandoned carts survive
    const {setWithTTL} = await import('@/lib/storage')
    setWithTTL('print-cart', cart)
    setWithTTL('print-finish', finish)
    setUploadState({active:false,current:0,total:0,error:''})
    router.push('/checkout')
  }

  // FIX 2: CSS filter only on the photo canvas (bottom layer). Stamp canvas (top) stays unfiltered.
  const canvasCssFilter = previewSide==='front' && previewPhoto ? getFCss(previewPhoto.filter) : 'none'

  if(photos.length===0) return(
    <div style={{maxWidth:680,margin:'0 auto',padding:'40px 20px'}}>
      <h1 style={{fontFamily:'Georgia, serif',fontSize:32,fontWeight:400,color:'#2B2A28',marginBottom:6,textAlign:'center'}}>Upload your photos</h1>
      <p style={{textAlign:'center',fontSize:14,color:'#8A6F5A',marginBottom:8}}>Drop as many as you like - choose which ones to print after</p>
      <p style={{textAlign:'center',fontSize:12,color:'#8A6F5A',marginBottom:20,fontFamily:'Courier New, monospace'}}>We will automatically read the date and location from your photos</p>
      <div style={{background:'#EFE8DF',borderRadius:10,padding:'14px 16px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <p style={{fontSize:13,color:'#8A6F5A',fontStyle:'italic'}}>Create a free archive to save your photos and easily track orders</p>
        <a href="/login" style={{fontFamily:'Courier New, monospace',fontSize:10,color:'#D97A43',textDecoration:'none',letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Sign in</a>
      </div>
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
          <input ref={addMoreRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>handleInitialFiles(e.target.files)}/>
          <button onClick={()=>addMoreRef.current?.click()} style={{...C.ghost,fontSize:11,padding:'8px 14px'}}>+ Add more</button>
        </div>
      </div>

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
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))',gap:12}}>
                  {sp.map(photo=>{
                    const inOrder=photoInOrder(photo.id),isActive=photo.id===activePhotoId,isSel=selectedIds.has(photo.id)
                    return(
                      <div key={photo.id} style={{position:'relative'}}>
                        <div onClick={e=>{e.stopPropagation();toggleSelect(photo.id)}}
                          style={{position:'absolute',top:6,left:6,width:22,height:22,borderRadius:5,border:`2px solid ${isSel?'#D97A43':'rgba(255,255,255,0.9)'}`,background:isSel?'#D97A43':'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,cursor:'pointer'}}>
                          {isSel&&<span style={{color:'white',fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <div onClick={()=>{setActivePhotoId(photo.id===activePhotoId?null:photo.id);setAddedState(false)}}
                          style={{aspectRatio:'1',borderRadius:10,overflow:'hidden',border:`2.5px solid ${isActive||isSel?'#D97A43':'transparent'}`,cursor:'pointer',position:'relative'}}>
                          {/* FIX 8: removed filter style from grid thumbnails */}
                          <img src={photo.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                        </div>
                        {inOrder>0&&<div style={{position:'absolute',top:-6,right:-6,width:22,height:22,background:'#D97A43',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',border:'2px solid #F7F3EE',zIndex:10}}>{inOrder}</div>}
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
                  <div style={{display:'inline-flex',background:'rgba(43,42,40,0.06)',borderRadius:6,padding:2}}>
                    {(['front','back'] as const).map(side=>(
                      <button key={side} onClick={()=>setPreviewSide(side)}
                        style={{padding:'4px 12px',fontSize:11,fontFamily:'Courier New, monospace',border:'none',borderRadius:5,background:previewSide===side?'#F7F3EE':'transparent',color:previewSide===side?'#2B2A28':'#8A6F5A',cursor:'pointer',fontWeight:previewSide===side?600:400,letterSpacing:'0.04em',textTransform:'uppercase'}}>
                        {side}
                      </button>
                    ))}
                  </div>
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
              <div style={{background:previewSide==='back'?'#E8DECC':'#1C1A18',display:'flex',alignItems:'center',justifyContent:'center',padding:12,transition:'background 0.2s'}}>
                <div style={{position:'relative',display:'inline-block',maxWidth:'100%'}}>
                  <canvas ref={photoCanvasRef} style={{maxWidth:'100%',maxHeight:400,display:'block',borderRadius:3,filter:canvasCssFilter,transition:'filter 0.15s'}}/>
                  <canvas ref={stampCanvasRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}/>
                </div>
              </div>
            </div>
          )}

          {orderItems.length>0&&(
            <div style={{marginTop:36}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <h2 style={{fontFamily:'Georgia, serif',fontSize:26,fontWeight:400,color:'#2B2A28'}}>In your order</h2>
                <span style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#8A6F5A'}}>{totalQty} prints</span>
              </div>
              <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:12,scrollbarWidth:'none'}}>
                {orderItems.map((item,idx)=>(
                  <div key={item.id} style={{...C.card,flexShrink:0,width:210}}>
                    <div style={{position:'relative'}}>
                      <img src={item.url} alt="" style={{width:210,height:140,objectFit:'cover',display:'block',filter:getFCss(item.filter)}}/>
                      <div style={{position:'absolute',top:6,left:6,background:'rgba(43,42,40,0.72)',color:'#F7F3EE',borderRadius:4,padding:'2px 8px',fontFamily:'Courier New, monospace',fontSize:10}}>#{idx+1}</div>
                      {item.stamp.stampLocation==='back'&&(
                        <div style={{position:'absolute',bottom:5,right:5,background:'rgba(247,243,238,0.85)',color:'#5C4A3A',borderRadius:3,padding:'2px 6px',fontFamily:'Courier New, monospace',fontSize:8,letterSpacing:'0.05em'}}>BACK</div>
                      )}
                    </div>
                    <div style={{padding:'10px 12px'}}>
                      <select value={item.size} onChange={e=>setOrderItems(prev=>prev.map(i=>i.id===item.id?{...i,size:e.target.value}:i))}
                        style={{...C.select,fontSize:12,padding:'6px 8px',marginBottom:8}}>
                        {SIZES.map(s=><option key={s.key} value={s.key}>{s.label} - ${getPrice(s.key,totalQty).toFixed(2)}/ea</option>)}
                      </select>
                      <StampBullets stamp={item.stamp} filter={item.filter}/>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <button onClick={()=>updateOrderQty(item.id,-1)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(43,42,40,0.2)',background:'#F7F3EE',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>-</button>
                          <span style={{fontSize:15,fontWeight:500,minWidth:20,textAlign:'center'}}>{item.quantity}</span>
                          <button onClick={()=>updateOrderQty(item.id,1)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(43,42,40,0.2)',background:'#F7F3EE',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontFamily:'Courier New, monospace',fontSize:12,fontWeight:500}}>${(getPrice(item.size,totalQty)*item.quantity).toFixed(2)}</span>
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
                        {totalQty} prints{finish?` · ${finish} finish`:''} - shipping at checkout
                      </p>
                      <p style={{fontFamily:'Georgia, serif',fontSize:22,color:'#F7F3EE',fontWeight:400}}>${orderTotal.toFixed(2)}<span style={{fontSize:11,opacity:0.55,marginLeft:6}}>+ shipping</span></p>
                      {belowMinimum?(
                        <p style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#F5A878',letterSpacing:'0.03em',marginTop:6}}>
                          + Orders start at {MIN_ORDER_QTY} prints - add {MIN_ORDER_QTY-totalQty} more to check out
                        </p>
                      ):nextTier&&(
                        <p style={{fontFamily:'Courier New, monospace',fontSize:11,color:'#F5A878',letterSpacing:'0.03em',marginTop:6}}>
                          + Add {nextTier.needed} more print{nextTier.needed>1?'s':''} to reach the {nextTier.minQty}+ price
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
                        <button onClick={detectLocation} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#D97A43',textDecoration:'underline',padding:'4px 0',fontFamily:'inherit'}}>Detect my location</button>
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
                  {/* FIX (Compact): Front/Back as segmented buttons */}
                  <div style={{display:'flex',gap:4,padding:3,background:'#F7F3EE',borderRadius:7,border:'0.5px solid rgba(43,42,40,0.1)',marginBottom:10}}>
                    {(['front','back'] as const).map(loc=>{
                      const isActive=activePhoto.stamp.stampLocation===loc
                      return (
                        <button key={loc} onClick={()=>updateStamp(activePhoto.id,{stampLocation:loc})}
                          style={{flex:1,padding:'7px 0',background:isActive?'#F2D5C0':'transparent',border:isActive?'1px solid #D97A43':'1px solid transparent',borderRadius:5,fontSize:11,fontWeight:500,fontFamily:'Courier New, monospace',color:isActive?'#8A3A10':'#8A6F5A',cursor:'pointer',letterSpacing:'0.06em',textTransform:'uppercase'}}>
                          {loc==='front'?'Front':'Back'}
                        </button>
                      )
                    })}
                  </div>

                  {activePhoto.stamp.stampLocation==='back'?(
                    <>
                      <div style={{padding:'8px 10px',background:'rgba(217,122,67,0.08)',borderRadius:6,fontSize:11,color:'#5C4A3A',lineHeight:1.4,fontStyle:'italic',marginBottom:10}}>
                        Date and details print in black on the back. Use the BACK toggle in preview to see exactly what prints.
                      </div>
                      <span style={{...C.mono,display:'block',marginBottom:4}}>Font</span>
                      <select style={{...C.select,fontSize:13,padding:'7px 10px'}} value={activePhoto.stamp.stampFont??'classic'} onChange={e=>updateStamp(activePhoto.id,{stampFont:e.target.value as StampFont})}>
                        {STAMP_FONTS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </>
                  ):(
                    <>
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
                      <button onClick={detectBulkLocation} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#D97A43',textDecoration:'underline',padding:'4px 0',fontFamily:'inherit'}}>Detect my location</button>
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
                  <p style={{fontSize:13,color:'#2B2A28',fontWeight:500,marginBottom:10}}>Where should the stamp go?</p>
                  {(['front','back'] as const).map(loc=>{
                    const isActive=bulkSharedStampLocation===loc
                    return (
                      <label key={loc} onClick={()=>applyBulkStamp({stampLocation:loc})}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,background:isActive?'#F2D5C0':'#F7F3EE',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,marginBottom:6,cursor:'pointer',fontSize:13,color:isActive?'#8A3A10':'#2B2A28'}}>
                        <span style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${isActive?'#D97A43':'rgba(43,42,40,0.3)'}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {isActive&&<span style={{width:6,height:6,borderRadius:'50%',background:'#D97A43'}}/>}
                        </span>
                        <span style={{flex:1}}>{loc==='front'?'Front of photo':'Back of photo'}</span>
                      </label>
                    )
                  })}
                  {bulkSharedStampLocation==='mixed'&&(
                    <p style={{fontSize:11,color:'#D97A43',fontStyle:'italic',marginTop:4}}>Mixed stamp locations — pick one to apply to all</p>
                  )}

                  {bulkSharedStampLocation==='back'?(
                    /* FIX 6: updated helper text */
                    <>
                      <div style={{marginTop:14,padding:'10px 12px',background:'rgba(217,122,67,0.08)',borderRadius:6,fontSize:12,color:'#5C4A3A',lineHeight:1.5,fontStyle:'italic'}}>
                        Date and details will be printed in black on the back of each photo. Use the BACK toggle in the photo preview to see exactly what will print.
                      </div>
                      <span style={{...C.mono,display:'block',marginBottom:4,marginTop:12}}>Font</span>
                      <select style={C.select} value={bulkSharedFont==='mixed'?'':(bulkSharedFont as string ?? 'classic')} onChange={e=>applyBulkStamp({stampFont:e.target.value as StampFont})}>
                        {bulkSharedFont==='mixed'&&<option value="" disabled>Mixed — pick one</option>}
                        {STAMP_FONTS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </>
                  ):(
                    <>
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
    </div>
  )
}
