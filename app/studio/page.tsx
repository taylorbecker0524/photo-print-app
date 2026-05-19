'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Filter = 'original' | 'film' | 'sepia' | 'bw' | 'faded' | 'vivid' | 'cool'
type StampStyle = 'burn' | 'overlay' | 'back' | 'none'
type StampPos = 'bl' | 'br' | 'tl' | 'tr'
type StampConfig = {
  showDate: boolean; showTime: boolean; showLocation: boolean
  locationText: string; customText: string; style: StampStyle
  position: StampPos; capturedAt: string | null
  hasExifDate: boolean; hasExifLocation: boolean
  dateFormat: 'modern' | 'classic'
}
type Photo = { id: string; file: File; url: string; sessionId: string; filter: Filter; stamp: StampConfig; size: string }
type OrderItem = { id: string; photoId: string; url: string; fileName: string; filter: Filter; stamp: StampConfig; size: string; quantity: number }
type Session = { id: string; name: string; date: Date; photoIds: string[]; isRenaming: boolean }

const SIZES = [
  { key: '4x6', label: '4x6"', price: 0.99 }, { key: '5x7', label: '5x7"', price: 1.49 },
  { key: '8x10', label: '8x10"', price: 2.49 }, { key: 'square-4', label: '4x4"', price: 1.09 },
  { key: 'square-5', label: '5x5"', price: 1.49 }, { key: 'square-8', label: '8x8"', price: 2.29 },
]
const BULK = [{ min: 100, mult: 0.29 }, { min: 50, mult: 0.39 }, { min: 20, mult: 0.59 }, { min: 10, mult: 0.79 }, { min: 1, mult: 1 }]
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
const getPrice = (size: string, qty: number) => {
  const base = SIZES.find(s => s.key === size)?.price ?? 0.99
  const tier = BULK.find(t => qty >= t.min) ?? BULK[BULK.length - 1]
  return +(base * tier.mult).toFixed(2)
}
const fmtSession = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtDate = (iso: string, fmt: 'modern'|'classic' = 'classic') => { const d = new Date(iso); return fmt === 'classic' ? `${String(d.getDate()).padStart(2,'0')} ${String(d.getMonth()+1).padStart(2,'0')} ${d.getFullYear()}` : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

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

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
    const d=await r.json()
    const city=d.address?.city||d.address?.town||d.address?.village||''
    const state=d.address?.state||''
    return city&&state?`${city}, ${state}`:d.display_name?.split(',')[0]??''
  } catch { return '' }
}

const DEFAULT_STAMP: StampConfig = {
  showDate:false,showTime:false,showLocation:false,locationText:'',customText:'',
  style:'burn',position:'bl',capturedAt:null,hasExifDate:false,hasExifLocation:false,dateFormat:'classic'
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
  if(stamp.showDate&&stamp.capturedAt) items.push(fmtDate(stamp.capturedAt,stamp.dateFormat??'classic'))
  if(stamp.showTime&&stamp.capturedAt) items.push(new Date(stamp.capturedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))
  if(stamp.showLocation&&stamp.locationText) items.push(stamp.locationText)
  if(stamp.customText) items.push(stamp.customText)
  if(stamp.style!=='none') items.push(`${stamp.style==='burn'?'Classic burn':stamp.style==='overlay'?'Overlay':stamp.style==='back'?'Back of photo':'No stamp'} - ${stamp.position==='bl'?'bottom left':stamp.position==='br'?'bottom right':stamp.position==='tl'?'top left':'top right'}`)
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
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [photos,setPhotos]=useState<Photo[]>([])
  const [sessions,setSessions]=useState<Session[]>([])
  const [orderItems,setOrderItems]=useState<OrderItem[]>([])
  const [activePhotoId,setActivePhotoId]=useState<string|null>(null)
  const [previewIndex,setPreviewIndex]=useState(0)
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [renameValue,setRenameValue]=useState('')
  const [loadedImg,setLoadedImg]=useState<HTMLImageElement|null>(null)
  const [addedState,setAddedState]=useState(false)
  const [showSessionPrompt,setShowSessionPrompt]=useState(false)
  const [pendingFiles,setPendingFiles]=useState<FileList|null>(null)
  const [bulkFilter,setBulkFilter]=useState<Filter>('original')
  const [bulkStyle,setBulkStyle]=useState<StampStyle>('burn')
  const [isMobile,setIsMobile]=useState(false)

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return ()=>window.removeEventListener('resize',check)},[])  

  useEffect(()=>{
    if(photos.length===0) return
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
    window.addEventListener('beforeunload',warn)
    return ()=>window.removeEventListener('beforeunload',warn)
  },[photos.length])

  const activePhoto=photos.find(p=>p.id===activePhotoId)
  const selectedPhotos=Array.from(selectedIds).map(id=>photos.find(p=>p.id===id)).filter(Boolean) as Photo[]
  const previewPhoto=selectedPhotos.length>1?selectedPhotos[previewIndex]:activePhoto
  const totalQty=orderItems.reduce((s,i)=>s+i.quantity,0)
  const orderTotal=orderItems.reduce((s,i)=>s+getPrice(i.size,totalQty)*i.quantity,0)
  const isMultiSelect = selectedIds.size > 1

  const processFiles=useCallback(async(files:FileList,sessionId:string)=>{
    const newPhotoIds:string[]=[]
    const newPhotos:Photo[]=await Promise.all(
      Array.from(files).filter(f=>f.type.startsWith('image/')).map(async(f)=>{
        const id=Math.random().toString(36).slice(2)
        newPhotoIds.push(id)
        const exif=await readExif(f)
        let locationText='',hasExifLocation=false
        if(exif.lat!==null&&exif.lon!==null){locationText=await reverseGeocode(exif.lat,exif.lon);hasExifLocation=!!locationText}
        return{id,file:f,url:URL.createObjectURL(f),sessionId,filter:'original' as Filter,
          stamp:{...DEFAULT_STAMP,capturedAt:exif.date,hasExifDate:!!exif.date,hasExifLocation,locationText,showDate:!!exif.date,showLocation:hasExifLocation},size:'4x6'}
      })
    )
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

  useEffect(()=>{
    if(!previewPhoto) return
    const img=new Image();img.onload=()=>setLoadedImg(img);img.src=previewPhoto.url
  },[activePhotoId,previewIndex,selectedIds.size,previewPhoto?.url,previewPhoto?.filter])

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!loadedImg||!previewPhoto) return
    const maxW=Math.min(canvas.parentElement?.clientWidth??700,700),maxH=420
    let cw=Math.min(maxW,loadedImg.naturalWidth),ch=(cw/loadedImg.naturalWidth)*loadedImg.naturalHeight
    if(ch>maxH){ch=maxH;cw=(ch/loadedImg.naturalHeight)*loadedImg.naturalWidth}
    canvas.width=Math.round(cw);canvas.height=Math.round(ch)
    const ctx=canvas.getContext('2d')!
    ctx.filter=getFCss(previewPhoto.filter);ctx.drawImage(loadedImg,0,0,cw,ch);ctx.filter='none'
    const{stamp}=previewPhoto
    if(stamp.style==='none'||stamp.style==='back') return
    const lines:string[]=[]
    if(stamp.showDate&&stamp.capturedAt){const d=new Date(stamp.capturedAt);const fmt=previewPhoto.stamp.dateFormat??'classic';lines.push(fmt==='classic'?`${String(d.getDate()).padStart(2,'0')} ${String(d.getMonth()+1).padStart(2,'0')} ${d.getFullYear()}`:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));if(stamp.showTime)lines.push(d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))}
    if(stamp.showLocation&&stamp.locationText) lines.push(stamp.locationText)
    if(stamp.customText) lines.push(stamp.customText)
    if(!lines.length) return
    const fs=cw*0.022,pad=cw*0.025,lineH=fs*1.45
    ctx.font=`bold ${Math.round(fs)}px Courier New, monospace`
    const boxW=Math.max(...lines.map(l=>ctx.measureText(l).width))+pad*2,boxH=lines.length*lineH+pad*0.8
    let bx=pad,by=ch-boxH-pad
    if(stamp.position==='br') bx=cw-boxW-pad
    if(stamp.position==='tl') by=pad
    if(stamp.position==='tr'){bx=cw-boxW-pad;by=pad}
    if(stamp.style==='burn'){ctx.fillStyle='#E8841A';ctx.shadowColor='rgba(232,132,26,0.6)';ctx.shadowBlur=3;lines.forEach((l,i)=>ctx.fillText(l,bx,by+pad*0.4+(i+1)*lineH-lineH*0.2));ctx.shadowBlur=0}
    else{ctx.fillStyle='rgba(247,243,238,0.65)';ctx.fillRect(bx,by,boxW,boxH);ctx.fillStyle='rgba(43,42,40,0.85)';lines.forEach((l,i)=>ctx.fillText(l,bx+pad*0.8,by+pad*0.4+(i+1)*lineH-lineH*0.2))}
  },[loadedImg,previewPhoto?.stamp,previewPhoto?.filter])

  const updatePhoto=(id:string,u:Partial<Photo>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,...u}:p));setAddedState(false)}
  const updateStamp=(id:string,u:Partial<StampConfig>)=>{setPhotos(prev=>prev.map(p=>p.id===id?{...p,stamp:{...p.stamp,...u}}:p));setAddedState(false)}
  const detectLocation=useCallback(()=>{navigator.geolocation?.getCurrentPosition(async pos=>{const loc=await reverseGeocode(pos.coords.latitude,pos.coords.longitude);if(loc&&activePhotoId)updateStamp(activePhotoId,{locationText:loc,showLocation:true})})},[activePhotoId])

  // THE FIX: capture selectedIds snapshot at call time, apply to ALL of them
  const applyBulkFilter=(f: Filter)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,filter:f}:p))
    setBulkFilter(f)
  }
  const applyBulkStyle=(s: StampStyle)=>{
    const ids=Array.from(selectedIds)
    setPhotos(prev=>prev.map(p=>ids.includes(p.id)?{...p,stamp:{...p.stamp,style:s}}:p))
    setBulkStyle(s)
  }

  const toggleSelect=(id:string)=>{
    setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);setPreviewIndex(0);return n})
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
  const goToCheckout=()=>{sessionStorage.setItem('print-cart',JSON.stringify(orderItems.map(i=>({size:i.size,quantity:i.quantity,stamp:i.stamp,filter:i.filter,fileName:i.fileName}))));router.push('/checkout')}

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

      {/* Mobile bulk bar */}
      {isMultiSelect&&isMobile&&(
        <div style={{background:'#2B2A28',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontFamily:'Courier New, monospace',fontSize:11,color:'rgba(247,243,238,0.7)',whiteSpace:'nowrap'}}>{selectedIds.size} selected</span>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',flex:1}}>
            {FILTERS.map(f=>(
              <button key={f.key} onClick={()=>applyBulkFilter(f.key)}
                style={{padding:'5px 10px',fontSize:11,fontFamily:'Courier New, monospace',border:`1px solid ${bulkFilter===f.key?'#D97A43':'rgba(255,255,255,0.2)'}`,borderRadius:6,background:bulkFilter===f.key?'#D97A43':'transparent',cursor:'pointer',color:'rgba(247,243,238,0.9)'}}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setSelectedIds(new Set())} style={{background:'none',border:'none',color:'rgba(247,243,238,0.5)',cursor:'pointer',fontSize:18}}>x</button>
        </div>
      )}

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
                          <img src={photo.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block',filter:getFCss(photo.filter)}}/>
                          {photo.stamp.showDate&&photo.stamp.capturedAt&&photo.stamp.style==='burn'&&(
                            <div style={{position:'absolute',bottom:4,right:4,fontFamily:'Courier New, monospace',fontSize:7,color:'#E8841A',fontWeight:700,textShadow:'0 0 2px rgba(232,132,26,0.5)'}}>
                              {new Date(photo.stamp.capturedAt).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'})}
                            </div>
                          )}
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
                <span style={C.mono}>Preview {selectedPhotos.length>1?`(${previewIndex+1} of ${selectedPhotos.length})`:''}</span>
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
              <div style={{background:'#1C1A18',display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
                <canvas ref={canvasRef} style={{maxWidth:'100%',maxHeight:400,display:'block',borderRadius:3}}/>
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
                      {item.stamp.showDate&&item.stamp.capturedAt&&item.stamp.style==='burn'&&(
                        <div style={{position:'absolute',bottom:5,right:5,fontFamily:'Courier New, monospace',fontSize:8,color:'#E8841A',fontWeight:700}}>
                          {new Date(item.stamp.capturedAt).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'})}
                        </div>
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
                <div>
                  <p style={{fontFamily:'Courier New, monospace',fontSize:10,color:'rgba(247,243,238,0.55)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>{totalQty} prints - $4.99 shipping</p>
                  <p style={{fontFamily:'Georgia, serif',fontSize:22,color:'#F7F3EE',fontWeight:400}}>${(orderTotal+4.99).toFixed(2)}</p>
                </div>
                <button onClick={goToCheckout} style={{...C.accent,width:'auto',padding:'13px 24px',fontSize:13,flexShrink:0}}>Checkout</button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        {(activePhoto||selectedPhotos.length>0)&&(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* FILTER — always shows all 7, clicking applies to selected or single */}
            <div style={C.card}>
              <div style={C.head}>
                <span style={C.mono}>{isMultiSelect?`Filter — ${selectedIds.size} selected`:'Filter'}</span>
              </div>
              <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {FILTERS.map(f=>{
                  const isActive = isMultiSelect ? bulkFilter===f.key : activePhoto?.filter===f.key
                  return (
                    <button key={f.key} onClick={()=>isMultiSelect ? applyBulkFilter(f.key) : activePhoto && updatePhoto(activePhoto.id,{filter:f.key})}
                      style={{padding:'8px 4px',fontSize:11,fontFamily:'Courier New, monospace',border:`1px solid ${isActive?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:isActive?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:isActive?'#8A3A10':'#2B2A28',minHeight:36}}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
              {isMultiSelect&&<p style={{fontSize:11,color:'#8A6F5A',fontStyle:'italic',padding:'0 12px 10px',textAlign:'center'}}>Tap a filter to apply to all {selectedIds.size} selected photos</p>}
            </div>

            {/* Stamp style bulk — only when multi select */}
            {isMultiSelect&&!isMobile&&(
              <div style={C.card}>
                <div style={C.head}><span style={C.mono}>Stamp style — {selectedIds.size} selected</span></div>
                <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6}}>
                  {(['burn','overlay','back','none'] as StampStyle[]).map(s=>(
                    <button key={s} onClick={()=>applyBulkStyle(s)}
                      style={{padding:'8px',fontSize:11,fontFamily:'Courier New, monospace',border:`1px solid ${bulkStyle===s?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:bulkStyle===s?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:bulkStyle===s?'#8A3A10':'#2B2A28',minHeight:36}}>
                      {s==='burn'?'Classic burn':s==='overlay'?'Overlay':s==='back'?'Back of photo':'No stamp'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to order for multi-select */}
            {isMultiSelect&&(
              <button onClick={()=>{selectedPhotos.forEach(p=>addToOrder(p));setSelectedIds(new Set())}}
                style={{...C.accent}}>
                Add {selectedIds.size} photos to order
              </button>
            )}

            {/* Individual editor - only when single photo */}
            {activePhoto&&!isMultiSelect&&(
              <>
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
                            {(['classic','modern'] as const).map(fmt=>(
                              <button key={fmt} onClick={()=>updateStamp(activePhoto.id,{dateFormat:fmt})}
                                style={{flex:1,padding:'5px 8px',fontSize:10,fontFamily:'Courier New, monospace',border:`1px solid ${(activePhoto.stamp.dateFormat??'classic')===fmt?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:6,background:(activePhoto.stamp.dateFormat??'classic')===fmt?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:(activePhoto.stamp.dateFormat??'classic')===fmt?'#8A3A10':'#8A6F5A'}}>
                                {fmt==='classic'?'17 05 2026':'May 17, 2026'}
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
                    <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Stamp style</span>
                    <select style={C.select} value={activePhoto.stamp.style} onChange={e=>updateStamp(activePhoto.id,{style:e.target.value as StampStyle})}>
                      <option value="burn">Classic burn</option>
                      <option value="overlay">Subtle overlay</option>
                      <option value="back">Back of photo</option>
                      <option value="none">No stamp</option>
                    </select>
                    {activePhoto.stamp.style!=='back'&&activePhoto.stamp.style!=='none'&&(
                      <>
                        <span style={{...C.mono,display:'block',marginBottom:4,marginTop:10}}>Position</span>
                        <select style={C.select} value={activePhoto.stamp.position} onChange={e=>updateStamp(activePhoto.id,{position:e.target.value as StampPos})}>
                          <option value="bl">Bottom left</option>
                          <option value="br">Bottom right</option>
                          <option value="tl">Top left</option>
                          <option value="tr">Top right</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>

                <div style={C.card}>
                  <div style={C.head}><span style={C.mono}>Default size</span></div>
                  <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                    {SIZES.map(s=>(
                      <button key={s.key} onClick={()=>updatePhoto(activePhoto.id,{size:s.key})}
                        style={{padding:'8px',fontSize:12,border:`1px solid ${activePhoto.size===s.key?'#D97A43':'rgba(43,42,40,0.15)'}`,borderRadius:7,background:activePhoto.size===s.key?'#F2D5C0':'#F7F3EE',cursor:'pointer',color:activePhoto.size===s.key?'#8A3A10':'#2B2A28',fontFamily:'inherit',minHeight:40}}>{s.label}</button>
                    ))}
                  </div>
                </div>

                <button onClick={()=>addToOrder(activePhoto)} disabled={addedState}
                  style={{...C.accent,background:addedState?'#C4B5A5':'#D97A43',cursor:addedState?'default':'pointer'}}>
                  {addedState?'Added to order ✓':'Add to order with these settings'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
