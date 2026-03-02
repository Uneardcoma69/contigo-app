// ─── In-Memory Store (reemplaza MongoDB) ─────────────────────
// Los datos se pierden al reiniciar el servidor.
// Perfecto para desarrollo y pruebas sin base de datos.

import { randomUUID } from 'crypto'

const users         = new Map()  // Map<id, user>
const conversations = new Map()  // Map<userId, message[]>
const goals         = new Map()  // Map<userId, goal[]>

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
