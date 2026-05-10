import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudLightning, Upload, FolderPlus, Grid, List,
  Search, X, Home, ChevronRight, Check, Loader2,
  LogOut, Copy, Share2, CheckCircle, Trash2, Move,
  AlertCircle, RotateCcw, Star, Download, PieChart, Lock, Clock, Plus
} from 'lucide-react'
import { auth } from '../lib/firebase'
import { signOut } from 'firebase/auth'
import api from '../api'
import FileCard from '../components/FileCard'
import FolderCard from '../components/FolderCard'
import MediaViewer from '../components/MediaViewer'
import useWebSocket from '../hooks/useWebSocket'
import { formatSize } from '../lib/utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const Skeleton = () => (
  <div className="glass-card rounded-3xl overflow-hidden">
    <div className="h-36 bg-white/5 animate-pulse"/>
    <div className="p-4 space-y-2">
      <div className="h-3 bg-white/5 rounded-lg w-3/4 animate-pulse"/>
      <div className="h-2 bg-white/5 rounded-lg w-1/3 animate-pulse"/>
    </div>
  </div>
)

const StatRow = ({color, label, value, total, icon}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color} shadow-[0_0_10px_currentColor]`}/>
        <span className="text-zinc-300 flex items-center gap-2 font-medium">{icon} {label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-zinc-500 w-10 text-right font-mono">{pct}%</span>
        <span className="text-white font-bold w-20 text-right font-mono">{formatSize(value)}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab]   = useState('files')
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
  const [sharePwd, setSharePwd]     = useState('')
  const [shareExp, setShareExp]     = useState(0)
  
  const [copied, setCopied]         = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [toast,   setToast]         = useState(null)
  const [sortBy, setSortBy]         = useState('name')
  const [sortOrder, setSortOrder]   = useState('asc')

  const [actionModal, setActionModal] = useState(null) 
  const [allFoldersList, setAllFoldersList] = useState([])
  const [destFolder, setDestFolder] = useState('root')

  const [showStats, setShowStats] = useState(false)
  const [stats, setStats]         = useState(null)

  const fileRef = useRef()
  const userId  = localStorage.getItem('tv_user_id')
  const name    = localStorage.getItem('tv_name') || 'User'
  const [tgConnected, setTgConnected] = useState(true)

  useEffect(() => {
    api.get('/api/auth/me').then(res => {
      setTgConnected(res.data.session !== 'PLACEHOLDER_SESSION')
    }).catch(() => {})
  }, [])

  const onWsMsg = useCallback((data) => {
    if (activeTab !== 'files') return;
    if (data.type === 'upload_progress') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], progress: data.progress } }))
    } else if (data.type === 'upload_complete') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], progress: 100, status: 'complete' } }))
      loadFolder(current)
      setTimeout(() => setUploads(u => { const n={...u}; delete n[data.file_id]; return n }), 4000)
    } else if (data.type === 'upload_failed') {
      setUploads(u => ({ ...u, [data.file_id]: { ...u[data.file_id], status: 'failed' } }))
    }
  }, [current, activeTab])

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

  const loadTrash = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const r = await api.get('/api/trash')
      setFolders(r.data.folders || [])
      setFiles(r.data.files || [])
      setBreadcrumb([])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadStarred = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const r = await api.get('/api/starred')
      setFolders(r.data.folders || [])
      setFiles(r.data.files || [])
      setBreadcrumb([])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === 'files') loadFolder(current)
    else if (activeTab === 'trash') loadTrash()
    else if (activeTab === 'starred') loadStarred()
  }, [current, activeTab, loadFolder, loadTrash, loadStarred])

  useEffect(() => {
    const fn = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'Escape') { setSearchRes(null); setSearchQ(''); setSelected(new Set()); setActionModal(null); setShowStats(false); setShareModal(null); }
      if (activeTab === 'files' && e.key === 'n' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); setNewFolder(true) }
      if (activeTab === 'files' && e.key === 'u' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); fileRef.current?.click() }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [activeTab])

  const handleUpload = async (fileList) => {
    if (activeTab !== 'files') return;
    if (!tgConnected) {
      showToast('Please connect your Telegram account first', 'error')
      return
    }
    const filesArr = Array.from(fileList);
    const CHUNK_SIZE = 5 * 1024 * 1024;

    for (const file of filesArr) {
      const fileId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      setUploads(u => ({ ...u, [fileId]: { filename: file.name, progress: 0, status: 'uploading' } }));
      setDrawer(true);

      let failed = false;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);

        const fd = new FormData();
        fd.append('file_id', fileId);
        fd.append('filename', file.name);
        fd.append('mime_type', file.type || 'application/octet-stream');
        fd.append('parent_id', current);
        fd.append('chunk_index', i);
        fd.append('total_chunks', totalChunks);
        fd.append('file', chunk);

        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
          try {
            await api.post('/api/upload/chunk', fd);
            success = true;
            const pct = Math.round(((i + 1) / totalChunks) * 50);
            setUploads(u => ({ ...u, [fileId]: { ...u[fileId], progress: pct } }));
          } catch (err) {
            retries--;
            if (retries === 0) failed = true;
            else await new Promise(r => setTimeout(r, 2000));
          }
        }
        if (failed) break;
      }
      if (failed) {
        setUploads(u => ({ ...u, [fileId]: { ...u[fileId], status: 'failed' } }));
        showToast(`Failed to upload ${file.name} due to network issue`, 'error');
      }
    }
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
    if (!confirm('Move folder to Trash?')) return
    await api.delete(`/api/folders/${id}`)
    activeTab === 'starred' ? loadStarred() : loadFolder(current)
    showToast('Folder moved to Trash')
  }

  const deleteFile = async (id) => {
    if (!confirm('Move file to Trash?')) return
    await api.delete(`/api/files/${id}`)
    activeTab === 'starred' ? loadStarred() : loadFolder(current)
    showToast('File moved to Trash')
  }

  const deleteSelected = async () => {
    if (!confirm(`Move ${selected.size} items to Trash?`)) return
    await Promise.all([...selected].map(id => {
      if (files.find(f=>f.id===id)) return api.delete(`/api/files/${id}`)
      if (folders.find(f=>f.id===id)) return api.delete(`/api/folders/${id}`)
      return Promise.resolve()
    }))
    setSelected(new Set())
    activeTab === 'starred' ? loadStarred() : loadFolder(current)
    showToast(`${selected.size} items moved to Trash`)
  }

  const restoreItem = async (id, type) => {
    try {
      await api.post(`/api/restore/${id}?type=${type}`)
      loadTrash()
      showToast('Item restored successfully')
    } catch (err) {
      showToast('Failed to restore item', 'error')
    }
  }

  const emptyTrash = async () => {
    if (!confirm('Are you sure you want to permanently delete ALL items in Trash? This cannot be undone.')) return
    try {
      await api.delete('/api/trash')
      loadTrash()
      showToast('Trash emptied permanently')
    } catch (err) {
      showToast('Failed to empty trash', 'error')
    }
  }

  const toggleStar = async (id, type, currentStarStatus) => {
    try {
      const ep = type === 'folder' ? `/api/folders/${id}` : `/api/files/${id}`
      await api.patch(ep, { is_starred: currentStarStatus })
      
      if (activeTab === 'files') loadFolder(current)
      else if (activeTab === 'starred') loadStarred()
      
      showToast(currentStarStatus ? 'Added to Starred' : 'Removed from Starred')
    } catch (err) {
      showToast('Failed to update status', 'error')
    }
  }

  const startRename = (item, type) => { setRenaming({id:item.id,type}); setRenameVal(item.name) }
  const doRename = async () => {
    if (!renaming || !renameVal.trim()) { setRenaming(null); return }
    const ep = renaming.type==='folder' ? `/api/folders/${renaming.id}` : `/api/files/${renaming.id}`
    await api.patch(ep, { name: renameVal.trim() })
    setRenaming(null)
    activeTab === 'starred' ? loadStarred() : loadFolder(current)
    showToast('Renamed')
  }

  const openShareModal = (file) => {
    setShareModal(file);
    setShareLink('');
    setSharePwd('');
    setShareExp(0);
  }

  const generateSecureShare = async () => {
    try {
      const payload = { enabled: true };
      if (sharePwd.trim()) payload.password = sharePwd.trim();
      if (shareExp > 0) payload.expires_in_hours = Number(shareExp);

      const r = await api.post(`/api/files/${shareModal.id}/share`, payload);
      const link = `${window.location.origin}/share/${r.data.share_token}`;
      setShareLink(link);
      showToast('Secure link generated!');
    } catch (e) {
      showToast('Failed to generate link', 'error');
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true); setTimeout(()=>setCopied(false),2000)
    showToast('Link copied!')
  }

  const downloadFolder = async (folder) => {
    showToast(`Preparing ZIP for ${folder.name}... This might take a while depending on size.`, 'success');
    try {
      const r = await fetch(`${API}/api/download/folder/${folder.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('tv_token')}` }
      });
      if (!r.ok) {
        const errData = await r.json();
        throw new Error(errData.detail || 'Failed to download folder');
      }
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      Object.assign(document.createElement('a'), { href: u, download: `${folder.name}.zip` }).click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const toggleSelect = (id) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const openActionModal = async (item, itemType, action) => {
    setActionModal({ action, item, itemType });
    setDestFolder(current === 'root' || activeTab === 'starred' ? 'root' : current);
    try {
      const r = await api.get('/api/folders?all=true');
      setAllFoldersList(r.data.folders || []);
    } catch(e) { console.error(e) }
  }

  const submitAction = async () => {
    if (!actionModal) return;
    const { action, item, itemType } = actionModal;
    try {
      if (action === 'move') {
        const ep = itemType === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
        await api.patch(ep, { parent_id: destFolder });
        showToast(`${itemType === 'folder' ? 'Folder' : 'File'} moved successfully!`);
      } else if (action === 'copy' && itemType === 'file') {
        await api.post(`/api/files/${item.id}/copy`, { parent_id: destFolder });
        showToast('File copied instantly!');
      }
      setActionModal(null);
      activeTab === 'starred' ? loadStarred() : loadFolder(current);
    } catch(e) { 
      showToast(`Failed to ${action}`, 'error'); 
    }
  }

  const openStats = async () => {
    setShowStats(true);
    setStats(null); 
    try {
      const r = await api.get('/api/stats');
      setStats(r.data);
    } catch(e) { 
      showToast('Failed to load stats', 'error');
    }
  }

  const displayFolders = searchRes ? searchRes.folders : folders
  const displayFiles   = searchRes ? searchRes.files   : files
  const uploadCount    = Object.keys(uploads).length
  const totalItems     = displayFolders.length + displayFiles.length

  const getSortedItems = (items, type) => {
    return [...items].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') { valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); }
      else if (sortBy === 'size' && type === 'file') { valA = a.size_bytes || 0; valB = b.size_bytes || 0; }
      else if (sortBy === 'size' && type === 'folder') { valA = 0; valB = 0; }
      else if (sortBy === 'date') { valA = new Date(a.created_at || 0).getTime(); valB = new Date(b.created_at || 0).getTime(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedFolders = getSortedItems(displayFolders, 'folder');
  const sortedFiles = getSortedItems(displayFiles, 'file');
  const isTrash = activeTab === 'trash';
  const isStarred = activeTab === 'starred';

  return (
    <div className="h-screen bg-[#050505] flex flex-col overflow-hidden relative"
      onDragOver={e=>{if(!isTrash && !isStarred){e.preventDefault();setDragOver(true)}}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{if(!isTrash && !isStarred){e.preventDefault();setDragOver(false);handleUpload(e.dataTransfer.files)}}}>

      {/* AMBIENT BACKGROUND BLOBS */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none mix-blend-screen" />

      <AnimatePresence>
        {dragOver && !isTrash && !isStarred && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[400] bg-indigo-900/20 border-4 border-dashed border-indigo-400/50 flex items-center justify-center backdrop-blur-md">
            <div className="text-center p-10 glass-card rounded-3xl">
              <Upload size={64} className="text-indigo-400 mx-auto mb-4 animate-bounce"/>
              <p className="text-3xl font-black text-white tracking-tight">Drop files to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}}
            className={`fixed top-6 right-6 z-[500] flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl glass-panel ${toast.type==='error'?'border-red-500/30 text-red-300':'border-emerald-500/30 text-emerald-300'}`}>
            {toast.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING HEADER */}
      <header className="m-4 md:m-6 rounded-3xl glass-panel shrink-0 h-16 flex items-center gap-4 px-6 z-50 relative">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <CloudLightning size={18} className="text-white"/>
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight hidden sm:block">TeleVault</span>
        </div>

        <div className="flex-1 max-w-xl mx-auto relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
          <input
            value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')doSearch();if(e.key==='Escape'){setSearchRes(null);setSearchQ('')}}}
            placeholder="Search files & folders..."
            className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all shadow-inner"
          />
          {searchRes && (
            <button onClick={()=>{setSearchRes(null);setSearchQ('')}}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-1 rounded-full text-zinc-300 hover:text-white transition-colors">
              <X size={14}/>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-zinc-400 font-medium text-sm hidden lg:block bg-white/5 px-3 py-1.5 rounded-full border border-white/5">Hi, {name}</span>
          
          <button onClick={openStats} title="Storage Analytics"
            className="text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 p-2.5 rounded-xl transition-all border border-indigo-500/20">
            <PieChart size={18}/>
          </button>

          <button onClick={async () => {
              try { await signOut(auth) } catch (e) {}
              localStorage.clear()
              navigate('/login')
            }} title="Logout"
            className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 p-2.5 rounded-xl transition-all border border-red-500/20">
            <LogOut size={18}/>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto z-10 relative px-4 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto">

          {/* Navigation / Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap glass-panel px-5 py-3 rounded-2xl w-fit">
            <button onClick={()=>{setActiveTab('files');setCurrent('root');setSearchRes(null)}}
              className={`font-bold transition-all px-3 py-1.5 rounded-lg ${activeTab==='files' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
              My Drive
            </button>
            <button onClick={()=>{setActiveTab('starred');setSearchRes(null)}}
              className={`flex items-center gap-1.5 font-bold transition-all px-3 py-1.5 rounded-lg ${activeTab==='starred' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-amber-300 hover:bg-white/5'}`}>
              <Star size={14} className={activeTab==='starred' ? 'fill-amber-400' : ''}/> Starred
            </button>
            <button onClick={()=>{setActiveTab('trash');setSearchRes(null)}}
              className={`flex items-center gap-1.5 font-bold transition-all px-3 py-1.5 rounded-lg ${isTrash ? 'bg-red-500/20 text-red-300' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
              <Trash2 size={14}/> Trash
            </button>

            {activeTab === 'files' && breadcrumb.map(b=>(
              <React.Fragment key={b.id}>
                <ChevronRight size={14} className="text-zinc-600"/>
                <button onClick={()=>setCurrent(b.id)}
                  className="text-zinc-300 hover:text-white font-semibold transition-colors max-w-[120px] truncate bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-sm">{b.name}</button>
              </React.Fragment>
            ))}
            {searchRes && (
              <>
                <ChevronRight size={14} className="text-zinc-600"/>
                <span className="text-zinc-300 font-semibold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">Search results for "{searchQ}"</span>
              </>
            )}
          </div>

          {/* Telegram Connection Alert */}
          {!tgConnected && !isTrash && !isStarred && (
            <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-0.5">Telegram Not Connected</h4>
                  <p className="text-sm text-zinc-400">Connect your Telegram account to start uploading files securely.</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/connect-telegram')}
                className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-extrabold px-6 py-3 rounded-xl transition-all shrink-0 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
              >
                Connect Now
              </button>
            </div>
          )}

          {/* Floating Action Toolbar */}
          <div className="flex items-center gap-3 mb-8 bg-white/[0.02] border border-white/5 p-2 rounded-3xl backdrop-blur-md">
            {(!isTrash && !isStarred) ? (
              <>
                <button 
                  onClick={() => tgConnected ? fileRef.current?.click() : showToast('Connect Telegram first', 'error')}
                  className={`flex items-center gap-2 font-bold px-6 py-3 rounded-2xl text-sm transition-all shadow-lg ${tgConnected ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                >
                  <Upload size={16}/> Upload Files
                </button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={e=>handleUpload(e.target.files)}/>

                <button onClick={()=>{setNewFolder(true);setTimeout(()=>document.getElementById('nf-input')?.focus(),50)}}
                  className="flex items-center gap-2 glass-card hover:bg-white/10 text-zinc-200 hover:text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5">
                  <FolderPlus size={16}/> New Folder
                </button>

                {selected.size > 0 && (
                  <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={deleteSelected}
                    className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-bold px-5 py-3 rounded-2xl text-sm transition-all hover:-translate-y-0.5">
                    <Trash2 size={15}/> Move to Trash ({selected.size})
                  </motion.button>
                )}
              </>
            ) : isTrash ? (
              <button onClick={emptyTrash} disabled={totalItems === 0}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-bold px-6 py-3 rounded-2xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={15}/> Empty Trash
              </button>
            ) : null}

            {isStarred && selected.size > 0 && (
              <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={deleteSelected}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-bold px-5 py-3 rounded-2xl text-sm transition-all">
                <Trash2 size={15}/> Move to Trash ({selected.size})
              </motion.button>
            )}

            <div className="ml-auto flex items-center gap-3 pr-2">
              <select 
                value={`${sortBy}-${sortOrder}`} 
                onChange={e => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy); setSortOrder(newSortOrder);
                }} 
                className="hidden md:block bg-[#18181b] border border-white/10 hover:bg-white/5 text-zinc-300 font-medium text-sm rounded-xl px-4 py-2.5 outline-none transition-all cursor-pointer">
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-desc">Size (Largest)</option>
                <option value="size-asc">Size (Smallest)</option>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
              </select>

              <div className="flex bg-[#18181b] border border-white/10 rounded-xl overflow-hidden p-0.5">
                {[['grid',<Grid size={15}/>],['list',<List size={15}/>]].map(([m,ic])=>(
                  <button key={m} onClick={()=>setView(m)}
                    className={`px-3.5 py-2 rounded-lg transition-all ${viewMode===m?'bg-white/10 text-white shadow-sm':'text-zinc-500 hover:text-zinc-300'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {newFolder && !isTrash && !isStarred && (
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
                className="mb-6">
                <div className="flex items-center gap-3 glass-card rounded-2xl px-5 py-4 w-full max-w-md shadow-2xl">
                  <div className="p-2 bg-indigo-500/20 rounded-xl"><FolderPlus size={20} className="text-indigo-400"/></div>
                  <input id="nf-input" autoFocus value={newFolderName} onChange={e=>setNFN(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')createFolder();if(e.key==='Escape'){setNewFolder(false);setNFN('')}}}
                    placeholder="Enter folder name..."
                    className="flex-1 bg-transparent text-white font-medium outline-none text-base placeholder-zinc-600"/>
                  <button onClick={createFolder} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 p-2 rounded-xl transition-colors"><Check size={18}/></button>
                  <button onClick={()=>{setNewFolder(false);setNFN('')}} className="bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-colors"><X size={18}/></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          {loading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array(12).fill(0).map((_,i)=><Skeleton key={i}/>)}
              </div>
            ) : (
              <div className="space-y-3">
                {Array(8).fill(0).map((_,i)=>(
                  <div key={i} className="h-16 glass-card rounded-2xl animate-pulse"/>
                ))}
              </div>
            )
          ) : totalItems === 0 ? (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
              className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-24 h-24 glass-card rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl border border-white/10">
                {isTrash ? <Trash2 size={40} className="text-zinc-600"/> : isStarred ? <Star size={40} className="text-zinc-600"/> : <CloudLightning size={40} className="text-zinc-600"/>}
              </div>
              <p className="text-white font-extrabold text-2xl mb-2 tracking-tight">
                {isTrash ? 'Trash is empty' : isStarred ? 'No starred items' : searchRes ? 'No results found' : 'This folder is empty'}
              </p>
              <p className="text-zinc-500 font-medium">
                {isTrash ? 'Items moved to trash will appear here' : isStarred ? 'Star files or folders to find them easily here' : !searchRes ? 'Upload files or create a new folder' : `No matches for "${searchQ}"`}
              </p>
              {!searchRes && !isTrash && !isStarred && (
                <button onClick={()=>fileRef.current?.click()}
                  className="mt-8 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-all border border-white/5 hover:border-white/10">
                  <Upload size={16}/> Upload Files Now
                </button>
              )}
            </motion.div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5">
              {sortedFolders.map((f,i)=>(
                <FolderCard key={f.id} folder={f} index={i}
                  onOpen={()=>{if(isStarred){setActiveTab('files');setCurrent(f.id)}else{setCurrent(f.id)}}}
                  onRename={()=>startRename(f,'folder')}
                  onDelete={()=>deleteFolder(f.id)}
                  onMove={()=>openActionModal(f, 'folder', 'move')}
                  onDownload={()=>downloadFolder(f)}
                  onRestore={()=>restoreItem(f.id, 'folder')}
                  onToggleStar={(id, val)=>toggleStar(id, 'folder', val)}
                  isTrash={isTrash}
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
                  onShare={()=>openShareModal(f)} 
                  onMove={()=>openActionModal(f, 'file', 'move')}
                  onCopy={()=>openActionModal(f, 'file', 'copy')}
                  onRestore={()=>restoreItem(f.id, 'file')}
                  onToggleStar={(id, val)=>toggleStar(id, 'file', val)}
                  isTrash={isTrash}
                  isSelected={selected.has(f.id)}
                  onToggleSelect={()=>toggleSelect(f.id)}
                  renaming={renaming?.id===f.id}
                  renameVal={renameVal} setRenameVal={setRenameVal}
                  doRename={doRename} cancelRename={()=>setRenaming(null)}/>
              ))}
            </div>
          ) : (
            // List View Enhanced
            <div className="glass-card rounded-3xl overflow-hidden shadow-2xl">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs text-zinc-500 font-bold border-b border-white/10 uppercase tracking-wider bg-black/40">
                <div className="col-span-6">Name</div>
                <div className="col-span-2 hidden md:block">Size</div>
                <div className="col-span-2 hidden lg:block">Type</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {sortedFolders.map((f,i)=>(
                <motion.div key={f.id} initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} transition={{delay:i*0.02}}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center cursor-pointer ${selected.has(f.id)?'bg-indigo-500/10 border-l-4 border-l-indigo-500':'border-l-4 border-l-transparent'} ${isTrash?'opacity-70':''}`}
                  onClick={()=>renaming?.id===f.id ? null : selected.size>0?toggleSelect(f.id):(!isTrash && (isStarred ? (setActiveTab('files'), setCurrent(f.id)) : setCurrent(f.id)))}>
                  <div className="col-span-6 flex items-center gap-4">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={()=>toggleSelect(f.id)}
                      onClick={e=>e.stopPropagation()} className="accent-indigo-500 w-4 h-4 rounded"/>
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                      <Folder size={20} style={{color:f.color||'#818CF8'}}/>
                    </div>
                    {renaming?.id===f.id
                      ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')setRenaming(null)}}
                          onClick={e=>e.stopPropagation()} className="flex-1 bg-black/80 text-white rounded-lg px-3 py-1 text-sm outline-none border border-indigo-500 font-medium"/>
                      : <span className="text-sm font-bold text-zinc-200 truncate flex items-center gap-2">
                          {f.name}
                          {f.is_starred && <Star size={14} className="text-amber-400 fill-amber-400 inline drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]"/>}
                        </span>}
                  </div>
                  <div className="col-span-2 hidden md:block text-zinc-600 text-sm font-medium">—</div>
                  <div className="col-span-2 hidden lg:block text-xs font-bold text-zinc-500 tracking-wider">FOLDER</div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {isTrash ? (
                      <button onClick={e=>{e.stopPropagation();restoreItem(f.id, 'folder')}} className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                        <RotateCcw size={14}/> Restore
                      </button>
                    ) : (
                      <>
                        <button onClick={e=>{e.stopPropagation();toggleStar(f.id,'folder',!f.is_starred)}} className="text-zinc-500 hover:text-amber-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title={f.is_starred?"Unstar":"Star"}><Star size={16} className={f.is_starred ? "fill-amber-400 text-amber-400" : ""}/></button>
                        <button onClick={e=>{e.stopPropagation();downloadFolder(f)}} className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Download ZIP"><Download size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();openActionModal(f,'folder','move')}} className="text-zinc-500 hover:text-amber-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Move"><Move size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();startRename(f,'folder')}} className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"><Edit2 size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} className="text-zinc-500 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-lg"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {sortedFiles.map((f,i)=>(
                <motion.div key={f.id} initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} transition={{delay:(sortedFolders.length+i)*0.02}}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors items-center cursor-pointer ${selected.has(f.id)?'bg-indigo-500/10 border-l-4 border-l-indigo-500':'border-l-4 border-l-transparent'} ${isTrash?'opacity-70':''}`}
                  onClick={()=>renaming?.id===f.id ? null : selected.size>0?toggleSelect(f.id):(!isTrash && setViewer(f))}>
                  <div className="col-span-6 flex items-center gap-4">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={()=>toggleSelect(f.id)}
                      onClick={e=>e.stopPropagation()} className="accent-indigo-500 w-4 h-4 rounded"/>
                    <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center shrink-0 text-lg border border-white/10 shadow-inner">
                      {f.mime_type?.startsWith('image/')?'🖼️':f.mime_type?.startsWith('video/')?'🎬':f.mime_type?.startsWith('audio/')?'🎵':'📄'}
                    </div>
                    {renaming?.id===f.id
                      ? <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onBlur={doRename} onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')setRenaming(null)}}
                          onClick={e=>e.stopPropagation()} className="flex-1 bg-black/80 text-white rounded-lg px-3 py-1 text-sm outline-none border border-indigo-500 font-medium"/>
                      : <span className="text-sm font-bold text-zinc-200 truncate flex items-center gap-2">
                          {f.name}
                          {f.is_starred && <Star size={14} className="text-amber-400 fill-amber-400 inline drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]"/>}
                        </span>}
                  </div>
                  <div className="col-span-2 hidden md:block text-zinc-400 text-sm font-mono font-medium">{formatSize(f.size_bytes)}</div>
                  <div className="col-span-2 hidden lg:block text-xs font-bold text-zinc-500 tracking-wider uppercase">{f.extension||'?'}</div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {isTrash ? (
                      <button onClick={e=>{e.stopPropagation();restoreItem(f.id, 'file')}} className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                        <RotateCcw size={14}/> Restore
                      </button>
                    ) : (
                      <>
                        <button onClick={e=>{e.stopPropagation();toggleStar(f.id,'file',!f.is_starred)}} className="text-zinc-500 hover:text-amber-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title={f.is_starred?"Unstar":"Star"}><Star size={16} className={f.is_starred ? "fill-amber-400 text-amber-400" : ""}/></button>
                        <button onClick={async e=>{e.stopPropagation();const r=await fetch(`${API}/api/download/${f.id}`,{headers:{Authorization:`Bearer ${localStorage.getItem('tv_token')}`}});const b=await r.blob();const u=URL.createObjectURL(b);Object.assign(document.createElement('a'),{href:u,download:f.name}).click();URL.revokeObjectURL(u)}} className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Download"><Download size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();openShareModal(f)}} className="text-zinc-500 hover:text-blue-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Share"><Share2 size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();openActionModal(f,'file','copy')}} className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Copy"><Copy size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();openActionModal(f,'file','move')}} className="text-zinc-500 hover:text-amber-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Move"><Move size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();startRename(f,'file')}} className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg" title="Rename"><Edit2 size={16}/></button>
                        <button onClick={e=>{e.stopPropagation();deleteFile(f.id)}} className="text-zinc-500 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-lg" title="Delete"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Drawer Progress */}
      <AnimatePresence>
        {uploadCount > 0 && !isTrash && (
          <motion.div
            initial={{y:100,opacity:0}} animate={{y:0,opacity:1}} exit={{y:100,opacity:0}}
            transition={{type:'spring',stiffness:300,damping:30}}
            className="fixed bottom-6 right-6 w-80 glass-panel rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden z-[200]">
            <div className="flex items-center justify-between px-5 py-4 bg-white/5 border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={()=>setDrawer(d=>!d)}>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]"/>
                <span className="text-sm font-bold text-white tracking-tight">Uploading ({uploadCount})</span>
              </div>
              <span className="text-zinc-500 text-xs bg-black/40 p-1.5 rounded-lg">{drawer?'▼':'▲'}</span>
            </div>
            {drawer && (
              <div className="p-5 max-h-64 overflow-auto space-y-4">
                {Object.values(uploads).map((u,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-zinc-200 truncate max-w-[180px] font-semibold">{u.filename}</span>
                      <span className="text-zinc-400 font-mono font-bold shrink-0 ml-2">
                        {u.status==='complete'?<span className="text-emerald-400">Done</span>:u.status==='failed'?<span className="text-red-400">Failed</span>:`${u.progress}%`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                      <motion.div animate={{width:`${u.progress}%`}} transition={{duration:0.3}} className={`h-full rounded-full ${u.status==='complete'?'bg-emerald-500':u.status==='failed'?'bg-red-500':'bg-gradient-to-r from-indigo-500 to-purple-500'}`}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{viewer && <MediaViewer file={viewer} onClose={()=>setViewer(null)}/>}</AnimatePresence>
      
      {/* Advanced Share Modal */}
      <AnimatePresence>
        {shareModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] px-4"
            onClick={()=>setShareModal(null)}>
            <motion.div initial={{scale:0.95,opacity:0, y:20}} animate={{scale:1,opacity:1, y:0}} exit={{scale:0.95,opacity:0, y:20}}
              transition={{type:'spring',stiffness:300,damping:30}}
              className="glass-panel border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
              onClick={e=>e.stopPropagation()}>
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-extrabold text-white flex items-center gap-2.5 text-lg"><Share2 size={20} className="text-indigo-400"/> Share Securely</h3>
                <button onClick={()=>setShareModal(null)} className="text-zinc-500 hover:text-white bg-white/5 p-2 rounded-xl hover:bg-white/10 transition-colors"><X size={18}/></button>
              </div>
              <p className="text-zinc-400 text-sm mb-6 truncate font-medium bg-black/40 px-3 py-2 rounded-xl border border-white/5">File: <span className="text-white">{shareModal.name}</span></p>
              
              {!shareLink ? (
                <div className="space-y-5">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider"><Lock size={14} className="text-amber-400"/> Password Link</label>
                    <input type="text" placeholder="Leave empty for public link" value={sharePwd} onChange={e=>setSharePwd(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-indigo-500/50 transition-all shadow-inner placeholder:text-zinc-600"/>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider"><Clock size={14} className="text-indigo-400"/> Expiry Time</label>
                    <select value={shareExp} onChange={e=>setShareExp(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-inner appearance-none">
                      <option value={0}>Never Expire</option>
                      <option value={1}>Expire in 1 Hour</option>
                      <option value={24}>Expire in 1 Day</option>
                      <option value={168}>Expire in 7 Days</option>
                      <option value={720}>Expire in 30 Days</option>
                    </select>
                  </div>
                  <button onClick={generateSecureShare}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3.5 rounded-2xl text-sm font-extrabold transition-all mt-4 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
                    Generate Secure Link
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 mb-6">
                    <input readOnly value={shareLink} className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-indigo-200 outline-none font-mono text-center shadow-inner"/>
                    <button onClick={copyLink} className={`w-full py-3.5 rounded-2xl transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-lg ${copied?'bg-emerald-500 text-white shadow-emerald-500/20':'bg-white text-black hover:bg-zinc-200'}`}>
                      {copied?<CheckCircle size={16} />:<Copy size={16} />}
                      {copied?'Copied to Clipboard!':'Copy Link'}
                    </button>
                  </div>
                  <button onClick={async()=>{await api.post(`/api/files/${shareModal.id}/share`,{enabled:false});setShareModal(null);showToast('Link disabled')}}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-3 rounded-2xl text-sm font-bold transition-all">
                    Revoke Access
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Analytics Modal */}
      <AnimatePresence>
        {showStats && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[260] px-4"
            onClick={()=>setShowStats(false)}>
            <motion.div initial={{scale:0.95,opacity:0, y:20}} animate={{scale:1,opacity:1, y:0}} exit={{scale:0.95,opacity:0, y:20}}
              className="glass-panel border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
              onClick={e=>e.stopPropagation()}>
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />

              <div className="flex items-center justify-between mb-8">
                <h3 className="font-extrabold text-white flex items-center gap-2.5 text-lg"><PieChart size={20} className="text-blue-400"/> Storage Analytics</h3>
                <button onClick={()=>setShowStats(false)} className="text-zinc-500 hover:text-white bg-white/5 p-2 rounded-xl hover:bg-white/10 transition-colors"><X size={18}/></button>
              </div>
              
              {!stats ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-400" size={32}/></div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 mb-2 tracking-tight">{formatSize(stats.total)}</div>
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Cloud Storage Used</div>
                  </div>

                  {/* Multi-color Progress Bar */}
                  <div className="h-4 w-full bg-black/60 rounded-full overflow-hidden flex mb-8 border border-white/5 shadow-inner">
                    <div style={{width: `${(stats.images/stats.total)*100 || 0}%`}} className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" title="Images"/>
                    <div style={{width: `${(stats.videos/stats.total)*100 || 0}%`}} className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" title="Videos"/>
                    <div style={{width: `${(stats.documents/stats.total)*100 || 0}%`}} className="h-full bg-amber-500 shadow-[0_0_10px_#f59e0b]" title="Documents"/>
                    <div style={{width: `${(stats.audio/stats.total)*100 || 0}%`}} className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7]" title="Audio"/>
                    <div style={{width: `${(stats.others/stats.total)*100 || 0}%`}} className="h-full bg-zinc-500" title="Others"/>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-1 bg-black/40 p-5 rounded-3xl border border-white/5">
                    <StatRow color="bg-emerald-500" label="Images" value={stats.images} total={stats.total} icon="🖼️"/>
                    <StatRow color="bg-blue-500" label="Videos" value={stats.videos} total={stats.total} icon="🎬"/>
                    <StatRow color="bg-amber-500" label="Documents" value={stats.documents} total={stats.total} icon="📄"/>
                    <StatRow color="bg-purple-500" label="Audio" value={stats.audio} total={stats.total} icon="🎵"/>
                    <StatRow color="bg-zinc-500" label="Others" value={stats.others} total={stats.total} icon="📦"/>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move & Copy Modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[260] px-4"
            onClick={()=>setActionModal(null)}>
            <motion.div initial={{scale:0.95,opacity:0, y:20}} animate={{scale:1,opacity:1, y:0}} exit={{scale:0.95,opacity:0, y:20}}
              className="glass-panel border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-extrabold text-white flex items-center gap-2.5 text-lg capitalize">
                  {actionModal.action === 'move' ? <Move size={20} className="text-amber-400"/> : <Copy size={20} className="text-emerald-400"/>}
                  {actionModal.action} {actionModal.itemType}
                </h3>
                <button onClick={()=>setActionModal(null)} className="text-zinc-500 hover:text-white bg-white/5 p-2 rounded-xl hover:bg-white/10 transition-colors"><X size={18}/></button>
              </div>
              
              <p className="text-zinc-400 text-sm mb-4 font-medium">Select destination for <b className="text-white bg-white/10 px-2 py-0.5 rounded">{actionModal.item.name}</b>:</p>

              <select value={destFolder} onChange={e=>setDestFolder(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-medium text-white outline-none mb-6 focus:border-indigo-500/50 transition-all cursor-pointer shadow-inner">
                <option value="root">📁 My Drive (Root)</option>
                {allFoldersList.map(fol => (
                  <option key={fol.id} value={fol.id} disabled={fol.id === actionModal.item.id}>
                    ↳ {fol.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-3">
                <button onClick={()=>setActionModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-2xl text-sm transition-all font-bold">Cancel</button>
                <button onClick={submitAction} className={`flex-1 text-white py-3.5 rounded-2xl text-sm transition-all font-bold capitalize shadow-lg hover:-translate-y-0.5 ${actionModal.action === 'move' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}>
                  {actionModal.action}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}