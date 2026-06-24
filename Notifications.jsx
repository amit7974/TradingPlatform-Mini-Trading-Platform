/**
 * Notifications.jsx
 * Fixed-position toast overlay driven by the store.
 */
import { useStore } from '../store/store'

const TYPE_STYLES = {
  success: { bg: '#064e3b', border: '#10b981', color: '#6ee7b7' },
  error:   { bg: '#450a0a', border: '#ef4444', color: '#fca5a5' },
  info:    { bg: '#0c1a3a', border: '#3b82f6', color: '#93c5fd' },
}

export default function Notifications() {
  const notifications = useStore((s) => s.notifications)

  return (
    <div style={styles.overlay}>
      {notifications.map((n) => {
        const t = TYPE_STYLES[n.type] ?? TYPE_STYLES.info
        return (
          <div
            key={n.id}
            style={{
              ...styles.toast,
              background: t.bg,
              border: `1px solid ${t.border}`,
              color: t.color,
            }}
          >
            {n.msg}
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    maxWidth: 340,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    animation: 'fadeIn 0.2s ease',
  },
}
