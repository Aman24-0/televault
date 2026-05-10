import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, CloudLightning, Lock, File, AlertCircle, Loader2 } from 'lucide-react';
import { formatSize } from '../lib/utils';
import api from '../api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SharePage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get(`/api/shared/info/${token}`)
      .then(r => setInfo(r.data))
      .catch(e => setError(e.response?.data?.detail || 'This share link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async () => {
    if (info.requires_password && !password) {
      setAuthError('Please enter the password to download.');
      return;
    }

    setDownloading(true);
    setAuthError('');

    try {
      const r = await fetch(`${API}/api/shared/download/${token}?pwd=${encodeURIComponent(password)}`);
      
      if (!r.ok) {
        if (r.status === 401) throw new Error('Incorrect Password!');
        if (r.status === 403) throw new Error('Link has expired!');
        throw new Error('Failed to download file');
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      // Clear password field after successful download for security
      if(info.requires_password) setPassword('');

    } catch (e) {
      setAuthError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#09090b] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
        <p className="text-zinc-500 font-medium">Checking secure link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Link Unavailable</h2>
        <p className="text-zinc-400 text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl">
          <CloudLightning size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">TeleVault</span>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)]">
            <File size={36} className="text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2 truncate w-full px-4">{info.name}</h1>
          <p className="text-zinc-500 font-mono text-sm">{formatSize(info.size_bytes)} • {info.extension.toUpperCase()}</p>
        </div>

        <div className="space-y-4">
          {info.requires_password && (
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                <Lock size={14} className="text-amber-400" /> Password Protected File
              </label>
              <input 
                type="password" 
                placeholder="Enter password to download"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDownload()}
                className="w-full bg-[#09090b] border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 text-white outline-none transition-all placeholder:text-zinc-600"
              />
              {authError && <p className="text-red-400 text-xs mt-2 ml-1 font-medium">{authError}</p>}
            </div>
          )}

          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="w-full relative group bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-400/0 via-white/20 to-indigo-400/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            {downloading ? (
              <span className="flex items-center gap-2 relative z-10"><Loader2 className="animate-spin" size={18}/> Downloading...</span>
            ) : (
              <span className="flex items-center gap-2 relative z-10"><Download size={18} /> Download Securely</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}