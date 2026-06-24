/**
 * OrdersBlotter.jsx
 * Shows recent orders with status and cancel button for PENDING ones.
 */
import { ordersAPI } from '../services/api'
import { useStore } from '../store/store'

const STATUS_COLORS = {
  FILLED: '#10b981',
  PENDING: '#f59e0b',
  CANCELLED: '#475569',
  REJECTED: '#ef4444',
}

export default function OrdersBlotter() {
  const orders = useStore((s) => s.orders)
  const updateOrder = useStore((s) => s.updateOrder)
  const addNotification = useStore((s) => s.addNotification)

  const handleCancel = async (order) => {
    try {
      const res = await ordersAPI.cancel(order.id)
      updateOrder(res.data)
      addNotification(`Order #${order.id} cancelled`, 'info')
    } catch (err) {
      addNotification(err.response?.data?.detail || 'Cancel failed', 'error')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Order Book</span>
        <span style={styles.count}>{orders.length} orders</span>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['#', 'Symbol', 'Side', 'Type', 'Qty', 'Fill', 'Status', ''].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.empty}>No orders placed yet</td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} style={styles.tr}>
                  <td style={styles.td}>{o.id}</td>
                  <td style={{ ...styles.td, fontWeight: 700, color: '#f1f5f9' }}>{o.symbol}</td>
                  <td style={{ ...styles.td, color: o.side === 'BUY' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {o.side}
                  </td>
                  <td style={styles.td}>{o.order_type}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                    {Number(o.quantity).toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>
                    {o.fill_price?.toFixed(5) ?? (o.limit_price?.toFixed(5) ?? '—')}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      color: STATUS_COLORS[o.status] ?? '#94a3b8',
                      fontWeight: 600,
                      fontSize: 11,
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {o.status === 'PENDING' && (
                      <button onClick={() => handleCancel(o)} style={styles.cancelBtn}>
                        Cancel
                      </button>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #1e2d45',
  },
  title: { color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  count: { color: '#334155', fontSize: 11 },
  tableWrap: { overflowY: 'auto', flex: 1 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    color: '#334155',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '7px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #1e2d45',
    position: 'sticky',
    top: 0,
    background: '#0d1117',
  },
  tr: { borderBottom: '1px solid #0f172a' },
  td: { padding: '7px 12px', color: '#94a3b8', verticalAlign: 'middle' },
  empty: { padding: '20px', color: '#334155', textAlign: 'center', fontStyle: 'italic' },
  cancelBtn: {
    background: 'none',
    color: '#f59e0b',
    border: '1px solid #78350f',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
}
