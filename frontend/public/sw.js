/**
 * TeleVault Service Worker
 * Handles: caching, offline support, background sync
 */

const CACHE_NAME = 'televault-v2.0'
const STATIC_CACHE = 'televault-static-v2.0'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install — cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch — network first, cache fallback
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET, browser-extension, API calls, websocket
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return
  if (url.hostname.includes('onrender.com')) return
  if (url.hostname.includes('supabase')) return

  // For API calls: network only
  if (url.pathname.startsWith('/api/')) return

  // For navigation (HTML pages): network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // For static assets: cache first, then network
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response
        const clone = response.clone()
        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone))
        return response
      }).catch(() => cached)
    })
  )
})

// Push notifications (future use)
self.addEventListener('push', (e) => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'TeleVault', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
    })
  )
})
