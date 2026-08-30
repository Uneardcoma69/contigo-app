import express from 'express'
import bcrypt from 'bcryptjs'
import requireAdmin from '../middleware/requireAdmin.js'
import {
  getAllUsers, getRiskSummaries, getRiskProfile, getHistory, findUserById,
  findUserByEmail, createUser, setUserRole, assignPatient, getStaffMembers,
  getContactMessages, setUserPassword, bumpTokenVersion,
  getAuditLog, AUDIT_ACTIONS, ROLES, STAFF_ROLES
} from '../store.js'
import { isDesktop, updateConfig } from '../desktopConfig.js'
import { auditar } from '../auditoria.js'

const router = express.Router()

// GET /api/admin/dashboard — Panel principal con todos los perfiles de riesgo
router.get('/dashboard', requireAdmin, (_req, res) => {
  // Solo pacientes (role 'user') — el staff no aparece en el panel de riesgo
  const allUsers = getAllUsers().filter(u => u.role === 'user')

  // Resúmenes con el conteo de alertas ya hecho. Antes se cargaban las
  // alertas completas de cada paciente —una consulta por persona— para
  // acabar usando solo cuántas eran, y este panel se refresca solo cada
  // 15 segundos, así que el coste se repetía en segundo plano sin parar.
  const riskMap = getRiskSummaries()

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
        alertCount: risk.alertCount
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
  const chatHistory = getHistory(req.params.id, 30).map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.createdAt
  }))

  // Este detalle incluye los últimos mensajes del chat
  auditar(req, 'alertas.ver-detalle', { targetId: user._id, targetName: user.name })

  return res.json({
    user: { _id: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
    risk: riskProfile || { level: 'sin_datos', score: 0, alerts: [], triggerWords: [] },
    recentMessages: chatHistory
  })
})

// GET /api/admin/contact-messages — bandeja del formulario público
router.get('/contact-messages', requireAdmin, (_req, res) => {
  return res.json({ messages: getContactMessages() })
})

// ── Ajustes de la aplicación ───────────────────────────────────
function currentProvider() {
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'demo'
}

/** La clave del proveedor que está activo, no siempre la de DeepSeek. */
function currentKey() {
  return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
}

// GET /api/admin/settings — estado de la IA (nunca devuelve la clave)
router.get('/settings', requireAdmin, (_req, res) => {
  // Antes se miraba solo DEEPSEEK_API_KEY: con OpenAI configurado, la
  // respuesta decía a la vez provider:'openai' y aiConfigured:false, y el
  // panel mostraba "IA no configurada" mientras la IA estaba funcionando.
  const key = currentKey()
  return res.json({
    provider: currentProvider(),
    aiConfigured: !!key,
    keyPreview: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : '',
    canEdit: isDesktop()
  })
})

// PUT /api/admin/settings — guardar/borrar la clave de IA
router.put('/settings', requireAdmin, (req, res) => {
  if (!isDesktop())
    return res.status(400).json({ message: 'La configuración solo puede editarse desde la app de escritorio.' })

  const { deepseekApiKey } = req.body || {}
  if (typeof deepseekApiKey !== 'string')
    return res.status(400).json({ message: 'Clave inválida.' })

  const key = deepseekApiKey.trim()
  if (key && key.length > 200)
    return res.status(400).json({ message: 'La clave es demasiado larga.' })

  if (!updateConfig({ deepseekApiKey: key }))
    return res.status(500).json({ message: 'No se pudo guardar la configuración.' })

  // Aplicar de inmediato, sin reiniciar la app
  if (key) process.env.DEEPSEEK_API_KEY = key
  else delete process.env.DEEPSEEK_API_KEY

  // Se recalcula tras aplicar el cambio: al borrar la clave de DeepSeek, si
  // hay una de OpenAI en el entorno, el proveedor activo pasa a ser esa.
  const activa = currentKey()
  return res.json({
    provider: currentProvider(),
    aiConfigured: !!activa,
    keyPreview: activa ? `${activa.slice(0, 6)}…${activa.slice(-4)}` : '',
    canEdit: true
  })
})

// ── Registro de auditoría ──────────────────────────────────────
// GET /api/admin/audit-log — quién consultó o modificó qué, y cuándo.
// Consultar el propio registro no se audita: llenaría la bitácora de
// entradas sobre sí misma sin aportar nada.
router.get('/audit-log', requireAdmin, (req, res) => {
  const { actorId, targetId, action, limit, offset } = req.query
  const resultado = getAuditLog({
    actorId: actorId || undefined,
    targetId: targetId || undefined,
    action: action || undefined,
    limit: limit ? Number(limit) : 100,
    offset: offset ? Number(offset) : 0
  })
  return res.json({ ...resultado, acciones: AUDIT_ACTIONS })
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
    if (name.trim().length > 120)
      return res.status(400).json({ message: 'El nombre es demasiado largo.' })
    if (password.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })
    if (!STAFF_ROLES.includes(role))
      return res.status(400).json({ message: `Rol inválido. Usa: ${STAFF_ROLES.join(', ')}.` })
    if (findUserByEmail(email))
      return res.status(409).json({ message: 'Este correo ya está registrado.' })

    const hash = await bcrypt.hash(password, 12)
    const user = createUser({ name, email, password: hash, role })
    auditar(req, 'staff.crear', {
      targetId: user._id, targetName: user.name, details: `Rol: ${user.role} · ${user.email}`
    })
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
  const rolAnterior = user.role
  const actualizado = setUserRole(user._id, role)
  auditar(req, 'rol.cambiar', {
    targetId: user._id, targetName: user.name, details: `${rolAnterior} → ${role}`
  })
  return res.json({
    user: {
      _id: actualizado._id,
      name: actualizado.name,
      email: actualizado.email,
      role: actualizado.role
    }
  })
})

// PUT /api/admin/users/:id/password — restablecer la contraseña de alguien
// No hay servicio de correo: la recuperación la hace el administrador,
// que entrega la contraseña temporal por un canal seguro.
router.put('/users/:id/password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body || {}
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })

    const user = findUserById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    if (user._id === req.userId)
      return res.status(400).json({ message: 'Para tu propia cuenta usa el cambio de contraseña en "Mi cuenta".' })

    const hash = await bcrypt.hash(newPassword, 12)
    setUserPassword(user._id, hash)
    bumpTokenVersion(user._id)   // cierra las sesiones abiertas de esa persona
    // Se registra el hecho, nunca la contraseña
    auditar(req, 'contrasena.restablecer', { targetId: user._id, targetName: user.name })

    return res.json({ ok: true, user: { _id: user._id, name: user.name, email: user.email } })
  } catch (e) {
    console.error('Reset password error:', e)
    return res.status(500).json({ message: 'Error al restablecer la contraseña.' })
  }
})

// PUT /api/admin/patients/:id/assign — asignar paciente a un psicólogo/monitor
router.put('/patients/:id/assign', requireAdmin, (req, res) => {
  const { staffId } = req.body || {}   // null para desasignar
  const antes = findUserById(req.params.id)
  const responsableAnterior = antes?.assignedPsychologistId
    ? findUserById(antes.assignedPsychologistId)?.name : null
  const patient = assignPatient(req.params.id, staffId ?? null)
  if (!patient)
    return res.status(400).json({ message: 'Paciente o miembro de staff inválido.' })
  const nuevoResponsable = staffId ? findUserById(staffId)?.name : null
  auditar(req, 'paciente.asignar', {
    targetId: patient._id, targetName: patient.name,
    details: `${responsableAnterior || 'sin asignar'} → ${nuevoResponsable || 'sin asignar'}`
  })
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
