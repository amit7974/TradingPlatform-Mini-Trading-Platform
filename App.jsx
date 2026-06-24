import { useStore } from './store/store'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Dashboard /> : <LoginScreen />
}
