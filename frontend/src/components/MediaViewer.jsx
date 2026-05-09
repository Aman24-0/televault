import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function MediaViewer({ file, onClose }) {
  const [zoom,    setZoom]    = useState(1)
  const [rot,     setRot]     = useState(0)
  const [imgLoad, setImgLoad] = useState(true)
  const token   = localStorage.getItem('tv_token')
  const isImg   = file.mime_type?.startsWith('image/')
  const isVid   = file.mime_type?.startsWith('video/')
  const isAud   = file.mime_type?.startsWith('audio/')

  // Use token-in-URL endpoint for HTML5 elements (they can't set headers)
  const streamUrl = `${API}/api/stream-token/${file.id}?token=${token}`
  // Auth-header endpoint for download
  const downloadUrl = `${API}/api/download/${file.id}`

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const download = async () => {
    const r = await fetch(downloadUrl, { headers:{ Authorization:`Bearer ${token}` } })
    const b = await r.blob()
    const u = URL.createObjectURL(b)
    Object.assign(document.createElement('a'), { href:u, download:file.name }).click()
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        transition={{ duration:0.15 }}
        className="fixed inset-0 z-[300] bg-black/92 backdrop-blur-sm flex flex-col"
        onClick={onClose}
      >
        {/* Toolbar */}
        <motion.div
          initial={{ y:-20, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.05 }}
          className="shrink-0 h-14 flex items-center gap-3 px-4 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl"
          onClick={e => e.stopPropagation()}>
          <p className="flex-1 text-sm font-medium text-zinc-300 truncate">{file.name}</p>

          {isImg && (
            <div className="flex items-center gap-1">
              {[
                [<ZoomOut size={14}/>, () => setZoom(z => Math.max(0.25, z-0.25))],
                [<ZoomIn  size={14}/>, () => setZoom(z => Math.min(5,    z+0.25))],
                [<RotateCw size={14}/>, () => setRot(r => (r+90)%360)],
              ].map(([ic,fn],i) => (
                <button key={i} onClick={fn}
                  className="text-zinc-500 hover:text-white bg-white/4 hover:bg-white/10 p-2 rounded-lg transition-all">
                  {ic}
                </button>
              ))}
              <span className="text-zinc-600 text-xs w-10 text-center font-mono">{Math.round(zoom*100)}%</span>
            </div>
          )}

          <button onClick={download}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-white/4 hover:bg-white/10 px-3 py-2 rounded-xl transition-all text-xs font-medium">
            <Download size={13}/> Download
          </button>
          <button onClick={onClose}
            className="text-zinc-500 hover:text-white bg-white/4 hover:bg-red-500/20 hover:text-red-400 p-2 rounded-xl transition-all">
            <X size={16}/>
          </button>
        </motion.div>

        {/* Media Content */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden"
          onClick={e => e.stopPropagation()}>
          <motion.div
            initial={{ scale:0.9, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            transition={{ duration:0.2, ease:[0.23,1,0.32,1] }}
            className="max-w-full max-h-full flex items-center justify-center relative"
          >
            {isImg && (
              <>
                {imgLoad && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-indigo-400"/>
                  </div>
                )}
                <img
                  src={streamUrl}
                  onLoad={() => setImgLoad(false)}
                  onError={() => setImgLoad(false)}
                  style={{
                    transform: `scale(${zoom}) rotate(${rot}deg)`,
                    transition: 'transform 0.2s ease',
                    maxWidth: '90vw', maxHeight: '82vh',
                    opacity: imgLoad ? 0 : 1,
                  }}
                  className="rounded-xl shadow-2xl object-contain transition-opacity duration-300"
                  alt={file.name}
                />
              </>
            )}

            {isVid && (
              <video controls autoPlay
                className="max-w-[90vw] max-h-[82vh] rounded-xl shadow-2xl outline-none bg-black"
                style={{ minWidth: 320 }}>
                <source src={streamUrl} type={file.mime_type}/>
                Your browser does not support video playback.
              </video>
            )}

            {isAud && (
              <div className="bg-[#18181b] border border-white/8 rounded-3xl p-10 text-center w-80 shadow-2xl">
                <div className="text-5xl mb-5">🎵</div>
                <p className="text-white font-semibold mb-2 text-sm truncate">{file.name}</p>
                <p className="text-zinc-600 text-xs mb-5 font-mono">{file.extension?.toUpperCase()}</p>
                <audio controls className="w-full" autoPlay>
                  <source src={streamUrl} type={file.mime_type}/>
                </audio>
              </div>
            )}

            {!isImg && !isVid && !isAud && (
              <div className="bg-[#18181b] border border-white/8 rounded-3xl p-10 text-center w-72 shadow-2xl">
                <div className="text-5xl mb-4">📄</div>
                <p className="text-white font-semibold mb-1 text-sm break-all">{file.name}</p>
                <p className="text-zinc-500 text-xs mb-6">Preview not available for this file type</p>
                <button onClick={download}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 mx-auto">
                  <Download size={14}/> Download
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
