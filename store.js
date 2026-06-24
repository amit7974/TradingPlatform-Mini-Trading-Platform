/**
 * store.js
 * Zustand global state. Keeps:
 *   - auth session
 *   - live prices (symbol → {bid, ask, last, spread, timestamp, prev_last})
 *   - trades and orders lists
 *   - UI state (selected symbol, connection status)
 */
import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────
  isAuthenticated: !!localStorage.getItem('access_token'),
  username: localStorage.getItem('username') || '',

  login: (token, username) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('username', username)
    set({ isAuthenticated: true, username })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    set({ isAuthenticated: false, username: '' })
  },

  // ── Connection ────────────────────────────────────────────────────────────
  connectionStatus: 'disconnected', // connected | disconnected | reconnecting
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // ── Live Prices ───────────────────────────────────────────────────────────
  prices: {},   // { EURUSD: { bid, ask, last, spread, timestamp, direction } }

  updatePrice: (update) => {
    const { symbol, bid, ask, last, spread, timestamp } = update
    set((state) => {
      const prev = state.prices[symbol]
      const direction =
        prev?.last == null ? 'flat'
        : last > prev.last ? 'up'
        : last < prev.last ? 'down'
        : prev.direction ?? 'flat'
      return {
        prices: {
          ...state.prices,
          [symbol]: { bid, ask, last, spread, timestamp, direction },
        },
      }
    })
  },

  // ── Watchlist ─────────────────────────────────────────────────────────────
  watchlist: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'XAUUSD'],
  selectedSymbol: 'EURUSD',
  setSelectedSymbol: (sym) => set({ selectedSymbol: sym }),

  // ── Trades ────────────────────────────────────────────────────────────────
  trades: [],
  setTrades: (trades) => set({ trades }),
  updateTrade: (trade) =>
    set((state) => ({
      trades: state.trades.map((t) => (t.id === trade.id ? trade : t)),
    })),
  addTrade: (trade) =>
    set((state) => ({ trades: [trade, ...state.trades] })),

  // ── Orders ────────────────────────────────────────────────────────────────
  orders: [],
  setOrders: (orders) => set({ orders }),
  addOrder: (order) =>
    set((state) => ({ orders: [order, ...state.orders] })),
  updateOrder: (order) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === order.id ? order : o)),
    })),

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: [],
  addNotification: (msg, type = 'info') => {
    const id = Date.now()
    set((state) => ({
      notifications: [{ id, msg, type }, ...state.notifications].slice(0, 5),
    }))
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }))
    }, 4000)
  },
}))
