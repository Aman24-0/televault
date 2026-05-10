import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CloudLightning, Loader2, LogIn } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import api from '../api'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !localStorage.getItem('tv_token')) {
        await handleBackendLogin(user)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleBackendLogin = async (user) => {
    setLoading(true)
    try {
      const res = await api.post('/api/auth/firebase-login', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      })
      
      localStorage.setItem('tv_token',    res.data.token)
      localStorage.setItem('tv_user_id',  res.data.user_id)
      localStorage.setItem('tv_name',     res.data.first_name)
      localStorage.setItem('tv_email',    res.data.email || '')
      localStorage.setItem('tv_photo',    res.data.photoURL || '')
      
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Backend sync failed')
      setLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setLoading(true); setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await handleBackendLogin(result.user)
    } catch (err) {
      setError(err.message || 'Google Sign-In failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-blue-600/6 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mb-5 shadow-2xl shadow-indigo-500/30"
          >
            <CloudLightning size={30} className="text-white" />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">TeleVault</h1>
          <p className="text-zinc-500 mt-2 text-sm">Your Secure Cloud Storage.</p>
        </div>

        {/* Card */}
        <div className="bg-[#18181b]/80 backdrop-blur-xl border border-white/8 rounded-3xl p-7 shadow-2xl">
          <div className="mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-xl mb-4 border border-indigo-500/20">
              <LogIn size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Welcome Back</h2>
            <p className="text-zinc-500 text-sm mt-1">Sign in to access your vault</p>
          </div>

          <div className="space-y-4">
            {error && <ErrorBox msg={error} />}
            <button 
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full py-3.5 bg-white hover:bg-zinc-100 disabled:opacity-50 text-black font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in...</>
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Continue with Google
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          By signing in, you agree to our terms of service.
        </p>
      </motion.div>
    </div>
  )
}

const ErrorBox = ({ msg }) => (
  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
    className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
    {msg}
  </motion.div>
)
