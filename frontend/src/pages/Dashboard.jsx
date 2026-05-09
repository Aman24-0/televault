import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudLightning, Upload, FolderPlus, Grid, List,
  Search, X, Home, ChevronRight, Check, Loader2,
  LogOut, Copy, Share2, CheckCircle, Trash2, Move,
  AlertCircle
} from 'lucide-react'
import api from '../api'
import FileCard from '../components/FileCard'
import FolderCard from '../components/FolderCard'
import MediaViewer from '../components/MediaViewer'
import useWebSocket from '../hooks/useWebSocket'
import { formatSize, formatDate } from '../lib/utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Skeleton loader for grid items
const Skeleton = () => (
  <div className="rounded-2xl overflow-hidden border border-white/5">
    <div className="h-32 skeleton"/>
    <div className="p-3 space-y-2">
      <div className="h-3 skeleton rounded-lg w-3/4"/>
      <div className="h-2 skeleton rounded-lg w-1/3"/>
    </div>
  </div>
)

export default function Dashboard() {
  const navigate = useNavigate()
  const [folders, setFolders]       = useState([])
  const [files,   setFiles]         = useState([])
  const [current, setCurrent]       = useState('root')
  const [breadcrumb, setBreadcrumb] = useState([])
  const [viewMode, setView]         = useState('grid')
  const [loading, setLoading]       = useState(false)
  const [uploads, setUploads]       = useState({})
  const [drawer,  setDrawer]        = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const [searchRes, setSearchRes]   = useState(null)
  const [renaming, setRenaming]     = useState(null)
  const [renameVal, setRenameVal]   = useState('')
  const [newFolder, setNewFolder]   = useState(false)
  const [newFolderName, setNFN]     = useState('')
  const [viewer,  setViewer]        = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [shareLink, setShareLink]   = useState('')
  const [copied, setCopied]         = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [toast,   setToast]         = useState(null)
  
  // NEW: Sorting States
  const [sortBy, setSortBy]         = useState('name')
  const [sortOrder, setSortOrder]   = useState('asc')

  const fileRef = useRef()
  const userId  = localStorage.getItem('tv_user_id')
  const name    = localStorage.getItem('tv_name') || 'User'

  // WebSocket
  const onWsMsg = useCallback((data) => {
    if (data.type === 'upload_start') {
      setUploads(u => ({ ...u, [data.file_id]: { filename:data.filename, progress:0, status:'uploading' } }))
      setDrawer(true)
    } else if (data.type === 'upload_progress') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], progress:data.progress } }))
    } else if (data.type === 'upload_complete') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], progress:100, status:'complete' } }))
      loadFolder(current)
      setTimeout(() => setUploads(u => { const n={...u}; delete n[data.file_id]; return n }), 4000)
    } else if (data.type === 'upload_failed') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], status:'failed' } }))
    }
  }, [current])

  useWebSocket(userId, onWsMsg)

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadFolder = useCallback(async (fid) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const [fr, fi] = await Promise.all([
        api.get(`/api/folders?parent_id=${fid}`),
        api.get(`/api/files?parent_id=${fid}`)
      ])
      setFolders(fr.data.folders || [])
      setFiles(fi.data.files || [])
      if (fid !== 'root') {
        const bc = await api.get(`/api/breadcrumb?folder_id=${fid}`)
        setBreadcrumb(bc.data.breadcrumb || [])
      } else {
        setBreadcrumb([])
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadFolder(current) }, [current])

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') { setSearchRes(null); setSearchQ(''); setSelected(new Set()) }
      if (e.key === 'n' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); setNewFolder(true) }
      if (e.key === 'u' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); fileRef.current?.click() }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList)
    // Parallel uploads
    await Promise.all(files.map(file => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('parent_id', current)
      return api.post('/api/upload', fd).catch(e => {
        showToast(`Failed: ${file.name}`, 'error')
      })
    }))
  }

  const doSearch = async () => {
    if (!searchQ.trim()) { setSearchRes(null); return }
    const r = await api.get(`/api/files/search?q=${encodeURIComponent(searchQ)}`)
    setSearchRes(r.data)
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    await api.post('/api/folders', { name: newFolderName.trim(), parent_id: current })
    setNewFolder(false); setNFN('')
    loadFolder(current)
    showToast('Folder created')
  }

  const deleteFolder = async (id) => {
    if (!confirm('Delete this folder and all its contents?')) return
    await api.delete(`/api/folders/${id}`)
    loadFolder(current)
    showToast('Folder deleted')
  }

  const deleteFile = async (id) => {
    if (!confirm('Delete this file?')) return
    await api.delete(`/api/files/${id}`)
    loadFolder(current)
    showToast('File deleted')
  }

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} items?`)) return
    await Promise.all([...selected].map(id => {
      if (files.find(f=>f.id===id)) return api.delete(`/api/files/${id}`)
      if (folders.find(f=>f.id===id)) return api.delete(`/api/folders/${id}`)
      return Promise.resolve()
    }))
    setSelected(new Set())
    loadFolder(current)
    showToast(`${selected.size} items deleted`)
  }

  const startRename = (item, type) => { setRenaming({id:item.id,type}); setRenameVal(item.name) }
  const doRename = async () => {
    if (!renaming || !renameVal.trim()) { setRenaming(null); return }
    const ep = renaming.type==='folder' ? `/api/folders/${renaming.id}` : `/api/files/${renaming.id}`
    await api.patch(ep, { name: renameVal.trim() })
    setRenaming(null)
    loadFolder(current)
    showToast('Renamed')
  }

  const openShare = async (file) => {
    const r = await api.post(`/api/files/${file.id}/share`, { enabled: true })
    const link = `${window.location.origin}/share/${r.data.share_token}`
    setShareLink(link); setShareModal(file)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true); setTimeout(()=>setCopied(false),2000)
    showToast('Link copied!')
  }

  const toggleSelect = (id) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const displayFolders = searchRes ? searchRes.folders : folders
  const displayFiles   = searchRes ? searchRes.files   : files
  const uploadCount    = Object.keys(uploads).length
  const totalItems     = displayFolders.length + displayFiles.length

  // NEW: Sorting Logic Implementation
  const getSortedItems = (items, type) => {
    return [...items].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortBy === 'size' && type === 'file') {
        valA = a.size_bytes || 0;
        valB = b.size_bytes || 0;
      } else if (sortBy === 'size' && type === 'folder') {
        valA = 0; // Folders don't have direct size
        valB = 0;
      } else if (sortBy === 'date') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedFolders = getSortedItems(displayFolders, 'folder');
  const sortedFiles = getSortedItems(displayFiles, 'file');

  return (
    <div className="h-screen bg-[#09090b] flex flex-col overflow-hidden"
      onDragOver={e=>{e.preventDefault();setDragOver(true)}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{e.preventDefault();setDragOver(false);handleUpload(e.dataTransfer.files)}}>

      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[400] bg-indigo-600/10 border-4 border-dashed border-indigo-500/50 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <Upload size={48} className="text-indigo-400 mx-auto mb-3"/>
              <p className="text-2xl font-bold text-indigo-300">Drop files to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
            className={`fixed top-4 right-4 z-[500] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl border ${toast.type==='error'?'bg-red-500/20 border-red-500/30 text-red-300':'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'}`}>
            {toast.type==='error'?<AlertCircle size={14}/>:<CheckCircle size={14}/>}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="shrink-0 h-14 flex items-center gap-3 px-5 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-xl">
            <CloudLightning size={16} className="text-white"/>
          </div>
          <span className="text-base font-bold text-white tracking-tight">TeleVault</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-auto relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"/>
          <input
            value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')doSearch();if(e.key==='Escape'){setSearchRes(null);setSearchQ('')}}}
            placeholder="Search files & folders... (Enter)"
            className="w-full bg-white/4 border border-white/6 focus:border-indigo-500/50 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all"
          />
          {searchRes && (
            <button onClick={()=>{setSearchRes(null);setSearchQ('')}}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
              <X size={14}/>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-600 text-xs hidden sm:block">Hi, {name}</span>
          <button onClick={()=>{localStorage.clear();navigate('/login')}}
            title="Logout"
            className="text-zinc-500 hover:text-white bg-white/4 hover:bg-white/8 p-2 rounded-xl transition-all">
            <LogOut size={15}/>
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-5 py-5">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm mb-5 flex-wrap">
            <button onClick={()=>{setCurrent('root');setSearchRes(null)}}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors">
              <Home size={14}/> <span className="hidden sm:inline">Home</span>
            </button>
            {breadcrumb.map(b=>(
              <React.Fragment key={b.id}>
                <ChevronRight size={12} className="text-zinc-700"/>
                <button onClick={()=>setCurrent(b.id)}
                  className="text-zinc-500 hover:text-white transition-colors max-w-[120px] truncate">{b.name}</button>
              </React.Fragment>
            ))}
            {searchRes && (
              <>
                <ChevronRight size={12} className="text-zinc-700"/>
                <span className="text-zinc-400">Search results for "{searchQ}"</span>
              </>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 mb-5">
            <button onClick={()=>fileRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20">
              <Upload size={15}/> Upload
            </button>
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e=>handleUpload(e.target.files)}/>

            <button onClick={()=>{setNewFolder(true);setTimeout(()=>document.getElementById('nf-input')?.focus(),50)}}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/6 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-all">
              <FolderPlus size={15}/> New Folder
            </button>

            {selected.size > 0 && (
              <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                onClick={deleteSelected}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm transition-all">
                <Trash2 size={14}/> Delete ({selected.size})
              </motion.button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* NEW: Sort Dropdown */}
              <select 
                value={`${sortBy}-${sortOrder}`} 
                onChange={e => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy); 
                  setSortOrder(newSortOrder);
                }} 
                className="hidden md:block bg-white/4 border border-white/6 hover:bg-white/8 text-zinc-300 text-sm rounded-xl px-3 py-2 outline-none transition-all cursor-pointer">
                <option value="name-asc" className="bg-[#18181b]">Name (A-Z)</option>
                <option value="name-desc" className="bg-[#18181b]">Name (Z-A)</option>
                <option value="size-desc" className="bg-[#18181b]">Size (Largest)</option>
                <option value="size-asc" className="bg-[#18181b]">Size (Smallest)</option>
                <option value="date-desc" className="bg-[#18181b]">Newest First</option>
                <option value="date-asc" className="bg-[#18181b]">Oldest First</option>
              </select>

              <div className="flex bg-white/4 border border-white/6 rounded-xl overflow-hidden">
                {[['grid',<Grid size={14}/>],['list',<List size={14}/>]].map(([m,ic])=>(
                  <button key={m} onClick={()=>setView(m)}
                    className={`px-3 py-2 transition-all ${viewMode===m?'bg-white/10 text-white':'text-zinc-500 hover:text-zinc-300'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-zinc-700 text-xs hidden md:block">{totalItems} items</span>
          </div>

          {/* New folder input */}
          <AnimatePresence>
            {newFolder && (
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                className="mb-4 overflow-hidden">
                <div className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                  <FolderPlus size={16} className="text-indigo-400"/>
                  <input id="nf-input" autoFocus value={newFolderName} onChange={e=>setNFN(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')createFolder();if(e.key==='Escape'){setNewFolder(false);setNFN('')}}}
                    placeholder="Folder name (Enter to create, Esc to cancel)"
                    className="flex-1 bg-transparent text-white outline-none text-sm placeholder-zinc-600"/>
                  <button onClick={createFolder} className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors"><Check size={16}/></button>
                  <button onClick={()=>{setNewFolder(false);setNFN('')}} className="text-zinc-500 hover:text-white p-1 transition-colors"><X size={16}/></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          {loading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {Array(12).fill(0).map((_,i)=><Skeleton key={i}/>)}
              </div>
            ) : (
              <div className="space-y-2">
                {Array(8).fill(0).map((_,i)=>(
                  <div key={i} className="h-14 skeleton rounded-xl"/>
                ))}
              </div>
            )
          ) : totalItems === 0 ? (
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-white/3 rounded-3xl flex items-center justify-center mb-5 border border-white/5">
                <CloudLightning size={36} className="text-zinc-700"/>
              </div>
              <p className="text-zinc-400 font-semibold text-lg mb-1">
                {searchRes ? 'No results found' : 'This folder is empty'}
              </p>
              <p className="text-zinc-600 text-sm">
                {!searchRes ? 'Upload files or create a new folder' : `No matches for "${searchQ}"`}
              </p>
              {!searchRes && (
                <button onClick={()=>fileRef.current?.click()}
                  className="mt-5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                  <Upload size={14}/> Upload Files
                </button>
              )}
            </motion.div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {/* UPDATED: Mapping sortedFolders and sortedFiles */}
              {sortedFolders.map((f,i)=>(
                <FolderCard key={f.id} folder={f} index={i}
                  onOpen={()=>setCurrent(f.id)}
                  onRename={()=>startRename(f,'folder')}
                  onDelete={()=>deleteFolder(f.id)}
                  onMove={()=>{}}
                  isSelected={selected.has(f.id)}
                  onToggleSelect={()=>toggleSelect(f.id)}
                  renaming={renaming?.id===f.id}
                  renameVal={renameVal} setRenameVal={setRenameVal}
                  doRename={doRename} cancelRename={()=>setRenaming(null)}/>
              ))}
              {sortedFiles.map((f,i)=>(
                <FileCard key={f.id} file={f} index={sortedFolders.length+i}
                  onView={()=>setViewer(f)}
                  onRename={()=>startRename(f,'file')}
                  onDelete={()=>deleteFile(f.id)}
                  onShare={()=>openShare(f)}
                  onMove={()=>{}}
                  isSelected={selected.has(f.id)}
                  onToggleSelect={()=>toggleSelect(f.id)}
                  renaming={renaming?.id===f.id}
                  renameVal={renameVal} setRenameVal={setRenameVal}
                  doRename={doRename} cancelRename={()=>setRenaming(null)}/>
              ))}
            </div>
          ) : (
            // List View
            <div className="bg-white/[0.015] border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs text-zinc-600 font-medium border-b border-white/5 uppercase tracking-wider">
                <div className="col-span-6">Name</div>
                <div className="col-span-2 hidden md:block">Size</div>
                <div className="col-span-2 hidden lg:block">Type</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {/* UPDATED: Mapping sortedFolders and sortedFiles */}
              {sortedFolders.map((f,i)=>(
                <motion.div key={f.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-white/4 hover:bg-white/[0.02] transition-colors items-center cursor-pointer ${selected.has(f.id)?'bg-indigo-500/5':''}`}
                  onClick={()=>selected.size>0?toggleSelect(f.id):setCurrent(f.id)}>
                  <div className="col-span-6 flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={()=>toggleSelect(f.id)}
                      onClick={e=>e.stopPropagation()} className="accent-indigo-500"/>
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                      <span style={{color:f.color||'#818CF8'}} className="text-base">📁</span>
                    </div>
                    {renaming?.id===f.id
                      ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')setRenaming(null)}}
                          onClick={e=>e.stopPropagation()} className="flex-1 bg-zinc-800 text-white rounded px-2 py-0.5 text-sm outline-none border border-indigo-500/50"/>
                      : <span className="text-sm text-zinc-200 truncate">{f.name}</span>}
                  </div>
                  <div className="col-span-2 hidden md:block text-zinc-600 text-xs">—</div>
                  <div className="col-span-2 hidden lg:block text-xs text-zinc-600">Folder</div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button onClick={e=>{e.stopPropagation();startRename(f,'folder')}} className="text-zinc-600 hover:text-white transition-colors p-1"><span className="text-xs">✏️</span></button>
                    <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} className="text-zinc-600 hover:text-red-400 transition-colors p-1"><Trash2 size={13}/></button>
                  </div>
                </motion.div>
              ))}
              {sortedFiles.map((f,i)=>(
                <motion.div key={f.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:(sortedFolders.length+i)*0.02}}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors items-center cursor-pointer ${selected.has(f.id)?'bg-indigo-500/5':''}`}
                  onClick={()=>selected.size>0?toggleSelect(f.id):setViewer(f)}>
                  <div className="col-span-6 flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={()=>toggleSelect(f.id)}
                      onClick={e=>e.stopPropagation()} className="accent-indigo-500"/>
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0 text-sm">
                      {f.mime_type?.startsWith('image/')?'🖼️':f.mime_type?.startsWith('video/')?'🎬':f.mime_type?.startsWith('audio/')?'🎵':'📄'}
                    </div>
                    {renaming?.id===f.id
                      ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')setRenaming(null)}}
                          onClick={e=>e.stopPropagation()} className="flex-1 bg-zinc-800 text-white rounded px-2 py-0.5 text-sm outline-none border border-indigo-500/50"/>
                      : <span className="text-sm text-zinc-200 truncate">{f.name}</span>}
                  </div>
                  <div className="col-span-2 hidden md:block text-zinc-500 text-xs">{formatSize(f.size_bytes)}</div>
                  <div className="col-span-2 hidden lg:block text-xs text-zinc-600 uppercase">{f.extension||'?'}</div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <button onClick={async e=>{e.stopPropagation();const r=await fetch(`${API}/api/download/${f.id}`,{headers:{Authorization:`Bearer ${localStorage.getItem('tv_token')}`}});const b=await r.blob();const u=URL.createObjectURL(b);Object.assign(document.createElement('a'),{href:u,download:f.name}).click();URL.revokeObjectURL(u)}} className="text-zinc-600 hover:text-emerald-400 transition-colors p-1 text-xs">⬇️</button>
                    <button onClick={e=>{e.stopPropagation();openShare(f)}} className="text-zinc-600 hover:text-blue-400 transition-colors p-1"><Share2 size={13}/></button>
                    <button onClick={e=>{e.stopPropagation();startRename(f,'file')}} className="text-zinc-600 hover:text-white transition-colors p-1 text-xs">✏️</button>
                    <button onClick={e=>{e.stopPropagation();deleteFile(f.id)}} className="text-zinc-600 hover:text-red-400 transition-colors p-1"><Trash2 size={13}/></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Drawer */}
      <AnimatePresence>
        {uploadCount > 0 && (
          <motion.div
            initial={{y:100,opacity:0}} animate={{y:0,opacity:1}} exit={{y:100,opacity:0}}
            transition={{type:'spring',stiffness:300,damping:30}}
            className="fixed bottom-5 right-5 w-72 bg-[#18181b]/95 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl overflow-hidden z-[200]">
            <div className="flex items-center justify-between px-4 py-3 bg-white/4 border-b border-white/5 cursor-pointer"
              onClick={()=>setDrawer(d=>!d)}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"/>
                <span className="text-sm font-semibold text-white">Uploads ({uploadCount})</span>
              </div>
              <span className="text-zinc-500 text-xs">{drawer?'▼':'▲'}</span>
            </div>
            {drawer && (
              <div className="p-4 max-h-60 overflow-auto space-y-3">
                {Object.values(uploads).map((u,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-300 truncate max-w-[160px] font-medium">{u.filename}</span>
                      <span className="text-zinc-500 shrink-0 ml-2">
                        {u.status==='complete'?<span className="text-emerald-400">✓</span>:u.status==='failed'?<span className="text-red-400">✗</span>:`${u.progress}%`}
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        animate={{width:`${u.progress}%`}} transition={{duration:0.3}}
                        className={`h-full rounded-full ${u.status==='complete'?'bg-emerald-500':u.status==='failed'?'bg-red-500':'bg-gradient-to-r from-indigo-500 to-blue-500'}`}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Viewer */}
      <AnimatePresence>
        {viewer && <MediaViewer file={viewer} onClose={()=>setViewer(null)}/>}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[250] px-4"
            onClick={()=>setShareModal(null)}>
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
              transition={{type:'spring',stiffness:300,damping:30}}
              className="bg-[#18181b] border border-white/8 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white flex items-center gap-2 text-base">
                  <Share2 size={16} className="text-indigo-400"/> Share File
                </h3>
                <button onClick={()=>setShareModal(null)} className="text-zinc-500 hover:text-white"><X size={18}/></button>
              </div>
              <p className="text-zinc-500 text-sm mb-4 truncate">{shareModal.name}</p>
              <div className="flex gap-2 mb-4">
                <input readOnly value={shareLink}
                  className="flex-1 bg-[#09090b] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-zinc-300 outline-none font-mono"/>
                <button onClick={copyLink}
                  className={`px-3 py-2.5 rounded-xl transition-all ${copied?'bg-emerald-600':'bg-indigo-600 hover:bg-indigo-500'}`}>
                  {copied?<CheckCircle size={15} className="text-white"/>:<Copy size={15} className="text-white"/>}
                </button>
              </div>
              <button onClick={async()=>{await api.post(`/api/files/${shareModal.id}/share`,{enabled:false});setShareModal(null);showToast('Link disabled')}}
                className="w-full bg-white/4 hover:bg-white/8 border border-white/6 text-zinc-400 hover:text-white py-2.5 rounded-xl text-sm transition-all">
                Disable Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}