/**
 * PriceChart.jsx
 * Rolling sparkline chart for the selected symbol.
 * Keeps the last 120 data points in local state (updated on each price tick).
 */
import { useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine,
} from 'recharts'
import { useStore } from '../store/store'

const MAX_POINTS = 120

function formatTime(ts) {
  if (!ts) return ''
  const d = typeof ts === 'number' && ts < 1e12 ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={tooltipStyle}>
      <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 3 }}>{d.timeStr}</div>
      <div style={{ color: '#60a5fa', fontFamily: 'monospace' }}>Mid: {d.mid?.toFixed(5)}</div>
      <div style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 11 }}>Bid: {d.bid?.toFixed(5)}</div>
      <div style={{ color: '#10b981', fontFamily: 'monospace', fontSize: 11 }}>Ask: {d.ask?.toFixed(5)}</div>
    </div>
  )
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #1e2d45',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
}

export default function PriceChart() {
  const selectedSymbol = useStore((s) => s.selectedSymbol)
  const price = useStore((s) => s.prices[selectedSymbol])
  const [history, setHistory] = useState([])
  const prevSymbol = useRef(selectedSymbol)

  // Reset history when symbol changes
  useEffect(() => {
    if (prevSymbol.current !== selectedSymbol) {
      setHistory([])
      prevSymbol.current = selectedSymbol
    }
  }, [selectedSymbol])

  // Append new point on price update
  useEffect(() => {
    if (!price) return
    const mid = ((price.bid ?? 0) + (price.ask ?? 0)) / 2
    if (!mid) return
    const point = {
      mid,
      bid: price.bid,
      ask: price.ask,
      timeStr: formatTime(price.timestamp),
      ts: Date.now(),
    }
    setHistory((prev) => {
      const next = [...prev, point]
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
    })
  }, [price])

  const openPrice = history[0]?.mid
  const currentPrice = history[history.length - 1]?.mid
  const change = currentPrice && openPrice ? currentPrice - openPrice : null
  const changePct = change && openPrice ? (change / openPrice) * 100 : null
  const isPositive = change !== null && change >= 0

  const domainPad = history.length > 1
    ? (() => {
        const vals = history.map((h) => h.mid)
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const pad = (max - min) * 0.3 || 0.0001
        return [min - pad, max + pad]
      })()
    : ['auto', 'auto']

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.symbol}>{selectedSymbol}</span>
          {price && (
            <span style={{ ...styles.mid, color: isPositive ? '#10b981' : '#ef4444' }}>
              {currentPrice?.toFixed(5)}
            </span>
          )}
        </div>
        {change !== null && (
          <div style={{ ...styles.change, color: isPositive ? '#10b981' : '#ef4444' }}>
            {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(5)}{' '}
            ({isPositive ? '+' : ''}{changePct?.toFixed(3)}%)
          </div>
        )}
      </div>

      {history.length < 2 ? (
        <div style={styles.empty}>
          {price ? 'Building chart history…' : `No data for ${selectedSymbol}. Subscribe to start streaming.`}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={history} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timeStr"
              tick={{ fill: '#334155', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1e2d45' }}
              interval="preserveStartEnd"
              tickCount={4}
            />
            <YAxis
              domain={domainPad}
              tick={{ fill: '#334155', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(4)}
              width={62}
            />
            <Tooltip content={<CustomTooltip />} />
            {openPrice && (
              <ReferenceLine
                y={openPrice}
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
            <Area
              type="monotone"
              dataKey="mid"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div style={styles.footer}>
        <span style={styles.footerItem}>
          Points: <strong>{history.length}</strong>
        </span>
        <span style={styles.footerItem}>
          Bid: <strong style={{ color: '#ef4444' }}>{price?.bid?.toFixed(5) ?? '—'}</strong>
        </span>
        <span style={styles.footerItem}>
          Ask: <strong style={{ color: '#10b981' }}>{price?.ask?.toFixed(5) ?? '—'}</strong>
        </span>
        <span style={styles.footerItem}>
          Spread: <strong>{price?.spread != null ? (price.spread * 10000).toFixed(1) + ' pips' : '—'}</strong>
        </span>
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#111827',
    borderBottom: '1px solid #1e2d45',
    padding: '16px 16px 12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  symbol: { color: '#94a3b8', fontSize: 13, fontWeight: 700, marginRight: 12 },
  mid: { fontSize: 22, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '-0.5px' },
  change: { fontSize: 13, fontWeight: 600, fontFamily: 'monospace' },
  empty: {
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#334155',
    fontSize: 13,
    fontStyle: 'italic',
  },
  footer: {
    display: 'flex',
    gap: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #1e2d45',
  },
  footerItem: { color: '#475569', fontSize: 11 },
}
