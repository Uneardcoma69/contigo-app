// ─── In-Memory Store (reemplaza MongoDB) ─────────────────────
// Por defecto los datos viven en memoria y se pierden al reiniciar.
// Si CONTIGO_DATA_DIR está definido (app de escritorio), los datos
// se guardan automáticamente en un archivo JSON y sobreviven reinicios.

import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

const users           = new Map()  // Map<id, user>
const conversations   = new Map()  // Map<userId, message[]>
const goals           = new Map()  // Map<userId, goal[]>
const riskAlerts      = new Map()  // Map<userId, riskProfile>
const medicalRecords  = new Map()  // Map<userId, medicalRecord>
const progressNotes   = new Map()  // Map<patientId, note[]>
const appointments    = new Map()  // Map<id, appointment>
const contactMessages = new Map()  // Map<id, mensaje del formulario público>

// ── Persistencia opcional a archivo JSON ───────────────────────
const DATA_DIR  = process.env.CONTIGO_DATA_DIR || null
const DATA_FILE = DATA_DIR ? path.join(DATA_DIR, 'contigo-data.json') : null
const ALL_MAPS  = { users, conversations, goals, riskAlerts, medicalRecords, progressNotes, appointments, contactMessages }
let lastSnapshot = ''

function serialize() {
  const dump = {}
  for (const [name, map] of Object.entries(ALL_MAPS)) {
    dump[name] = Array.from(map.entries())
  }
  return JSON.stringify(dump)
}

function saveToDisk() {
  if (!DATA_FILE) return
  try {
    const snapshot = serialize()
    if (snapshot === lastSnapshot) return   // sin cambios
    fs.mkdirSync(DATA_DIR, { recursive: true })
    // Escritura atómica: primero a .tmp y luego renombrar
    const tmp = DATA_FILE + '.tmp'
    fs.writeFileSync(tmp, snapshot)
    fs.renameSync(tmp, DATA_FILE)
    lastSnapshot = snapshot
  } catch (e) {
    console.error('⚠️ Error guardando datos:', e.message)
  }
}

function loadFromDisk() {
  if (!DATA_FILE || !fs.existsSync(DATA_FILE)) return
  try {
    const dump = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    for (const [name, map] of Object.entries(ALL_MAPS)) {
      for (const [k, v] of dump[name] || []) map.set(k, v)
    }
    lastSnapshot = serialize()
    console.log(`💾 Datos cargados desde ${DATA_FILE} (${users.size} usuarios)`)
  } catch (e) {
    console.error('⚠️ Error cargando datos guardados:', e.message)
  }
}

if (DATA_FILE) {
  loadFromDisk()
  // Guardado periódico (solo escribe si hubo cambios) + al salir
  const interval = setInterval(saveToDisk, 3000)
  interval.unref?.()
  process.on('exit', saveToDisk)
  process.on('SIGINT', () => { saveToDisk(); process.exit(0) })
  process.on('SIGTERM', () => { saveToDisk(); process.exit(0) })
}

// Roles válidos: 'user' | 'monitor' | 'psychologist' | 'admin'
export const ROLES = ['user', 'monitor', 'psychologist', 'admin']
export const STAFF_ROLES = ['monitor', 'psychologist', 'admin']

// ── Usuarios ───────────────────────────────────────────────────
export function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null
  for (const u of users.values()) {
    if (u.email === email.toLowerCase()) return u
  }
  return null
}

export function findUserById(id) {
  return users.get(id) || null
}

export function createUser({ name, email, password, role = 'user' }) {
  const id = randomUUID()
  const user = {
    _id: id,
    name: name.trim(),
    email: email.toLowerCase(),
    password,
    role: ROLES.includes(role) ? role : 'user',
    assignedPsychologistId: null,  // solo aplica a pacientes (role 'user')
    tokenVersion: 0,               // al subir, invalida las sesiones abiertas
    createdAt: new Date()
  }
  users.set(id, user)
  return user
}

export function setUserRole(id, role) {
  const user = users.get(id)
  if (!user || !ROLES.includes(role)) return null
  user.role = role
  return user
}

/**
 * Cambia la contraseña. No invalida sesiones por sí sola: quien cambia
 * una contraseña de verdad debe llamar además a bumpTokenVersion().
 * (El arranque de la app de escritorio la re-aplica en cada inicio y no
 * debe cerrar la sesión del administrador.)
 */
export function setUserPassword(id, passwordHash) {
  const user = users.get(id)
  if (!user) return null
  user.password = passwordHash
  return user
}

/** Invalida todas las sesiones abiertas de ese usuario. */
export function bumpTokenVersion(id) {
  const user = users.get(id)
  if (!user) return null
  user.tokenVersion = (user.tokenVersion || 0) + 1
  return user
}

export function assignPatient(patientId, staffId) {
  const patient = users.get(patientId)
  if (!patient || patient.role !== 'user') return null
  if (staffId !== null) {
    const staff = users.get(staffId)
    if (!staff || !STAFF_ROLES.includes(staff.role)) return null
  }
  patient.assignedPsychologistId = staffId
  return patient
}

export function getAllUsers() {
  return Array.from(users.values()).map(u => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    assignedPsychologistId: u.assignedPsychologistId || null,
    createdAt: u.createdAt
  }))
}

export function getStaffMembers() {
  return getAllUsers().filter(u => STAFF_ROLES.includes(u.role))
}

export function getPatients() {
  return getAllUsers().filter(u => u.role === 'user')
}

export function getPatientsOf(staffId) {
  return getPatients().filter(p => p.assignedPsychologistId === staffId)
}

// ── Conversaciones ─────────────────────────────────────────────
export function getHistory(userId) {
  return conversations.get(userId) || []
}

export function addMessage(userId, role, content) {
  const msgs = conversations.get(userId) || []
  msgs.push({ _id: randomUUID(), role, content, createdAt: new Date() })
  // Límite amplio: el staff necesita el historial para el seguimiento clínico
  if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
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

// ── Alertas de Riesgo ──────────────────────────────────────────
export function updateRiskLevel(userId, { userName, userEmail, level, score, lastMessage, triggerWords }) {
  const existing = riskAlerts.get(userId) || {
    userId,
    userName,
    userEmail,
    level: 'bajo',
    score: 0,
    lastMessage: '',
    triggerWords: [],
    lastAnalysis: null,
    alerts: []
  }

  // Solo actualizar si el nuevo nivel es >= al actual, o siempre registrar
  existing.userName = userName
  existing.userEmail = userEmail
  existing.lastAnalysis = new Date()

  // Solo escalar el nivel, nunca bajarlo automáticamente en la misma sesión
  const LEVEL_ORDER = { bajo: 0, medio: 1, alto: 2 }
  if (LEVEL_ORDER[level] >= LEVEL_ORDER[existing.level]) {
    existing.level = level
  }
  existing.score = Math.max(existing.score, score)
  existing.lastMessage = lastMessage
  existing.triggerWords = triggerWords

  // Agregar al historial de alertas si tiene score > 0
  if (score > 0) {
    existing.alerts.push({
      level,
      score,
      message: lastMessage,
      triggerWords: [...triggerWords],
      timestamp: new Date()
    })
    // Limitar historial a últimas 50 alertas
    if (existing.alerts.length > 50) {
      existing.alerts = existing.alerts.slice(-50)
    }
  }

  riskAlerts.set(userId, existing)
  return existing
}

export function getRiskProfile(userId) {
  return riskAlerts.get(userId) || null
}

export function getAllRiskProfiles() {
  return Array.from(riskAlerts.values())
}

// ── Fichas médicas ─────────────────────────────────────────────
// El paciente registra su información; el staff la valida.
export function getMedicalRecord(userId) {
  return medicalRecords.get(userId) || null
}

export function upsertMedicalRecord(userId, info) {
  const existing = medicalRecords.get(userId) || {
    userId,
    info: {},
    validationStatus: 'pendiente',   // 'pendiente' | 'validada' | 'rechazada'
    validatedBy: null,
    validatedByName: null,
    validationNote: '',
    validatedAt: null,
    createdAt: new Date()
  }
  existing.info = { ...existing.info, ...info }
  existing.updatedAt = new Date()
  // Si el paciente edita su ficha, vuelve a quedar pendiente de validación
  existing.validationStatus = 'pendiente'
  medicalRecords.set(userId, existing)
  return existing
}

export function validateMedicalRecord(userId, { staffId, staffName, status, note }) {
  const record = medicalRecords.get(userId)
  if (!record) return null
  if (!['validada', 'rechazada', 'pendiente'].includes(status)) return null
  record.validationStatus = status
  record.validatedBy = staffId
  record.validatedByName = staffName
  record.validationNote = note || ''
  record.validatedAt = new Date()
  medicalRecords.set(userId, record)
  return record
}

// ── Notas de progreso (staff sobre pacientes) ──────────────────
export function getProgressNotes(patientId) {
  return progressNotes.get(patientId) || []
}

export function addProgressNote(patientId, { authorId, authorName, text }) {
  const list = progressNotes.get(patientId) || []
  const note = {
    _id: randomUUID(),
    authorId,
    authorName,
    text: text.trim(),
    createdAt: new Date()
  }
  list.push(note)
  progressNotes.set(patientId, list)
  return note
}

// ── Citas / Calendario ─────────────────────────────────────────
export function createAppointment({ patientId, psychologistId, date, durationMin, modality, notes }) {
  const id = randomUUID()
  const appt = {
    _id: id,
    patientId,
    psychologistId,
    date: new Date(date),
    durationMin: durationMin || 50,
    modality: modality === 'presencial' ? 'presencial' : 'online',
    status: 'programada',   // 'programada' | 'completada' | 'cancelada'
    notes: notes || '',
    createdAt: new Date()
  }
  appointments.set(id, appt)
  return appt
}

export function getAppointmentById(id) {
  return appointments.get(id) || null
}

export function getAllAppointments() {
  return Array.from(appointments.values())
}

export function getAppointmentsForStaff(staffId) {
  return getAllAppointments().filter(a => a.psychologistId === staffId)
}

export function getAppointmentsForPatient(patientId) {
  return getAllAppointments().filter(a => a.patientId === patientId)
}

export function updateAppointment(id, changes) {
  const appt = appointments.get(id)
  if (!appt) return null
  if (changes.date !== undefined) appt.date = new Date(changes.date)
  if (changes.durationMin !== undefined) appt.durationMin = changes.durationMin
  if (changes.modality !== undefined && ['online', 'presencial'].includes(changes.modality)) appt.modality = changes.modality
  if (changes.status !== undefined && ['programada', 'completada', 'cancelada'].includes(changes.status)) appt.status = changes.status
  if (changes.notes !== undefined) appt.notes = changes.notes
  appointments.set(id, appt)
  return appt
}

export function deleteAppointment(id) {
  return appointments.delete(id)
}

// ── Mensajes del formulario de contacto (landing) ──────────────
export function createContactMessage({ nombre, correo, telefono, motivo, mensaje }) {
  const id = randomUUID()
  const msg = {
    _id: id,
    nombre: String(nombre).trim().slice(0, 120),
    correo: String(correo).trim().toLowerCase().slice(0, 160),
    telefono: telefono ? String(telefono).trim().slice(0, 30) : '',
    motivo: motivo ? String(motivo).trim().slice(0, 80) : '',
    mensaje: String(mensaje).trim().slice(0, 2000),
    createdAt: new Date()
  }
  contactMessages.set(id, msg)
  // Conservar solo los últimos 500 mensajes
  if (contactMessages.size > 500) {
    const oldest = contactMessages.keys().next().value
    contactMessages.delete(oldest)
  }
  return msg
}

export function getContactMessages() {
  return Array.from(contactMessages.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
