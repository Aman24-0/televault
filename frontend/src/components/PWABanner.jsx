/**
 * PWABanner - Shows install prompt + offline indicator + update banner
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, WifiOff, RefreshCw, X } from 'lucide-react'
import usePWA from '../hooks/usePWA'

export default function PWABanner() {
  const { installPrompt, isOnline, updateAvailable, install, reload } = usePWA()

  return (
    <>
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[600] bg-red-500/20 border-b border-red-500/30 backdrop-blur-xl px-4 py-2.5 flex items-center justify-center gap-2 text-red-300 text-sm font-medium"
          >
            <WifiOff size={14} />
            You're offline — some features may not work
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Available Banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[600] bg-indigo-500/20 border-b border-indigo-500/30 backdrop-blur-xl px-4 py-2.5 flex items-center justify-center gap-3 text-indigo-300 text-sm"
          >
            <RefreshCw size={14} />
            <span>New version available!</span>
            <button
              onClick={reload}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
            >
              Update Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Prompt */}
      <AnimatePresence>
        {installPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-4 right-4 z-[600] max-w-sm mx-auto"
          >
            <div className="bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                <span className="text-2xl">⚡</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Install TeleVault</p>
                <p className="text-zinc-500 text-xs mt-0.5">Add to home screen for the best experience</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={install}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                >
                  <Download size={11} /> Install
                </button>
                <button
                  onClick={() => {}}
                  className="text-zinc-600 hover:text-zinc-400 text-xs text-center transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
