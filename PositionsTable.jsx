/**
 * PositionsTable.jsx
 * Shows open and closed trades with live unrealised P&L for open positions.
 */
import { useState } from 'react'
import { tradesAPI } from '../services/api'
import { useStore } from '../store/store'

function LivePnL({ trade }) {
  const price = useStore((s) => s.prices[trade.symbol])
  if (trade.status !== 'OPEN' || !price) {
    return (
      <span style={{ color: trade.pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
        {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
      </span>
    )
  }
  const closePrice = trade.direction === 'BUY' ? price.bid : price.ask
  const sign = trade.direction === 'BUY' ? 1 : -1
  const unrealised = sign * (closePrice - trade.price) * trade.quantity
  const color = unrealised >= 0 ? '#10b981' : '#ef4444'
  return (
    <span style={{ color, fontFamily: 'monospace', fontWeight: 600 }}>
      {unrealised >= 0 ? '+' : ''}{unrealised.toFixed(2)}
    </span>
  )
}

export default function PositionsTable() {
  const trades = useStore((s) => s.trades)
  const setTrades = useStore((s) => s.setTrades)
  const addNotification = useStore((s) => s.addNotification)
  const [closing, setClosing] = useState(null)
  const [tab, setTab] = useState('open')

  const filtered = trades.filter((t) =>
    tab === 'open' ? t.status === 'OPEN' : t.status === 'CLOSED'
  )

  const handleClose = async (trade) => {
    setClosing(trade.id)
    try {
      const res = await tradesAPI.close(trade.id)
      const updated = res.data
      const tRes = await tradesAPI.list()
      setTrades(tRes.data.trades)
      const pnl = updated.pnl ?? 0
      addNotification(
        `Trade #${trade.id} closed. P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
        pnl >= 0 ? 'success' : 'error'
      )
    } catch (err) {
      addNotification(err.response?.data?.detail || 'Close failed', 'error')
    } finally {
      setClosing(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {['open', 'closed'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {' '}({trades.filter((tr) => (t === 'open' ? tr.status === 'OPEN' : tr.status === 'CLOSED')).length})
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['#', 'Symbol', 'Dir', 'Qty', 'Open', 'P&L', tab === 'open' ? 'Action' : 'Close'].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.empty}>
                  No {tab} positions
                </td>
              </tr>
            ) : (
              filtered.map((trade) => (
                <tr key={trade.id} style={styles.tr}>
                  <td style={styles.td}>{trade.id}</td>
                  <td style={{ ...styles.td, fontWeight: 700, color: '#f1f5f9' }}>{trade.symbol}</td>
                  <td style={{
                    ...styles.td,
                    color: trade.direction === 'BUY' ? '#10b981' : '#ef4444',
                    fontWeight: 700,
                  }}>
                    {trade.direction}
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                    {Number(trade.quantity).toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                    {trade.price?.toFixed(5)}
                  </td>
                  <td style={styles.td}>
                    <LivePnL trade={trade} />
                  </td>
                  <td style={styles.td}>
                    {tab === 'open' ? (
                      <button
                        onClick={() => handleClose(trade)}
                        disabled={closing === trade.id}
                        style={styles.closeBtn}
                      >
                        {closing === trade.id ? '…' : 'Close'}
                      </button>
                    ) : (
                      <span style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>
                        {trade.close_price?.toFixed(5) ?? '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' },
  tabs: { display: 'flex', borderBottom: '1px solid #1e2d45', padding: '0 16px' },
  tab: {
    background: 'none',
    border: 'none',
    color: '#475569',
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: { color: '#60a5fa', borderBottomColor: '#3b82f6' },
  tableWrap: { overflowY: 'auto', flex: 1 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    color: '#334155',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #1e2d45',
    position: 'sticky',
    top: 0,
    background: '#0d1117',
  },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '8px 12px', color: '#94a3b8', verticalAlign: 'middle' },
  empty: { padding: '24px 12px', color: '#334155', textAlign: 'center', fontStyle: 'italic' },
  closeBtn: {
    background: '#7f1d1d',
    color: '#f87171',
    border: '1px solid #dc2626',
    borderRadius: 5,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}
