import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CloudLightning, Loader2, LogIn } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import api from '../api'
import { Phone, Hash, Lock, ChevronLeft, ArrowRight } from 'lucide-react'

const STEPS = { METHOD: 'method', PHONE: 'phone', OTP: 'otp', TFA: 'tfa' }

export default function Login() {
  const [step, setStep]       = useState(STEPS.METHOD)
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState('')
  const [password, setPass]   = useState('')
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

  const sendCode = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true); setError('')
    try {
      await api.post('/api/auth/send-code', { phone: phone.trim() })
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const currentToken = localStorage.getItem('tv_token')
      const res = await api.post(`/api/auth/verify-otp${currentToken ? `?user_token=${currentToken}` : ''}`, {
        phone: phone.trim(),
        code: otp.trim(),
        ...(step === STEPS.TFA && { password })
      })
      
      localStorage.setItem('tv_token',   res.data.token)
      localStorage.setItem('tv_user_id', res.data.user_id)
      localStorage.setItem('tv_name',    res.data.first_name)
      navigate('/', { replace: true })
    } catch (err) {
      if (err.response?.status === 428) {
        setStep(STEPS.TFA); setError('Enter your 2FA password')
      } else {
        setError(err.response?.data?.detail || 'Invalid OTP')
      }
    } finally { setLoading(false) }
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
          <AnimatePresence mode="wait">
            {step === STEPS.METHOD && (
              <motion.div key="method" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white">Sign In</h2>
                  <p className="text-zinc-500 text-sm mt-1">Choose your preferred method</p>
                </div>
                <div className="space-y-3">
                  {error && <ErrorBox msg={error} />}
                  <button onClick={loginWithGoogle} disabled={loading}
                    className="w-full py-3 bg-white hover:bg-zinc-100 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-3">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Continue with Google
                  </button>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#18181b] px-2 text-zinc-600">Or connect storage</span></div>
                  </div>
                  <button onClick={() => setStep(STEPS.PHONE)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-3">
                    <Phone size={18} className="text-indigo-400" />
                    Connect Telegram
                  </button>
                </div>
              </motion.div>
            )}

            {step === STEPS.PHONE && (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-6 flex items-center gap-3">
                  <button onClick={() => setStep(STEPS.METHOD)} className="text-zinc-500 hover:text-white p-1"><ChevronLeft size={20}/></button>
                  <div>
                    <h2 className="text-lg font-bold text-white">Connect Telegram</h2>
                    <p className="text-zinc-500 text-sm">Enter your phone number</p>
                  </div>
                </div>
                <form onSubmit={sendCode} className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">+</span>
                    <input type="tel" placeholder="91 98765 43210" required autoFocus
                      className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl pl-8 pr-4 py-3.5 text-white text-sm outline-none"
                      value={phone.replace(/^\+/, '')}
                      onChange={e => setPhone('+' + e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <SubmitBtn loading={loading} label="Send OTP" />
                </form>
              </motion.div>
            )}

            {(step === STEPS.OTP || step === STEPS.TFA) && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => { setStep(STEPS.PHONE); setError(''); setOtp('') }} className="text-zinc-500 hover:text-white p-1"><ChevronLeft size={20}/></button>
                  <h2 className="text-lg font-bold text-white">{step === STEPS.TFA ? '2FA' : 'OTP'}</h2>
                </div>
                <form onSubmit={verifyOtp} className="space-y-4">
                  {step === STEPS.OTP ? (
                    <input type="text" placeholder="12345" required autoFocus maxLength={6}
                      className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-white text-center text-2xl font-bold tracking-[0.5em] outline-none"
                      value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                    />
                  ) : (
                    <input type="password" placeholder="2FA Password" required autoFocus
                      className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-white text-sm outline-none"
                      value={password} onChange={e => setPass(e.target.value)}
                    />
                  )}
                  {error && <ErrorBox msg={error} />}
                  <SubmitBtn loading={loading} label="Verify & Connect" />
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          Your Telegram session is stored securely in your private database.
        </p>
      </motion.div>
    </div>
  )
}

const SubmitBtn = ({ loading, label }) => (
  <button type="submit" disabled={loading}
    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
    {loading ? <><Loader2 size={16} className="animate-spin" /> Please wait...</> : <>{label} <ArrowRight size={16} /></>}
  </button>
)


const ErrorBox = ({ msg }) => (
  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
    className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
    {msg}
  </motion.div>
)
