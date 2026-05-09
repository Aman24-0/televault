import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CloudLightning, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import api from '../api'; // Use your configured axios instance

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const formatSize = (b) => {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
  return (b/1024/1024/1024).toFixed(2) + ' GB';
};

export default function Share() {
  const { token } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch info about the shared file
    api.get(`/api/shared/info/${token}`)
      .then(res => {
        setFile(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Link error:", err);
        setError(true);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 size={48} className="animate-spin text-emerald-400 mb-4" />
        <p className="text-slate-400 text-lg">Unlocking secure link...</p>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white text-center p-6">
        <AlertCircle size={64} className="text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Link Expired or Invalid</h1>
        <p className="text-slate-400 max-w-md">The file you are looking for has been removed, or the owner has disabled public sharing.</p>
      </div>
    );
  }

  const isImage = file.mime_type?.startsWith('image/');
  const isVideo = file.mime_type?.startsWith('video/');
  
  // Public URLs that can be passed directly to native HTML tags for INSTANT streaming
  const streamUrl = `${API_URL}/api/shared/stream/${token}`;
  const downloadUrl = `${API_URL}/api/shared/download/${token}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
         <div className="flex items-center gap-2">
            <CloudLightning size={28} className="text-emerald-400" />
            <span className="text-2xl font-bold tracking-tight">TeleVault</span>
         </div>
         <a href={downloadUrl} download className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-2 rounded-xl transition-all flex items-center gap-2">
            <Download size={18} /> Download
         </a>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
           
           {/* Native Media Streaming Area */}
           <div className="bg-black flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden relative">
              {isImage && <img src={streamUrl} alt={file.name} className="max-w-full max-h-[60vh] object-contain shadow-2xl" />}
              {isVideo && <video src={streamUrl} controls autoPlay className="max-w-full max-h-[60vh] outline-none shadow-2xl" />}
              {!isImage && !isVideo && (
                <div className="flex flex-col items-center gap-4 py-16">
                   <FileText size={80} className="text-slate-700" />
                   <p className="text-slate-500 font-medium">No preview available for this file type</p>
                </div>
              )}
           </div>

           {/* Footer Info */}
           <div className="p-6 sm:p-8 flex items-center justify-between bg-slate-900">
              <div className="flex flex-col truncate pr-4 w-full">
                 <h2 className="text-xl sm:text-2xl font-bold truncate" title={file.name}>{file.name}</h2>
                 <p className="text-slate-400 text-sm mt-1">{formatSize(file.size_bytes)} • {file.extension?.toUpperCase()}</p>
              </div>
              <a href={downloadUrl} download className="shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl transition-colors">
                 <Download size={24} className="text-emerald-400" />
              </a>
           </div>
        </div>
      </main>
    </div>
  );
}