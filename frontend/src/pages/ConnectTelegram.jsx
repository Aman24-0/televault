import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudLightning, Phone, Hash, Lock, ChevronLeft, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import api from '../api'

const STEPS = { PHONE: 'phone', OTP: 'otp', TFA: 'tfa', DONE: 'done' }

export default function ConnectTelegram() {
  const [step, setStep]       = useState(STEPS.PHONE)
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState('')
  const [password, setPass]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()

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
      // Pass current JWT so backend links Telegram to existing Gmail account
      const token = localStorage.getItem('tv_token')
      const res = await api.post(
        `/api/auth/verify-otp?user_token=${token}`,
        {
          phone: phone.trim(),
          code: otp.trim(),
          ...(step === STEPS.TFA && { password })
        }
      )
      // Update token (same user_id, but now has real session)
      localStorage.setItem('tv_token',   res.data.token)
      localStorage.setItem('tv_user_id', res.data.user_id)
      localStorage.setItem('tv_name',    res.data.first_name)
      setStep(STEPS.DONE)
    } catch (err) {
      if (err.response?.status === 428) {
        setStep(STEPS.TFA); setError('Enter your 2FA password')
      } else {
        setError(err.response?.data?.detail || 'Invalid OTP')
      }
    } finally { setLoading(false) }
  }

  const goToDashboard = () => navigate('/', { replace: true })

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mb-4 shadow-2xl shadow-indigo-500/30">
            <CloudLightning size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Connect Telegram</h1>
          <p className="text-zinc-500 mt-1 text-sm">Link your Telegram account for storage</p>
        </div>

        {/* Card */}
        <div className="bg-[#18181b]/80 backdrop-blur-xl border border-white/8 rounded-3xl p-7 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* Phone Step */}
            {step === STEPS.PHONE && (
              <motion.div key="phone"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>
                <div className="mb-5">
                  <h2 className="text-base font-bold text-white">Enter Phone Number</h2>
                  <p className="text-zinc-500 text-xs mt-1">
                    Your Telegram phone number with country code.
                    This is a one-time step — you won't need to do this again.
                  </p>
                </div>
                <form onSubmit={sendCode} className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono select-none">+</span>
                    <input
                      type="tel" placeholder="91 98765 43210" required autoFocus
                      inputMode="tel"
                      className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl pl-8 pr-4 py-3.5 text-white text-sm placeholder-zinc-600 outline-none transition-all"
                      value={phone.replace(/^\+/, '')}
                      onChange={e => setPhone('+' + e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <SubmitBtn loading={loading} label="Send OTP to Telegram" />
                </form>

                <button onClick={() => navigate(-1)}
                  className="w-full mt-3 py-2.5 text-zinc-600 hover:text-zinc-400 text-sm transition-colors flex items-center justify-center gap-1">
                  <ChevronLeft size={14}/> Back to Dashboard
                </button>
              </motion.div>
            )}

            {/* OTP Step */}
            {(step === STEPS.OTP || step === STEPS.TFA) && (
              <motion.div key="otp"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-3 mb-5">
                  <button onClick={() => { setStep(STEPS.PHONE); setError(''); setOtp('') }}
                    className="text-zinc-500 hover:text-white p-1 transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {step === STEPS.TFA ? '2FA Password' : 'Enter OTP'}
                    </h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {step === STEPS.TFA
                        ? '2FA is enabled on your Telegram account'
                        : `Code sent to ${phone} via Telegram`}
                    </p>
                  </div>
                </div>
                <form onSubmit={verifyOtp} className="space-y-4">
                  {step === STEPS.OTP
                    ? <input
                        type="text" placeholder="12345" required autoFocus
                        inputMode="numeric" maxLength={6}
                        className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-white text-center text-2xl font-bold tracking-[0.5em] placeholder-zinc-700 outline-none"
                        value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      />
                    : <input
                        type="password" placeholder="Your 2FA password" required autoFocus
                        className="w-full bg-[#09090b] border border-white/8 focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-white text-sm outline-none"
                        value={password} onChange={e => setPass(e.target.value)}
                      />
                  }
                  {error && <ErrorBox msg={error} />}
                  <SubmitBtn loading={loading} label="Connect Telegram" />
                </form>
              </motion.div>
            )}

            {/* Success Step */}
            {step === STEPS.DONE && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-500/30">
                  <CheckCircle size={32} className="text-emerald-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">Telegram Connected!</h2>
                <p className="text-zinc-500 text-sm mb-7">
                  Your storage is ready. You won't need to do this again — even after logging out.
                </p>
                <button onClick={goToDashboard}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                  Go to Dashboard <ArrowRight size={16}/>
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {step !== STEPS.DONE && (
          <p className="text-center text-zinc-700 text-xs mt-5">
            One-time setup. Session stored securely in your private database.
          </p>
        )}
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

const SubmitBtn = ({ loading, label }) => (
  <button type="submit" disabled={loading}
    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
    {loading
      ? <><Loader2 size={16} className="animate-spin"/> Please wait...</>
      : <>{label} <ArrowRight size={16}/></>}
  </button>
)
