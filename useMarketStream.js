/**
 * useMarketStream.js
 * Connects to the backend SSE endpoint (/api/v1/stream/prices).
 * Handles reconnection, heartbeats, and dispatches updates to the Zustand store.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store/store'

const SSE_URL = '/api/v1/stream/prices'
const MAX_RETRY_DELAY = 30_000
const INITIAL_RETRY_DELAY = 1_000

export function useMarketStream(enabled = true) {
  const updatePrice = useStore((s) => s.updatePrice)
  const setConnectionStatus = useStore((s) => s.setConnectionStatus)
  const esRef = useRef(null)
  const retryDelay = useRef(INITIAL_RETRY_DELAY)
  const retryTimer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    function connect() {
      if (esRef.current) {
        esRef.current.close()
      }

      const es = new EventSource(SSE_URL)
      esRef.current = es

      es.onopen = () => {
        retryDelay.current = INITIAL_RETRY_DELAY
        setConnectionStatus('connected')
        console.log('[SSE] Connected to market stream')
      }

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'price':
              updatePrice(msg)
              break
            case 'connection_status':
              setConnectionStatus(msg.status)
              break
            case 'heartbeat':
              // keep-alive, no action needed
              break
            default:
              break
          }
        } catch (err) {
          console.warn('[SSE] Parse error:', err)
        }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        setConnectionStatus('reconnecting')
        console.warn(`[SSE] Connection lost. Retrying in ${retryDelay.current}ms…`)
        retryTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_DELAY)
          connect()
        }, retryDelay.current)
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimer.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [enabled])
}
