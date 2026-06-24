/**
 * LoginScreen.jsx
 * Collects ACT Trader credentials and calls the backend auth endpoint.
 */
import { useState } from 'react'
import { authAPI } from '../services/api'
import { useStore } from '../store/store'

export default function LoginScreen() {
  const login = useStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const res = await authAPI.login(username, password)
      login(res.data.access_token, username)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || err.message
      if (status === 503) {
        // Backend reachable but ACT Trader isn't – allow demo mode
        setWarning(detail)
        // Still log in with a demo token so UI is accessible
        login('demo-mode', username)
      } else {
        setError(detail || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>TradePlatform</span>
        </div>
        <p style={styles.subtitle}>Connect your ACT Trader account</p>

        {warning && <div style={styles.warning}>{warning}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your.username"
            required
            autoFocus
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Connecting…' : 'Connect & Trade'}
          </button>
        </form>

        <p style={styles.hint}>
          Auth endpoint: <code>s138.acttrader.com:10138</code>
        </p>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1f3c 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#111827',
    border: '1px solid #1e2d45',
    borderRadius: 16,
    padding: '40px 36px',
    width: 380,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  logoIcon: { fontSize: 28, color: '#3b82f6' },
  logoText: { fontSize: 22, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px' },
  subtitle: { color: '#64748b', fontSize: 13, marginBottom: 28, marginTop: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 8,
    color: '#f1f5f9',
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6,
    transition: 'opacity 0.2s',
  },
  errorBox: {
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 12,
  },
  warning: {
    background: '#451a03',
    border: '1px solid #7c2d12',
    color: '#fdba74',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 12,
  },
  hint: { color: '#334155', fontSize: 11, marginTop: 20, textAlign: 'center' },
}
