import express from 'express'
import bcrypt from 'bcryptjs'
import requireAdmin from '../middleware/requireAdmin.js'
import {
  getAllUsers, getAllRiskProfiles, getRiskProfile, getHistory, findUserById,
  findUserByEmail, createUser, setUserRole, assignPatient, getStaffMembers,
  ROLES, STAFF_ROLES
} from '../store.js'

const router = express.Router()

// GET /api/admin/dashboard — Panel principal con todos los perfiles de riesgo
router.get('/dashboard', requireAdmin, (_req, res) => {
  // Solo pacientes (role 'user') — el staff no aparece en el panel de riesgo
  const allUsers = getAllUsers().filter(u => u.role === 'user')
  const riskProfiles = getAllRiskProfiles()

  // Crear un mapa rápido de perfiles por userId
  const riskMap = new Map(riskProfiles.map(r => [r.userId, r]))

  // Combinar usuarios con sus perfiles de riesgo
  const usersWithRisk = allUsers.map(user => {
    const risk = riskMap.get(user._id)
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      assignedPsychologistId: user.assignedPsychologistId,
      risk: risk ? {
        level: risk.level,
        score: risk.score,
        lastMessage: risk.lastMessage,
        triggerWords: risk.triggerWords,
        lastAnalysis: risk.lastAnalysis,
        alertCount: risk.alerts.length
      } : {
        level: 'sin_datos',
        score: 0,
        lastMessage: null,
        triggerWords: [],
        lastAnalysis: null,
        alertCount: 0
      }
    }
  })

  // Estadísticas globales
  const stats = {
    total: allUsers.length,
    alto: usersWithRisk.filter(u => u.risk.level === 'alto').length,
    medio: usersWithRisk.filter(u => u.risk.level === 'medio').length,
    bajo: usersWithRisk.filter(u => u.risk.level === 'bajo').length,
    sinDatos: usersWithRisk.filter(u => u.risk.level === 'sin_datos').length
  }

  // Ordenar: alto primero, luego medio, luego bajo
  const LEVEL_ORDER = { alto: 0, medio: 1, bajo: 2, sin_datos: 3 }
  usersWithRisk.sort((a, b) => LEVEL_ORDER[a.risk.level] - LEVEL_ORDER[b.risk.level])

  return res.json({ stats, users: usersWithRisk })
})

// GET /api/admin/user/:id — Detalle de un usuario específico
router.get('/user/:id', requireAdmin, (req, res) => {
  const user = findUserById(req.params.id)
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

  const riskProfile = getRiskProfile(req.params.id)
  const chatHistory = getHistory(req.params.id).slice(-30).map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.createdAt
  }))

  return res.json({
    user: { _id: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
    risk: riskProfile || { level: 'sin_datos', score: 0, alerts: [], triggerWords: [] },
    recentMessages: chatHistory
  })
})

// ── Gestión de equipo ──────────────────────────────────────────

// GET /api/admin/staff — lista de staff
router.get('/staff', requireAdmin, (_req, res) => {
  return res.json({ staff: getStaffMembers() })
})

// POST /api/admin/staff — crear cuenta de staff (psicólogo/monitor/admin)
router.post('/staff', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {}
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: 'Nombre, correo y contraseña son requeridos.' })
    if (password.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })
    if (!STAFF_ROLES.includes(role))
      return res.status(400).json({ message: `Rol inválido. Usa: ${STAFF_ROLES.join(', ')}.` })
    if (findUserByEmail(email))
      return res.status(409).json({ message: 'Este correo ya está registrado.' })

    const hash = await bcrypt.hash(password, 12)
    const user = createUser({ name, email, password: hash, role })
    return res.status(201).json({
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    })
  } catch (e) {
    console.error('Create staff error:', e)
    return res.status(500).json({ message: 'Error al crear la cuenta de staff.' })
  }
})

// PUT /api/admin/users/:id/role — cambiar rol de un usuario
router.put('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body || {}
  if (!ROLES.includes(role))
    return res.status(400).json({ message: `Rol inválido. Usa: ${ROLES.join(', ')}.` })
  const user = findUserById(req.params.id)
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
  if (user._id === req.userId && role !== 'admin')
    return res.status(400).json({ message: 'No puedes quitarte tu propio rol de admin.' })
  setUserRole(user._id, role)
  return res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } })
})

// PUT /api/admin/patients/:id/assign — asignar paciente a un psicólogo/monitor
router.put('/patients/:id/assign', requireAdmin, (req, res) => {
  const { staffId } = req.body || {}   // null para desasignar
  const patient = assignPatient(req.params.id, staffId ?? null)
  if (!patient)
    return res.status(400).json({ message: 'Paciente o miembro de staff inválido.' })
  return res.json({
    patient: {
      _id: patient._id,
      name: patient.name,
      email: patient.email,
      assignedPsychologistId: patient.assignedPsychologistId
    }
  })
})

export default router
