import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

import Home        from './pages/Home.jsx'
import Login       from './pages/Login.jsx'
import Register    from './pages/Register.jsx'
import ChatPage    from './pages/ChatPage.jsx'
import GoalsPage   from './pages/GoalsPage.jsx'
import HeatmapPage from './pages/HeatmapPage.jsx'
import Icon        from './components/Icon.jsx'
import './index.css'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
      background: 'var(--cream)'
    }}>
      <Icon name="leaf" size={36} color="var(--teal-dark)" />
      <p style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>Cargando...</p>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat"     element={<RequireAuth><ChatPage /></RequireAuth>} />
          <Route path="/goals"    element={<RequireAuth><GoalsPage /></RequireAuth>} />
          <Route path="/timeline" element={<RequireAuth><HeatmapPage /></RequireAuth>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
