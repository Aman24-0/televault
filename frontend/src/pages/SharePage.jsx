import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, FileText, CloudLightning, Loader2, AlertCircle } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const fmt = b => !b ? '?' : b < 1024 ? b+'B' : b < 1048576 ? (b/1024).toFixed(1)+'KB' : b < 1073741824 ? (b/1048576).toFixed(1)+'MB' : (b/1073741824).toFixed(2)+'GB'

export default function SharePage() {
  const { token } = useParams()
  const [info, setInfo]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/shared/info/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setInfo)
      .catch(() => setError('This link is invalid or has been disabled.'))
  }, [token])

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="flex items-center gap-2.5 mb-12 relative z-10">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
          <CloudLightning size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white">TeleVault</span>
      </div>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4, ease:[0.23,1,0.32,1] }}
        className="w-full max-w-xs relative z-10">
        {error ? (
          <div className="bg-[#18181b] border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl">
            <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-400 font-medium text-sm">{error}</p>
          </div>
        ) : !info ? (
          <div className="flex justify-center"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
        ) : (
          <div className="bg-[#18181b] border border-white/8 rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-indigo-500/20">
              <FileText size={28} className="text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-white mb-1 break-all leading-snug">{info.name}</h2>
            <p className="text-zinc-500 text-sm mb-7">{fmt(info.size_bytes)}</p>
            <a href={`${API}/api/shared/download/${token}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 text-sm">
              <Download size={16} /> Download File
            </a>
          </div>
        )}
      </motion.div>
      <p className="mt-10 text-zinc-700 text-xs relative z-10">Shared via TeleVault</p>
    </div>
  )
}
