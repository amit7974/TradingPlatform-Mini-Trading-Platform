/**
 * Dashboard.jsx
 * Main trading dashboard layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  TopBar                                              │
 *   ├──────────┬──────────────────────┬───────────────────┤
 *   │ Watchlist│ Chart                │ OrderTicket        │
 *   │ (left)   │ + Positions (center) │ (right)            │
 *   │          ├──────────────────────┤                   │
 *   │          │ OrdersBlotter        │                   │
 *   └──────────┴──────────────────────┴───────────────────┘
 */
import { useEffect } from 'react'
import { marketAPI, tradesAPI, ordersAPI } from '../services/api'
import { useStore } from '../store/store'
import { useMarketStream } from '../hooks/useMarketStream'

import TopBar from './TopBar'
import Watchlist from './Watchlist'
import PriceChart from './PriceChart'
import OrderTicket from './OrderTicket'
import PositionsTable from './PositionsTable'
import OrdersBlotter from './OrdersBlotter'
import Notifications from './Notifications'

export default function Dashboard() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const setTrades = useStore((s) => s.setTrades)
  const setOrders = useStore((s) => s.setOrders)

  // Start SSE price stream
  useMarketStream(isAuthenticated)

  // Load initial data on mount
  useEffect(() => {
    if (!isAuthenticated) return

    const load = async () => {
      try {
        // Subscribe to default watchlist
        const symRes = await marketAPI.getSymbols()
        const symbols = symRes.data.symbols?.slice(0, 5) ?? []
        await Promise.all(symbols.map((s) => marketAPI.subscribe(s)))
      } catch (_) {}

      try {
        const tRes = await tradesAPI.list()
        setTrades(tRes.data.trades)
      } catch (_) {}

      try {
        const oRes = await ordersAPI.list()
        setOrders(oRes.data.orders)
      } catch (_) {}
    }

    load()
  }, [isAuthenticated])

  return (
    <div style={styles.root}>
      <TopBar />

      <div style={styles.body}>
        {/* Left: watchlist */}
        <div style={styles.leftPane}>
          <Watchlist />
        </div>

        {/* Center: chart + blotters */}
        <div style={styles.centerPane}>
          <PriceChart />
          <div style={styles.blotterArea}>
            <div style={styles.halfPanel}>
              <PositionsTable />
            </div>
            <div style={styles.halfPanel}>
              <OrdersBlotter />
            </div>
          </div>
        </div>

        {/* Right: order ticket */}
        <div style={styles.rightPane}>
          <OrderTicket />
        </div>
      </div>

      <Notifications />
    </div>
  )
}

const styles = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#080c14',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#f1f5f9',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  leftPane: {
    width: 210,
    minWidth: 210,
    borderRight: '1px solid #1e2d45',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  centerPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #1e2d45',
  },
  blotterArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    borderTop: '1px solid #1e2d45',
  },
  halfPanel: {
    flex: 1,
    overflow: 'hidden',
    borderRight: '1px solid #1e2d45',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPane: {
    width: 260,
    minWidth: 260,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
}
