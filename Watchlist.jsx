/**
 * Watchlist.jsx
 * Displays live bid/ask/spread for each symbol.
 * Flashes green/red on price direction changes.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'

function PriceTile({ symbol }) {
  const price = useStore((s) => s.prices[symbol])
  const selectedSymbol = useStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol)
  const [flash, setFlash] = useState(null) // 'up' | 'down' | null
  const prevLast = useRef(null)

  useEffect(() => {
    if (!price) return
    if (prevLast.current !== null && price.last !== prevLast.current) {
      const dir = price.last > prevLast.current ? 'up' : 'down'
      setFlash(dir)
      const t = setTimeout(() => setFlash(null), 400)
      return () => clearTimeout(t)
    }
    prevLast.current = price.last
  }, [price?.last])

  const isSelected = selectedSymbol === symbol
  const dir = price?.direction ?? 'flat'

  const flashColor = flash === 'up'
    ? 'rgba(16, 185, 129, 0.18)'
    : flash === 'down'
    ? 'rgba(239, 68, 68, 0.18)'
    : 'transparent'

  return (
    <div
      onClick={() => setSelectedSymbol(symbol)}
      style={{
        ...styles.tile,
        background: isSelected ? '#1e3a5f' : '#111827',
        borderColor: isSelected ? '#3b82f6' : '#1e2d45',
        outline: `2px solid ${flashColor}`,
        cursor: 'pointer',
        transition: 'outline 0.1s, background 0.2s',
      }}
    >
      <div style={styles.tileTop}>
        <span style={styles.symbol}>{symbol}</span>
        <span style={{
          ...styles.direction,
          color: dir === 'up' ? '#10b981' : dir === 'down' ? '#ef4444' : '#64748b',
        }}>
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●'}
        </span>
      </div>
      {price ? (
        <>
          <div style={styles.priceRow}>
            <div>
              <div style={styles.priceLabel}>BID</div>
              <div style={{ ...styles.price, color: '#ef4444' }}>
                {price.bid?.toFixed(5) ?? '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={styles.priceLabel}>ASK</div>
              <div style={{ ...styles.price, color: '#10b981' }}>
                {price.ask?.toFixed(5) ?? '—'}
              </div>
            </div>
          </div>
          <div style={styles.spread}>
            Spread: {price.spread != null ? (price.spread * 10000).toFixed(1) : '—'} pips
          </div>
        </>
      ) : (
        <div style={styles.noData}>Awaiting data…</div>
      )}
    </div>
  )
}

export default function Watchlist() {
  const watchlist = useStore((s) => s.watchlist)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText}>Watchlist</span>
        <span style={styles.headerCount}>{watchlist.length} symbols</span>
      </div>
      <div style={styles.list}>
        {watchlist.map((sym) => (
          <PriceTile key={sym} symbol={sym} />
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0d1117',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 10px',
    borderBottom: '1px solid #1e2d45',
  },
  headerText: { color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  headerCount: { color: '#334155', fontSize: 11 },
  list: { overflowY: 'auto', flex: 1, padding: '8px' },
  tile: {
    border: '1px solid #1e2d45',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 6,
    transition: 'all 0.15s',
    userSelect: 'none',
  },
  tileTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  symbol: { color: '#f1f5f9', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' },
  direction: { fontSize: 10 },
  priceRow: { display: 'flex', justifyContent: 'space-between' },
  priceLabel: { color: '#334155', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 },
  price: { fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
  spread: { color: '#475569', fontSize: 10, marginTop: 5 },
  noData: { color: '#334155', fontSize: 12, fontStyle: 'italic', padding: '4px 0' },
}
