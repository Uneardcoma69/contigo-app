// ─── In-Memory Store (reemplaza MongoDB) ─────────────────────
// Los datos se pierden al reiniciar el servidor.
// Perfecto para desarrollo y pruebas sin base de datos.

import { randomUUID } from 'crypto'

const users         = new Map()  // Map<id, user>
const conversations = new Map()  // Map<userId, message[]>
const goals         = new Map()  // Map<userId, goal[]>
const riskEvents    = new Map()  // Map<userId, riskEvent[]>

// ── Usuarios ───────────────────────────────────────────────────
export function findUserByEmail(email) {
  for (const u of users.values()) {
    if (u.email === email.toLowerCase()) return u
  }
  return null
}

export function findUserById(id) {
  return users.get(id) || null
}

export function createUser({ name, email, password }) {
  const id = randomUUID()
  const user = {
    _id: id,
    name: name.trim(),
    email: email.toLowerCase(),
    password,
    createdAt: new Date()
  }
  users.set(id, user)
  return user
}

// ── Conversaciones ─────────────────────────────────────────────
export function getHistory(userId) {
  return conversations.get(userId) || []
}

export function addMessage(userId, role, content) {
  const msgs = conversations.get(userId) || []
  msgs.push({ _id: randomUUID(), role, content, createdAt: new Date() })
  if (msgs.length > 60) msgs.splice(0, msgs.length - 60)
  conversations.set(userId, msgs)
}

export function clearHistory(userId) {
  conversations.set(userId, [])
}

// ── Objetivos ──────────────────────────────────────────────────
export function getGoals(userId) {
  return goals.get(userId) || []
}

export function createGoal(userId, { title, category }) {
  const list = goals.get(userId) || []
  const goal = {
    _id: randomUUID(),
    title: title.trim(),
    category: category || 'general',
    completed: false,
    createdAt: new Date()
  }
  list.push(goal)
  goals.set(userId, list)
  return goal
}

export function toggleGoal(userId, goalId) {
  const list = goals.get(userId) || []
  const goal = list.find(g => g._id === goalId)
  if (!goal) return null
  goal.completed = !goal.completed
  goal.completedAt = goal.completed ? new Date() : null
  goals.set(userId, list)
  return goal
}

export function deleteGoal(userId, goalId) {
  const list = goals.get(userId) || []
  const filtered = list.filter(g => g._id !== goalId)
  goals.set(userId, filtered)
  return filtered.length < list.length
}

// ── Eventos de riesgo ──────────────────────────────────────────
// Cada análisis con level !== 'none' genera un evento.
// Se conservan los últimos 365 días por usuario.

export function addRiskEvent(userId, { level, score, matches, messageId }) {
  const list = riskEvents.get(userId) || []
  const event = {
    _id: randomUUID(),
    level,
    score,
    terms: matches.filter(m => !m.negated).map(m => m.term),
    messageId: messageId || null,
    createdAt: new Date()
  }
  list.push(event)

  // Purga eventos > 365 días
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000
  const trimmed = list.filter(e => e.createdAt.getTime() >= cutoff)
  riskEvents.set(userId, trimmed)
  return event
}

export function getRiskEvents(userId, { since } = {}) {
  const list = riskEvents.get(userId) || []
  if (!since) return list
  const cutoff = since instanceof Date ? since.getTime() : new Date(since).getTime()
  return list.filter(e => e.createdAt.getTime() >= cutoff)
}

// Agrega eventos por día (YYYY-MM-DD). Devuelve el día con su score máximo,
// nivel más alto y conteo. Los días sin eventos NO se incluyen — el frontend
// rellena el calendario completo.
export function getRiskHeatmap(userId, days = 90) {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (days - 1))

  const events = getRiskEvents(userId, { since: cutoff })
  const byDay = new Map()
  const order = { L1: 1, L2: 2, L3: 3 }

  for (const e of events) {
    const d = new Date(e.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const cell = byDay.get(key) || { date: key, count: 0, maxScore: 0, level: 'none' }
    cell.count += 1
    if (e.score > cell.maxScore) cell.maxScore = e.score
    if (order[e.level] > (order[cell.level] || 0)) cell.level = e.level
    byDay.set(key, cell)
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
}
