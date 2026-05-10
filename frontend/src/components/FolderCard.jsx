import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Folder, Edit2, Trash2, Move, CheckSquare, Square, ChevronRight, RotateCcw, Star } from 'lucide-react'

export default function FolderCard({ folder, onOpen, onRename, onDelete, onMove, onRestore, onToggleStar, isTrash, index=0, renaming, renameVal, setRenameVal, doRename, cancelRename, isSelected, onToggleSelect }) {
  const [menu, setMenu] = useState(false)

  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.2, delay:Math.min(index*0.03,0.25), ease:'easeOut' }}
      className={`group relative bg-white/[0.02] border ${isSelected?'border-indigo-500/60 bg-indigo-500/5':'border-white/5 hover:border-white/10 hover:bg-white/[0.04]'} rounded-2xl p-4 transition-colors duration-150 cursor-pointer select-none ${isTrash ? 'opacity-80' : ''}`}
      onClick={() => renaming ? null : isSelected ? onToggleSelect() : (isTrash ? null : onOpen())}
    >
      {/* Checkbox */}
      <div className="absolute top-2.5 left-2.5 z-10" onClick={e=>{e.stopPropagation();onToggleSelect()}}>
        {isSelected
          ? <CheckSquare size={14} className="text-indigo-400"/>
          : <Square size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"/>}
      </div>

      {/* Star Button */}
      {!isTrash && (
        <button onClick={e=>{e.stopPropagation(); onToggleStar && onToggleStar(folder.id, !folder.is_starred)}}
          className={`absolute top-2.5 right-8 z-10 transition-all p-1 hover:bg-white/8 rounded-lg ${folder.is_starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Star size={14} className={folder.is_starred ? "text-amber-400 fill-amber-400" : "text-zinc-500 hover:text-amber-400"} />
        </button>
      )}

      {/* Menu btn */}
      <button onClick={e=>{e.stopPropagation();setMenu(m=>!m)}}
        className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-all p-1 hover:bg-white/8 rounded-lg text-sm">
        ⋮
      </button>

      {/* Icon */}
      <div className="flex items-center justify-center w-11 h-11 bg-white/5 rounded-xl border border-white/5 mb-3 mt-2 mx-auto group-hover:scale-105 transition-transform duration-200">
        <Folder size={24} style={{ color: folder.color || '#818CF8' }}/>
      </div>

      {/* Name */}
      {renaming
        ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
            onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')cancelRename()}}
            onClick={e=>e.stopPropagation()}
            className="w-full bg-black/40 border border-indigo-500/50 text-white rounded-lg px-2 py-0.5 text-xs outline-none text-center"/>
        : <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate text-center transition-colors">{folder.name}</p>}

      {/* Menu */}
      {menu && (
        <div className="absolute right-1 top-9 bg-[#1c1c1f]/96 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[100] py-1 min-w-[130px] animate-scale-in"
          onMouseLeave={()=>setMenu(false)}>
          {isTrash ? (
            <button onClick={e=>{e.stopPropagation();onRestore();setMenu(false)}}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left">
              <RotateCcw size={12}/> Restore
            </button>
          ) : (
            <>
              {[
                { icon:<ChevronRight size={12}/>, label:'Open',   fn:()=>{onOpen();setMenu(false)} },
                { icon:<Move size={12}/>,         label:'Move',   fn:()=>{onMove();setMenu(false)} },
                { icon:<Edit2 size={12}/>,        label:'Rename', fn:()=>{onRename();setMenu(false)} },
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