import { useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function useWebSocket(userId, onMessage) {
  const wsRef       = useRef(null)
  const pingRef     = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    if (!userId) return
    const wsUrl = API.replace(/^http/, 'ws') + `/ws/${userId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      clearTimeout(reconnectRef.current)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch {}
    }

    ws.onclose = () => {
      clearInterval(pingRef.current)
      // Reconnect after 3s
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [userId])

  useEffect(() => {
    connect()
    return () => {
      clearInterval(pingRef.current)
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
