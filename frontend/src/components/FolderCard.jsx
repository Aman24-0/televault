import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Folder, Edit2, Trash2, Move, CheckSquare, Square, ChevronRight, RotateCcw, Star, Download } from 'lucide-react'

export default function FolderCard({ folder, onOpen, onRename, onDelete, onMove, onDownload, onRestore, onToggleStar, isTrash, index=0, renaming, renameVal, setRenameVal, doRename, cancelRename, isSelected, onToggleSelect }) {
  const [menu, setMenu] = useState(false)

  return (
    <motion.div
      initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.4, delay:Math.min(index*0.03,0.3), ease:[0.23, 1, 0.32, 1] }}
      className={`group relative glass-card hover:-translate-y-1 transition-all duration-300 rounded-3xl p-5 cursor-pointer select-none ${isSelected?'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]':'hover:border-white/15 hover:shadow-[0_8px_30px_-12px_rgba(255,255,255,0.1)]'} ${isTrash ? 'opacity-70 grayscale' : ''}`}
      onClick={() => renaming ? null : isSelected ? onToggleSelect() : (isTrash ? null : onOpen())}
    >
      {/* Checkbox */}
      <div className="absolute top-3.5 left-3.5 z-10" onClick={e=>{e.stopPropagation();onToggleSelect()}}>
        {isSelected
          ? <CheckSquare size={16} className="text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]"/>
          : <Square size={16} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>}
      </div>

      {/* Star Button */}
      {!isTrash && (
        <button onClick={e=>{e.stopPropagation(); onToggleStar && onToggleStar(folder.id, !folder.is_starred)}}
          className={`absolute top-3 right-10 z-10 transition-all p-1.5 hover:bg-white/10 rounded-xl ${folder.is_starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Star size={14} className={folder.is_starred ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-zinc-400 hover:text-amber-400"} />
        </button>
      )}

      {/* Menu btn */}
      <button onClick={e=>{e.stopPropagation();setMenu(m=>!m)}}
        className="absolute top-3 right-2.5 z-10 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white transition-all p-1.5 hover:bg-white/10 rounded-xl">
        ⋮
      </button>

      {/* Icon with Dynamic Glow */}
      <div className="relative flex items-center justify-center w-14 h-14 bg-white/5 rounded-2xl border border-white/10 mb-4 mt-2 mx-auto group-hover:scale-110 transition-transform duration-500 overflow-hidden">
        <div className="absolute inset-0 opacity-20 blur-md transition-opacity duration-500 group-hover:opacity-40" style={{ backgroundColor: folder.color || '#818CF8' }}/>
        <Folder size={28} className="relative z-10 drop-shadow-md" style={{ color: folder.color || '#818CF8' }}/>
      </div>

      {/* Name */}
      {renaming
        ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
            onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')cancelRename()}}
            onClick={e=>e.stopPropagation()}
            className="w-full bg-black/60 border border-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs outline-none text-center shadow-[0_0_10px_rgba(99,102,241,0.2)]"/>
        : <p className="text-[13px] font-semibold text-zinc-300 group-hover:text-white truncate text-center transition-colors tracking-tight">{folder.name}</p>}

      {/* Menu Dropdown */}
      {menu && (
        <div className="absolute right-2 top-11 glass-panel rounded-2xl shadow-2xl z-[100] py-1.5 min-w-[150px] origin-top-right animate-scale-in"
          onMouseLeave={()=>setMenu(false)}>
          {isTrash ? (
            <button onClick={e=>{e.stopPropagation();onRestore();setMenu(false)}}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-400/10 font-medium transition-colors text-left">
              <RotateCcw size={14}/> Restore
            </button>
          ) : (
            <>
              {[
                { icon:<ChevronRight size={14}/>, label:'Open',       fn:()=>{onOpen();setMenu(false)} },
                { icon:<Download size={14}/>,     label:'Download ZIP', fn:()=>{onDownload && onDownload();setMenu(false)} },
                { icon:<Move size={14}/>,         label:'Move',       fn:()=>{onMove();setMenu(false)} },
                { icon:<Edit2 size={14}/>,        label:'Rename',     fn:()=>{onRename();setMenu(false)} },
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