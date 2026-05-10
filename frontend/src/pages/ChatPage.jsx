import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'
import CrisisBanner from '../components/CrisisBanner.jsx'
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

// Iconos por categoría de objetivo. Se reemplazaron emojis para una UI
// más sobria. El color marca la categoría visualmente.
const CAT_META = {
  general:   { icon: 'star',     color: '#f6ad55' },
  bienestar: { icon: 'leaf',     color: '#68d391' },
  sueño:     { icon: 'moon',     color: '#76e4f7' },
  ejercicio: { icon: 'dumbbell', color: '#fc8181' },
  mente:     { icon: 'brain',    color: '#b794f4' },
  social:    { icon: 'users',    color: '#63b3ed' },
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
      className="chat-bot-avatar"
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
    <div className="suggest-goals">
      <div className="suggest-goals__header">
        <Icon name="target" size={16} color="var(--teal-dark)" />
        <p className="suggest-goals__title">Objetivos sugeridos para ti</p>
      </div>
      <div className="suggest-goals__list">
        {goals.map((g, i) => {
          const meta = CAT_META[g.category] || CAT_META.general
          const isAdded = added.includes(i)
          return (
            <div key={i} className={`suggest-goals__item ${isAdded ? 'is-added' : ''}`}>
              <span className="suggest-goals__cat" style={{ background: `${meta.color}20`, color: meta.color }}>
                <Icon name={meta.icon} size={14} />
              </span>
              <span className={`suggest-goals__text ${isAdded ? 'is-added' : ''}`}>{g.title}</span>
              <button
                onClick={() => handleAdd(g, i)}
                disabled={isAdded || loading === i}
                className={`suggest-goals__btn ${isAdded ? 'is-added' : ''}`}
              >
                {loading === i
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : isAdded
                    ? <><Icon name="check" size={12} /> Agregado</>
                    : <><Icon name="plus" size={12} /> Agregar</>}
              </button>
            </div>
          )
        })}
      </div>
      <div className="suggest-goals__footer">
        <Link to="/goals" className="suggest-goals__link">
          Ver todos mis objetivos <Icon name="arrowRight" size={12} />
        </Link>
        <button onClick={onDismiss} className="suggest-goals__dismiss">Descartar</button>
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
  const [crisisLevel,     setCrisisLevel]     = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    axios.get('/api/chat/history')
      .then(({ data }) => {
        if (data.messages?.length > 0) {
          setMessages(data.messages)
        } else {
          setMessages([{ id: 'welcome', from: 'bot', text: `Hola ${user?.name?.split(' ')[0] || ''}, soy Contigo. Estoy aquí para escucharte. ¿Cómo te sientes hoy?`, timestamp: new Date().toISOString() }])
        }
      })
      .catch(() => {
        setMessages([{ id: 'welcome', from: 'bot', text: 'Hola, soy Contigo. Estoy aquí para escucharte. ¿Cómo te sientes hoy?', timestamp: new Date().toISOString() }])
      })
      .finally(() => setLoadingHist(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const handleAddGoal = useCallback(async (goal) => {
    try {
      await axios.post('/api/goals', goal)
      success(`Objetivo agregado: ${goal.title}`)
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
      if (data.risk && (data.risk.level === 'L2' || data.risk.level === 'L3')) {
        setCrisisLevel(data.risk.level)
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
      setMessages([{ id: 'reset', from: 'bot', text: 'Historial borrado. Empecemos de nuevo cuando quieras.', timestamp: new Date().toISOString() }])
      setGoalSuggestions({})
      setCrisisLevel(null)
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
    <div className="app-layout">
      <Header actions={
        <button className="btn btn--ghost btn--sm" onClick={handleClearHistory} title="Borrar historial" aria-label="Borrar historial">
          <Icon name="trash" size={16} />
        </button>
      } />
      <ToastContainer toasts={toasts} />

      <div className="chat-wrapper">
        {crisisLevel && (
          <CrisisBanner
            level={crisisLevel}
            country="default"
            onClose={() => setCrisisLevel(null)}
          />
        )}

        <div className="chat-messages" role="log">
          {loadingHist ? (
            <div className="chat-loading">
              <span className="spinner spinner--dark" style={{ width: 28, height: 28 }} />
            </div>
          ) : (
            <>
              {isDemo && <div style={{ textAlign: 'center', paddingTop: 8 }}><span className="demo-badge">Modo demo</span></div>}
              {grouped.map(item =>
                item.type === 'date' ? (
                  <div className="chat-date-sep" key={item.key}>{item.label}</div>
                ) : (
                  <div key={item.id}>
                    <div className={`chat-bubble-row chat-bubble-row--${item.from}`}>
                      {item.from === 'bot' ? <BotAvatar /> : <UserInitials name={user?.name} />}
                      <div className="chat-bubble-wrap">
                        <div className={`chat-bubble chat-bubble--${item.from}`}>{item.text}</div>
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
            <div className="quick-replies">
              {QUICK_REPLIES.map(q => <button key={q} className="quick-reply" onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          <div className="chat-input-row">
            <div className="chat-input-wrap">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Escribe tu mensaje..."
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
            <button className="chat-send-btn" onClick={() => send()} disabled={!text.trim() || typing || loadingHist} aria-label="Enviar">
              {typing
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : <Icon name="send" size={18} color="white" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
