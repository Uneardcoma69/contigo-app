import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

import Home      from './pages/Home.jsx'
import Login     from './pages/Login.jsx'
import Register  from './pages/Register.jsx'
import ChatPage  from './pages/ChatPage.jsx'
import GoalsPage from './pages/GoalsPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import StaffPage from './pages/StaffPage.jsx'
import './index.css'

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
      background: 'var(--cream)'
    }}>
      <span style={{ fontSize: '2.5rem' }}>🌿</span>
      <p style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>Cargando...</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? children : <Navigate to="/login" replace />
}

// Solo staff (monitor / psicólogo / admin)
function RequireStaff({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return user.isStaff ? children : <Navigate to="/chat" replace />
}

// Solo admin
function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return user.isAdmin ? children : <Navigate to={user.isStaff ? '/staff' : '/chat'} replace />
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
          <Route path="/staff"    element={<RequireStaff><StaffPage /></RequireStaff>} />
          <Route path="/admin"    element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
