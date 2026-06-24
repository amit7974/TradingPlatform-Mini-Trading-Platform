/**
 * OrderTicket.jsx
 * Form to place MARKET / LIMIT orders.
 * On fill, adds the resulting order + trade to the store.
 */
import { useState } from 'react'
import { ordersAPI, tradesAPI } from '../services/api'
import { useStore } from '../store/store'

export default function OrderTicket() {
  const selectedSymbol = useStore((s) => s.selectedSymbol)
  const price = useStore((s) => s.prices[selectedSymbol])
  const addOrder = useStore((s) => s.addOrder)
  const setTrades = useStore((s) => s.setTrades)
  const trades = useStore((s) => s.trades)
  const addNotification = useStore((s) => s.addNotification)

  const [side, setSide] = useState('BUY')
  const [orderType, setOrderType] = useState('MARKET')
  const [quantity, setQuantity] = useState('10000')
  const [limitPrice, setLimitPrice] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePlace = async () => {
    if (!quantity || isNaN(Number(quantity))) return
    setLoading(true)
    try {
      const payload = {
        symbol: selectedSymbol,
        side,
        order_type: orderType,
        quantity: Number(quantity),
        ...(orderType !== 'MARKET' && limitPrice ? { limit_price: Number(limitPrice) } : {}),
      }
      const res = await ordersAPI.place(payload)
      const order = res.data
      addOrder(order)

      if (order.status === 'FILLED') {
        addNotification(`✓ ${side} ${selectedSymbol} filled @ ${order.fill_price?.toFixed(5)}`, 'success')
        // Refresh trades to pick up the new one
        const tRes = await tradesAPI.list()
        setTrades(tRes.data.trades)
      } else if (order.status === 'REJECTED') {
        addNotification(`✗ Order rejected – no live price available`, 'error')
      } else {
        addNotification(`Order #${order.id} placed (${order.status})`, 'info')
      }
    } catch (err) {
      addNotification(err.response?.data?.detail || 'Order failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const askPrice = price?.ask?.toFixed(5) ?? '—'
  const bidPrice = price?.bid?.toFixed(5) ?? '—'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.symbol}>{selectedSymbol}</span>
        <div style={styles.livePrice}>
          <span style={{ color: '#ef4444' }}>{bidPrice}</span>
          <span style={styles.slash}>/</span>
          <span style={{ color: '#10b981' }}>{askPrice}</span>
        </div>
      </div>

      {/* Side toggle */}
      <div style={styles.sideRow}>
        <button
          onClick={() => setSide('BUY')}
          style={{ ...styles.sideBtn, ...(side === 'BUY' ? styles.buyActive : styles.sideInactive) }}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('SELL')}
          style={{ ...styles.sideBtn, ...(side === 'SELL' ? styles.sellActive : styles.sideInactive) }}
        >
          SELL
        </button>
      </div>

      {/* Order type */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          style={styles.select}
        >
          <option value="MARKET">Market</option>
          <option value="LIMIT">Limit</option>
          <option value="STOP">Stop</option>
        </select>
      </div>

      {/* Quantity */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Quantity (units)</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={styles.input}
          min="1"
        />
      </div>

      {/* Limit price (shown only for non-market) */}
      {orderType !== 'MARKET' && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>{orderType} Price</label>
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            style={styles.input}
            step="0.00001"
            placeholder={side === 'BUY' ? askPrice : bidPrice}
          />
        </div>
      )}

      <button
        onClick={handlePlace}
        disabled={loading || !price}
        style={{
          ...styles.placeBtn,
          background: side === 'BUY'
            ? 'linear-gradient(135deg, #059669, #047857)'
            : 'linear-gradient(135deg, #dc2626, #b91c1c)',
          opacity: loading || !price ? 0.5 : 1,
        }}
      >
        {loading ? 'Placing…' : `${side} ${selectedSymbol}`}
      </button>

      {!price && (
        <p style={styles.hint}>⚠ Subscribe to {selectedSymbol} to enable trading</p>
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: 16,
    background: '#111827',
    borderBottom: '1px solid #1e2d45',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  symbol: { color: '#f1f5f9', fontWeight: 700, fontSize: 16 },
  livePrice: { fontFamily: 'monospace', fontSize: 13 },
  slash: { color: '#334155', margin: '0 3px' },
  sideRow: { display: 'flex', gap: 8 },
  sideBtn: {
    flex: 1,
    padding: '9px 0',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.06em',
    transition: 'all 0.15s',
  },
  buyActive: { background: '#065f46', color: '#34d399', border: '1px solid #059669' },
  sellActive: { background: '#7f1d1d', color: '#f87171', border: '1px solid #dc2626' },
  sideInactive: { background: '#1e2d45', color: '#475569', border: '1px solid #1e2d45' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 7,
    color: '#f1f5f9',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'monospace',
    outline: 'none',
  },
  select: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 7,
    color: '#f1f5f9',
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
  },
  placeBtn: {
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'opacity 0.2s',
  },
  hint: { color: '#92400e', fontSize: 11, margin: 0 },
}
