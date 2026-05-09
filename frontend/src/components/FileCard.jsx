import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Image, Film, Music, Archive, FileText, Download, Share2, Trash2, Edit2, Move, CheckSquare, Square, Loader2, RotateCcw } from 'lucide-react'
import { formatSize, fileTypeInfo, thumbCache } from '../lib/utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function FileCard({ file, onView, onRename, onDelete, onShare, onMove, onRestore, isTrash, index=0, renaming, renameVal, setRenameVal, doRename, cancelRename, isSelected, onToggleSelect }) {
  const [menu,  setMenu]  = useState(false)
  const [thumb, setThumb] = useState(thumbCache[file.id] || null)
  const [tl,    setTl]    = useState(!thumbCache[file.id] && !!file.thumbnail_msg_id)
  const token = localStorage.getItem('tv_token')
  const alive = useRef(true)
  const type  = fileTypeInfo(file.extension, file.mime_type)
  const isImg = file.mime_type?.startsWith('image/')
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
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.2, delay:Math.min(index*0.03,0.3), ease:'easeOut' }}
      className={`group relative flex flex-col bg-white/[0.02] border ${isSelected?'border-indigo-500/60 bg-indigo-500/5':'border-white/5 hover:border-white/10 hover:bg-white/[0.03]'} rounded-2xl overflow-hidden transition-colors duration-150 cursor-pointer select-none ${isTrash ? 'opacity-80' : ''}`}
      onClick={() => renaming ? null : isSelected ? onToggleSelect() : (isTrash ? null : onView())}
    >
      {/* Checkbox */}
      <div className="absolute top-2 left-2 z-10" onClick={e=>{e.stopPropagation();onToggleSelect()}}>
        {isSelected
          ? <div className="bg-black/50 rounded-lg p-1 backdrop-blur-sm"><CheckSquare size={14} className="text-indigo-400"/></div>
          : <div className="bg-black/50 rounded-lg p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"><Square size={14} className="text-zinc-400"/></div>}
      </div>

      {/* Thumbnail */}
      <div className="h-32 bg-zinc-900/60 flex items-center justify-center relative overflow-hidden shrink-0">
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt=""/>
          : tl
            ? <Loader2 size={16} className="animate-spin text-zinc-700"/>
            : <div className={`${type.bg} ${type.color} p-3 rounded-xl group-hover:scale-110 transition-transform duration-200`}>
                {getIcon(file.mime_type, file.extension)}
              </div>}
        {isVid && !thumb && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
              <Film size={13} className="text-white ml-0.5"/>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
      </div>

      {/* Info */}
      <div className="p-3 flex items-end gap-1.5">
        <div className="flex-1 min-w-0">
          {renaming
            ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')cancelRename()}}
                onClick={e=>e.stopPropagation()}
                className="w-full bg-black/40 border border-indigo-500/50 text-white rounded-lg px-2 py-0.5 text-xs outline-none"/>
            : <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate transition-colors">{file.name}</p>}
          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{formatSize(file.size_bytes)}</p>
        </div>
        <button onClick={e=>{e.stopPropagation();setMenu(m=>!m)}}
          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-all shrink-0 px-1 text-sm">⋮</button>
      </div>

      {/* Menu */}
      {menu && (
        <div className="absolute right-1 bottom-12 bg-[#1c1c1f]/96 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[100] py-1 min-w-[140px] animate-scale-in"
          onMouseLeave={()=>setMenu(false)}>
          {isTrash ? (
            <button onClick={e=>{e.stopPropagation();onRestore();setMenu(false)}}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left">
              <RotateCcw size={12}/> Restore File
            </button>
          ) : (
            <>
              {[
                { icon:<Download size={12}/>, label:'Download', fn:()=>{download();setMenu(false)} },
                { icon:<Share2 size={12}/>,   label:'Share',    fn:()=>{onShare();setMenu(false)} },
                { icon:<Move size={12}/>,     label:'Move',     fn:()=>{onMove();setMenu(false)} },
                { icon:<Edit2 size={12}/>,    label:'Rename',   fn:()=>{onRename();setMenu(false)} },
              ].map(it=>(
                <button key={it.label} onClick={e=>{e.stopPropagation();it.fn()}}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/8 hover:text-white transition-colors text-left">
                  {it.icon} {it.label}
                </button>
              ))}
              <div className="h-px bg-white/5 my-1"/>
              <button onClick={e=>{e.stopPropagation();onDelete();setMenu(false)}}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-400 hover:bg-red-500/8 transition-colors text-left">
                <Trash2 size={12}/> Delete
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

function getIcon(mime='',ext='') {
  if (mime.startsWith('image/')) return <Image size={24}/>
  if (mime.startsWith('video/')) return <Film size={24}/>
  if (mime.startsWith('audio/')) return <Music size={24}/>
  const e=(ext||'').toLowerCase()
  if (['zip','rar','7z'].includes(e)) return <Archive size={24}/>
  return <FileText size={24}/>
}