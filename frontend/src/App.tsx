import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme'
import Layout from './components/Layout'
import HistoryPage from './pages/HistoryPage'
import LiveViewPage from './pages/LiveViewPage'
import SettingsPage from './pages/SettingsPage'
import { StatusUpdate } from './types'

export default function App() {
  const [status, setStatus] = useState<StatusUpdate | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`)
      wsRef.current = ws
      ws.onmessage = e => {
        try { setStatus(JSON.parse(e.data)) } catch { /* ignore */ }
      }
      ws.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Layout status={status}>
          <Routes>
            <Route path="/" element={<LiveViewPage status={status} />} />
            <Route path="/history" element={<HistoryPage status={status} />} />
            <Route path="/settings" element={<SettingsPage status={status} />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  )
}
