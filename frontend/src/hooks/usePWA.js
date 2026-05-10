import { useState, useEffect } from 'react'

export default function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled]     = useState(false)
  const [isOnline, setIsOnline]           = useState(navigator.onLine)
  const [updateAvailable, setUpdate]      = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
    const onPrompt  = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdate(true)
            }
          })
        })
      })
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallPrompt(null) })

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    const r = await installPrompt.prompt()
    if (r.outcome === 'accepted') { setIsInstalled(true); setInstallPrompt(null) }
  }

  return { installPrompt, isInstalled, isOnline, updateAvailable, install, reload: () => window.location.reload() }
}
