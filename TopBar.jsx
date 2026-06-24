/**
 * TopBar.jsx
 * Header bar: logo, connection indicator, account summary, logout.
 */
import { authAPI } from '../services/api'
import { useStore } from '../store/store'

const STATUS_CONFIG = {
  connected:    { color: '#10b981', label: 'Live', dot: '#34d399' },
  reconnecting: { color: '#f59e0b', label: 'Reconnecting…', dot: '#fbbf24' },
  disconnected: { color: '#ef4444', label: 'Offline', dot: '#f87171' },
}

export default function TopBar() {
  const username = useStore((s) => s.username)
  const logout = useStore((s) => s.logout)
  const connectionStatus = useStore((s) => s.connectionStatus)
  const trades = useStore((s) => s.trades)
  const prices = useStore((s) => s.prices)

  const cfg = STATUS_CONFIG[connectionStatus] ?? STATUS_CONFIG.disconnected

  // Compute total open P&L
  const openPnL = trades
    .filter((t) => t.status === 'OPEN')
    .reduce((sum, t) => {
      const p = prices[t.symbol]
      if (!p) return sum
      const closePrice = t.direction === 'BUY' ? p.bid : p.ask
      const sign = t.direction === 'BUY' ? 1 : -1
      return sum + sign * (closePrice - t.price) * t.quantity
    }, 0)

  const realisedPnL = trades
    .filter((t) => t.status === 'CLOSED')
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0)

  const handleLogout = async () => {
    try { await authAPI.logout() } catch (_) {}
    logout()
  }

  return (
    <div style={styles.bar}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoHex}>⬡</span>
        <span style={styles.logoText}>TradePlatform</span>
      </div>

      {/* Status + stats */}
      <div style={styles.center}>
        {/* Connection pill */}
        <div style={styles.pill}>
          <span style={{ ...styles.dot, background: cfg.dot }} />
          <span style={{ color: cfg.color, fontSize: 12, fontWeight: 600 }}>{cfg.label}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.stat}>
          <span style={styles.statLabel}>Open P&L</span>
          <span style={{ ...styles.statValue, color: openPnL >= 0 ? '#10b981' : '#ef4444' }}>
            {openPnL >= 0 ? '+' : ''}{openPnL.toFixed(2)}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.stat}>
          <span style={styles.statLabel}>Realised</span>
          <span style={{ ...styles.statValue, color: realisedPnL >= 0 ? '#10b981' : '#ef4444' }}>
            {realisedPnL >= 0 ? '+' : ''}{realisedPnL.toFixed(2)}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.stat}>
          <span style={styles.statLabel}>Positions</span>
          <span style={styles.statValue}>
            {trades.filter((t) => t.status === 'OPEN').length}
          </span>
        </div>
      </div>

      {/* User */}
      <div style={styles.user}>
        <span style={styles.username}>{username}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const styles = {
  bar: {
    height: 52,
    background: '#0d1117',
    borderBottom: '1px solid #1e2d45',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 24,
    flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 },
  logoHex: { fontSize: 20, color: '#3b82f6' },
  logoText: { color: '#f1f5f9', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' },
  center: { flex: 1, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#111827',
    border: '1px solid #1e2d45',
    borderRadius: 20,
    padding: '4px 12px',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    display: 'inline-block',
    boxShadow: '0 0 6px currentColor',
  },
  divider: { width: 1, height: 20, background: '#1e2d45' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  statLabel: { color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  statValue: { color: '#94a3b8', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
  user: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 160, justifyContent: 'flex-end' },
  username: { color: '#64748b', fontSize: 12 },
  logoutBtn: {
    background: 'none',
    border: '1px solid #1e2d45',
    borderRadius: 6,
    color: '#475569',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
}
