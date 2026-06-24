/**
 * api.js
 * Central Axios instance. Attaches the stored JWT to every request.
 * On 401, clears credentials so the login screen is shown.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
})

// ── Request interceptor: inject auth token ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 / global errors ─────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  status: () => api.get('/auth/status'),
}

// ── Market ────────────────────────────────────────────────────────────────────
export const marketAPI = {
  getSymbols: () => api.get('/market/symbols'),
  getSnapshot: () => api.get('/market/snapshot'),
  subscribe: (symbol) => api.post('/market/subscribe', { symbol }),
  unsubscribe: (symbol) => api.delete(`/market/subscribe/${symbol}`),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersAPI = {
  list: () => api.get('/orders'),
  place: (payload) => api.post('/orders', payload),
  cancel: (id) => api.delete(`/orders/${id}`),
}

// ── Trades ────────────────────────────────────────────────────────────────────
export const tradesAPI = {
  list: () => api.get('/trades'),
  get: (id) => api.get(`/trades/${id}`),
  close: (id) => api.post(`/trades/${id}/close`),
}

export default api
