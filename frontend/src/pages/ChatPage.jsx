import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import TypingIndicator from '../components/TypingIndicator.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import { useToast } from '../hooks/useToast.js'

const QUICK_REPLIES = [
  '¿Cómo puedo calmarme ahora mismo?',
  'Quiero dormir mejor',
  'Me siento agobiado/a',
  'Quiero empezar a meditar',
  'Necesito más energía',
]

const CAT_EMOJI = {
  general: '⭐', bienestar: '🌿', sueño: '😴',
  ejercicio: '💪', mente: '🧘', social: '💬'
}

const MAX_CHARS = 1000

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  const y = new Date(today); y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })
}

function BotAvatar() {
  return (
    <img
      src="/contigo-bot.jpeg"
      alt="Contigo"
      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}
    />
  )
}

function UserInitials({ name }) {
  const i = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
  return <div className="chat-avatar chat-avatar--user">{i}</div>
}

function SuggestedGoalsCard({ goals, onAdd, onDismiss }) {
  const [added, setAdded]     = useState([])
  const [loading, setLoading] = useState(null)

  const handleAdd = async (goal, idx) => {
    if (added.includes(idx)) return
    setLoading(idx)
    await onAdd(goal)
    setAdded(prev => [...prev, idx])
    setLoading(null)
  }

  return (
    <div style={{
      margin: '4px 0 4px 38px',
      background: 'var(--teal-pale)',
      border: '1.5px solid var(--teal-light)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      maxWidth: '72%',
      boxShadow: 'var(--shadow-sm)',
      animation: 'bubbleIn .2s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <img src="/contigo-bot.jpeg" alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--teal-dark)' }}>
          Objetivos sugeridos para ti
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {goals.map((g, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: added.includes(i) ? 'var(--sage-light)' : 'var(--white)',
            border: `1.5px solid ${added.includes(i) ? 'var(--sage)' : 'var(--border)'}`,
            borderRadius: 10, padding: '9px 12px', transition: 'all 0.2s'
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{CAT_EMOJI[g.category] || '⭐'}</span>
            <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--navy)', textDecoration: added.includes(i) ? 'line-through' : 'none', opacity: added.includes(i) ? 0.6 : 1 }}>
              {g.title}
            </span>
            <button
              onClick={() => handleAdd(g, i)}
              disabled={added.includes(i) || loading === i}
              style={{
                padding: '4px 12px', borderRadius: 999, border: 'none',
                background: added.includes(i) ? 'var(--sage)' : 'var(--teal)',
                color: 'white', fontSize: '0.75rem', fontWeight: 500,
                cursor: added.includes(i) ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.2s'
              }}
            >
              {loading === i ? '...' : added.includes(i) ? '✓ Agregado' : '+ Agregar'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Link to="/goals" style={{ fontSize: '0.75rem', color: 'var(--teal-dark)', fontWeight: 600 }}>Ver todos mis objetivos →</Link>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--slate-light)' }}>Descartar</button>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { toasts, success, error: showError, info } = useToast()

  const [messages,        setMessages]        = useState([])
  const [text,            setText]            = useState('')
  const [typing,          setTyping]          = useState(false)
  const [loadingHist,     setLoadingHist]     = useState(true)
  const [isDemo,          setIsDemo]          = useState(false)
  const [goalSuggestions, setGoalSuggestions] = useState({})

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    axios.get('/api/chat/history')
      .then(({ data }) => {
        if (data.messages?.length > 0) {
          setMessages(data.messages)
        } else {
          setMessages([{ id: 'welcome', from: 'bot', text: `¡Hola, ${user?.name?.split(' ')[0] || 'bienvenido/a'}! Soy Contigo, estoy aquí para escucharte 🤍 ¿Cómo te sientes hoy?`, timestamp: new Date().toISOString() }])
        }
      })
      .catch(() => {
        setMessages([{ id: 'welcome', from: 'bot', text: '¡Hola! Soy Contigo, estoy aquí para escucharte 🤍 ¿Cómo te sientes hoy?', timestamp: new Date().toISOString() }])
      })
      .finally(() => setLoadingHist(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const handleAddGoal = useCallback(async (goal) => {
    try {
      await axios.post('/api/goals', goal)
      success(`Objetivo agregado: "${goal.title}" 🎯`)
    } catch { showError('No se pudo agregar el objetivo.') }
  }, [success, showError])

  const dismissSuggestion = useCallback((msgId) => {
    setGoalSuggestions(prev => { const n = { ...prev }; delete n[msgId]; return n })
  }, [])

  const send = useCallback(async (msgText) => {
    const msg = (msgText || text).trim()
    if (!msg || typing) return
    setText('')

    const userMsg = { id: Date.now(), from: 'user', text: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setTyping(true)

    try {
      const { data } = await axios.post('/api/chat', { message: msg })
      if (data.demo && !isDemo) { setIsDemo(true); info('Modo demo activo.') }
      const botId = Date.now() + 1
      setMessages(prev => [...prev, { id: botId, from: 'bot', text: data.reply, timestamp: new Date().toISOString() }])
      if (data.suggestedGoals?.length > 0) setGoalSuggestions(prev => ({ ...prev, [botId]: data.suggestedGoals }))

      // Si hay alerta de crisis, mostrar mensaje urgente de ayuda
      if (data.crisisAlert) {
        const crisisId = Date.now() + 2
        setMessages(prev => [...prev, { id: crisisId, from: 'bot', text: data.crisisAlert, timestamp: new Date().toISOString(), isCrisis: true }])
      }
    } catch (err) {
      if (err?.response?.status === 401) { showError('Tu sesión expiró.'); setTimeout(logout, 1500); return }
      setMessages(prev => [...prev, { id: Date.now() + 1, from: 'bot', text: err?.response?.data?.reply || 'Hubo un problema. ¿Lo intentamos de nuevo?', timestamp: new Date().toISOString() }])
    } finally {
      setTyping(false)
      inputRef.current?.focus()
    }
  }, [text, typing, isDemo, logout, showError, info])

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const handleClearHistory = async () => {
    if (!window.confirm('¿Borrar todo el historial?')) return
    try {
      await axios.delete('/api/chat/history')
      setMessages([{ id: 'reset', from: 'bot', text: 'Historial borrado. ¡Empecemos de nuevo! 🤍', timestamp: new Date().toISOString() }])
      setGoalSuggestions({})
      success('Historial borrado')
    } catch { showError('No se pudo borrar el historial.') }
  }

  const grouped = []
  let lastDate = null
  messages.forEach(m => {
    const d = formatDate(m.timestamp)
    if (d !== lastDate) { grouped.push({ type: 'date', label: d, key: `date-${m.id}` }); lastDate = d }
    grouped.push({ ...m, type: 'message' })
  })

  return (
    <div className="app-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Blobs for Chat */}
      <div className="anim-float" style={{
        position: 'fixed', top: '-10%', left: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, var(--teal-pale) 0%, transparent 70%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.6
      }} />
      <div className="anim-pulse" style={{
        position: 'fixed', bottom: '-15%', right: '-5%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, var(--sage-light) 0%, transparent 60%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.3
      }} />

      <Header actions={<button className="btn btn--outline btn--sm" style={{ border: 'none', background: 'transparent', color: 'var(--slate)' }} onClick={handleClearHistory} title="Borrar historial">🗑️</button>} />
      <ToastContainer toasts={toasts} />

      <div className="chat-wrapper" style={{ position: 'relative', zIndex: 1 }}>
        <div className="chat-messages" role="log">
          {loadingHist ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner spinner--dark" style={{ width: 28, height: 28 }} />
            </div>
          ) : (
            <>
              {isDemo && <div style={{ textAlign: 'center', paddingTop: 8 }}><span className="demo-badge">⚡ Modo demo</span></div>}
              {grouped.map(item =>
                item.type === 'date' ? (
                  <div className="chat-date-sep" key={item.key}>{item.label}</div>
                ) : (
                  <div key={item.id}>
                    <div className={`chat-bubble-row chat-bubble-row--${item.from}`}>
                      {item.from === 'bot' ? <BotAvatar /> : <UserInitials name={user?.name} />}
                      <div className="chat-bubble-wrap">
                        <div className={`chat-bubble chat-bubble--${item.from}${item.isCrisis ? ' chat-bubble--crisis' : ''}`}
                          style={item.isCrisis ? { whiteSpace: 'pre-line' } : undefined}
                        >{item.text}</div>
                        <span className="chat-time">{formatTime(item.timestamp)}</span>
                      </div>
                    </div>
                    {item.from === 'bot' && goalSuggestions[item.id] && (
                      <SuggestedGoalsCard goals={goalSuggestions[item.id]} onAdd={handleAddGoal} onDismiss={() => dismissSuggestion(item.id)} />
                    )}
                  </div>
                )
              )}
              {typing && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="chat-input-area">
          {messages.length <= 2 && !typing && (
            <div className="quick-replies anim-float">
              {QUICK_REPLIES.map(q => <button key={q} className="quick-reply" onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          <div className="chat-input-row" style={{ zIndex: 2 }}>
            <div className="chat-input-wrap">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Escribe tu mensaje... (Enter para enviar)"
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                disabled={typing || loadingHist}
                rows={1}
              />
              {text.length > 0 && (
                <div className={`chat-char-count ${text.length > MAX_CHARS * 0.85 ? 'chat-char-count--warn' : ''}`}>
                  {text.length}/{MAX_CHARS}
                </div>
              )}
            </div>
            <button className="chat-send-btn" onClick={() => send()} disabled={!text.trim() || typing || loadingHist}>
              {typing
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
