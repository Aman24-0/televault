import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Image, Film, Music, Archive, FileText, Download, Share2, Trash2, Edit2, Move, Copy, CheckSquare, Square, Loader2, RotateCcw, Star } from 'lucide-react'
import { formatSize, fileTypeInfo, thumbCache } from '../lib/utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function FileCard({ file, onView, onRename, onDelete, onShare, onMove, onCopy, onRestore, onToggleStar, isTrash, index=0, renaming, renameVal, setRenameVal, doRename, cancelRename, isSelected, onToggleSelect }) {
  const [menu,  setMenu]  = useState(false)
  const [thumb, setThumb] = useState(thumbCache[file.id] || null)
  const [tl,    setTl]    = useState(!thumbCache[file.id] && !!file.thumbnail_msg_id)
  const token = localStorage.getItem('tv_token')
  const alive = useRef(true)
  const type  = fileTypeInfo(file.extension, file.mime_type)
  const isVid = file.mime_type?.startsWith('video/')

  useEffect(() => {
    alive.current = true
    if (!file.thumbnail_msg_id || thumbCache[file.id]) return
    fetch(`${API}/api/thumbnail/${file.id}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(b => {
        if (!b || !alive.current) return
        const url = URL.createObjectURL(b)
        thumbCache[file.id] = url
        setThumb(url)
      })
      .finally(() => { if(alive.current) setTl(false) })
    return () => { alive.current = false }
  }, [file.id])

  const download = async () => {
    const r = await fetch(`${API}/api/download/${file.id}`, { headers:{ Authorization:`Bearer ${token}` } })
    const b = await r.blob()
    const u = URL.createObjectURL(b)
    Object.assign(document.createElement('a'),{ href:u, download:file.name }).click()
    setTimeout(()=>URL.revokeObjectURL(u),1000)
  }

  return (
    <motion.div
      initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.4, delay:Math.min(index*0.03,0.3), ease:[0.23, 1, 0.32, 1] }}
      className={`group relative flex flex-col glass-card hover:-translate-y-1 rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer select-none ${isSelected?'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]':'hover:border-white/15 hover:shadow-[0_8px_30px_-12px_rgba(255,255,255,0.1)]'} ${isTrash ? 'opacity-70 grayscale' : ''}`}
      onClick={() => renaming ? null : isSelected ? onToggleSelect() : (isTrash ? null : onView())}
    >
      {/* Checkbox */}
      <div className="absolute top-2.5 left-2.5 z-20" onClick={e=>{e.stopPropagation();onToggleSelect()}}>
        {isSelected
          ? <div className="bg-black/60 rounded-xl p-1.5 backdrop-blur-md border border-white/10"><CheckSquare size={14} className="text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]"/></div>
          : <div className="bg-black/40 rounded-xl p-1.5 backdrop-blur-md border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"><Square size={14} className="text-white"/></div>}
      </div>

      {/* Star Button */}
      {!isTrash && (
        <button onClick={e=>{e.stopPropagation(); onToggleStar && onToggleStar(file.id, !file.is_starred)}}
          className={`absolute top-2.5 right-2.5 z-20 bg-black/40 border border-white/5 backdrop-blur-md p-1.5 rounded-xl transition-all ${file.is_starred ? 'opacity-100 border-amber-500/30' : 'opacity-0 group-hover:opacity-100'}`}>
          <Star size={14} className={file.is_starred ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-white hover:text-amber-400"} />
        </button>
      )}

      {/* Thumbnail Area */}
      <div className="h-36 bg-black/40 flex items-center justify-center relative overflow-hidden shrink-0">
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt=""/>
          : tl
            ? <Loader2 size={20} className="animate-spin text-zinc-600"/>
            : <div className={`${type.bg} ${type.color} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-xl`}>
                {getIcon(file.mime_type, file.extension)}
              </div>}
        
        {isVid && !thumb && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg">
              <Film size={16} className="text-white ml-1"/>
            </div>
          </div>
        )}
        {/* Sleek Bottom Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/20 to-transparent opacity-90"/>
      </div>

      {/* Info Area */}
      <div className="p-4 pt-2 flex items-center gap-2 relative z-10 bg-[#18181b]/40 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          {renaming
            ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')cancelRename()}}
                onClick={e=>e.stopPropagation()}
                className="w-full bg-black/80 border border-indigo-500 text-white rounded-lg px-2 py-1 text-xs outline-none shadow-[0_0_10px_rgba(99,102,241,0.2)]"/>
            : <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-white truncate transition-colors tracking-tight">{file.name}</p>}
          <p className="text-[11px] text-zinc-500 mt-1 font-mono font-medium">{formatSize(file.size_bytes)}</p>
        </div>
        <button onClick={e=>{e.stopPropagation();setMenu(m=>!m)}}
          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0 p-1.5 rounded-xl text-sm">⋮</button>
      </div>

      {/* Menu */}
      {menu && (
        <div className="absolute right-2 bottom-12 glass-panel rounded-2xl shadow-2xl z-[100] py-1.5 min-w-[160px] origin-bottom-right animate-scale-in"
          onMouseLeave={()=>setMenu(false)}>
          {isTrash ? (
            <button onClick={e=>{e.stopPropagation();onRestore();setMenu(false)}}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-400/10 font-medium transition-colors text-left">
              <RotateCcw size={14}/> Restore File
            </button>
          ) : (
            <>
              {[
                { icon:<Download size={14}/>, label:'Download', fn:()=>{download();setMenu(false)} },
                { icon:<Share2 size={14}/>,   label:'Share Securely', fn:()=>{onShare();setMenu(false)} },
                { icon:<Copy size={14}/>,     label:'Copy',     fn:()=>{onCopy && onCopy();setMenu(false)} },
                { icon:<Move size={14}/>,     label:'Move',     fn:()=>{onMove();setMenu(false)} },
                { icon:<Edit2 size={14}/>,    label:'Rename',   fn:()=>{onRename();setMenu(false)} },
              ].map(it=>(
                <button key={it.label} onClick={e=>{e.stopPropagation();it.fn()}}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white font-medium transition-colors text-left">
                  {it.icon} {it.label}
                </button>
              ))}
              <div className="h-px bg-white/10 my-1"/>
              <button onClick={e=>{e.stopPropagation();onDelete();setMenu(false)}}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 font-medium transition-colors text-left">
                <Trash2 size={14}/> Delete
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

function getIcon(mime='',ext='') {
  if (mime.startsWith('image/')) return <Image size={28}/>
  if (mime.startsWith('video/')) return <Film size={28}/>
  if (mime.startsWith('audio/')) return <Music size={28}/>
  const e=(ext||'').toLowerCase()
  if (['zip','rar','7z'].includes(e)) return <Archive size={28}/>
  return <FileText size={28}/>
}