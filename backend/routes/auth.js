import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail, findUserById, createUser, getMedicalRecord, upsertMedicalRecord, STAFF_ROLES } from '../store.js'
import requireAuth from '../middleware/requireAuth.js'
import { effectiveRole } from '../middleware/requireRole.js'

const router = express.Router()

function createToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function sanitize(user) {
  const role = effectiveRole(user)
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role,
    isAdmin: role === 'admin',
    isStaff: STAFF_ROLES.includes(role)
  }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: 'Todos los campos son requeridos.' })
    if (password.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'El formato del correo no es válido.' })
    if (findUserByEmail(email))
      return res.status(409).json({ message: 'Este correo ya está registrado.' })
    const hash = await bcrypt.hash(password, 12)
    const user = createUser({ name, email, password: hash })
    const token = createToken(user._id)
    return res.status(201).json({ token, user: sanitize(user) })
  } catch (e) {
    console.error('Register error:', e)
    return res.status(500).json({ message: 'Error al crear la cuenta.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email?.trim() || !password)
      return res.status(400).json({ message: 'Correo y contraseña son requeridos.' })
    const user = findUserByEmail(email)
    if (!user)
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok)
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' })
    const token = createToken(user._id)
    return res.json({ token, user: sanitize(user) })
  } catch (e) {
    console.error('Login error:', e)
    return res.status(500).json({ message: 'Error al iniciar sesión.' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.userId)
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
  return res.json({ user: sanitize(user) })
})

// ── Ficha médica del propio usuario ────────────────────────────
// GET /api/auth/medical — ver mi ficha
router.get('/medical', requireAuth, (req, res) => {
  const record = getMedicalRecord(req.userId)
  return res.json({ record })
})

// PUT /api/auth/medical — crear/actualizar mi ficha (queda pendiente de validación)
router.put('/medical', requireAuth, (req, res) => {
  const { edad, ocupacion, contactoEmergencia, telefonoEmergencia, condiciones, medicamentos, antecedentes, motivoConsulta } = req.body || {}
  const info = {}
  if (edad !== undefined) info.edad = String(edad).slice(0, 10)
  if (ocupacion !== undefined) info.ocupacion = String(ocupacion).slice(0, 120)
  if (contactoEmergencia !== undefined) info.contactoEmergencia = String(contactoEmergencia).slice(0, 120)
  if (telefonoEmergencia !== undefined) info.telefonoEmergencia = String(telefonoEmergencia).slice(0, 30)
  if (condiciones !== undefined) info.condiciones = String(condiciones).slice(0, 600)
  if (medicamentos !== undefined) info.medicamentos = String(medicamentos).slice(0, 600)
  if (antecedentes !== undefined) info.antecedentes = String(antecedentes).slice(0, 600)
  if (motivoConsulta !== undefined) info.motivoConsulta = String(motivoConsulta).slice(0, 600)
  if (Object.keys(info).length === 0)
    return res.status(400).json({ message: 'No enviaste ningún campo válido.' })
  const record = upsertMedicalRecord(req.userId, info)
  return res.json({ record })
})

export default router
