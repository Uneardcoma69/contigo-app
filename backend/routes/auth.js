import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail, findUserById, createUser, getMedicalRecord, upsertMedicalRecord, getAppointmentsForPatient, setUserPassword, bumpTokenVersion, STAFF_ROLES, getRiskHeatmap, getRiskEventsForDay, createPasswordReset, consumePasswordReset } from '../store.js'
import requireAuth from '../middleware/requireAuth.js'
import { effectiveRole } from '../middleware/requireRole.js'
import { enviarRecuperacionContrasena } from '../mailer.js'

const router = express.Router()

// El token lleva la versión de sesión: si sube (cambio o restablecimiento
// de contraseña), los tokens anteriores dejan de ser válidos.
function createToken(user) {
  return jwt.sign(
    { id: user._id, v: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
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
    if (name.trim().length > 120)
      return res.status(400).json({ message: 'El nombre es demasiado largo.' })
    if (password.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'El formato del correo no es válido.' })
    if (findUserByEmail(email))
      return res.status(409).json({ message: 'Este correo ya está registrado.' })
    // ADMIN_EMAIL vuelve admin a cualquier cuenta con ese correo (ver
    // effectiveRole). El registro es público y sin verificación de email, así
    // que sin este bloqueo cualquiera podría autoproclamarse admin
    // registrándose primero con ese correo.
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
    if (adminEmail && email.toLowerCase().trim() === adminEmail)
      return res.status(403).json({ message: 'Este correo no está disponible para registro público.' })
    const hash = await bcrypt.hash(password, 12)
    const user = createUser({ name, email, password: hash })
    const token = createToken(user)
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
    const token = createToken(user)
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

// ── Cambiar mi propia contraseña ───────────────────────────────
// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Debes indicar tu contraseña actual y la nueva.' })
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' })

    const user = findUserById(req.userId)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) return res.status(401).json({ message: 'Tu contraseña actual no es correcta.' })

    if (await bcrypt.compare(newPassword, user.password))
      return res.status(400).json({ message: 'La nueva contraseña debe ser distinta de la actual.' })

    const hash = await bcrypt.hash(newPassword, 12)
    setUserPassword(user._id, hash)
    // Se usa el usuario ya actualizado: el token nuevo debe llevar la
    // versión de sesión recién incrementada, o nacería inválido.
    const actualizado = bumpTokenVersion(user._id)   // cierra las demás sesiones abiertas

    // Token nuevo para que quien hizo el cambio siga dentro
    return res.json({ token: createToken(actualizado), user: sanitize(actualizado) })
  } catch (e) {
    console.error('Change password error:', e)
    return res.status(500).json({ message: 'Error al cambiar la contraseña.' })
  }
})

// ── Recuperación de contraseña (sin sesión) ─────────────────────
// Mismo mensaje exista o no la cuenta: quien mira la respuesta no puede
// distinguir un correo registrado de uno que no lo está.
const MENSAJE_GENERICO_OLVIDE = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.'

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email?.trim())
      return res.status(400).json({ message: 'Indica tu correo.' })

    const user = findUserByEmail(email)
    if (user) {
      const token = createPasswordReset(user._id)
      const appUrl = process.env.CONTIGO_APP_URL || `${req.protocol}://${req.get('host')}`
      const resetUrl = `${appUrl}/restablecer-contrasena?token=${token}`
      enviarRecuperacionContrasena({ userName: user.name, userEmail: user.email, resetUrl })
        .catch(e => console.error('⚠️ Envío de recuperación falló:', e.message))
    }

    return res.json({ message: MENSAJE_GENERICO_OLVIDE })
  } catch (e) {
    console.error('Forgot password error:', e)
    return res.status(500).json({ message: 'No pudimos procesar el pedido. Intenta de nuevo.' })
  }
})

// PUT /api/auth/reset-password
router.put('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}
    if (!token || !newPassword)
      return res.status(400).json({ message: 'Faltan datos.' })
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' })

    const userId = consumePasswordReset(token)
    if (!userId)
      return res.status(400).json({ message: 'El enlace no es válido o ya venció. Pide uno nuevo.' })

    const hash = await bcrypt.hash(newPassword, 12)
    setUserPassword(userId, hash)
    bumpTokenVersion(userId)   // cierra cualquier sesión abierta con la contraseña vieja

    return res.json({ message: 'Contraseña actualizada. Ya podés iniciar sesión.' })
  } catch (e) {
    console.error('Reset password error:', e)
    return res.status(500).json({ message: 'No pudimos restablecer la contraseña. Intenta de nuevo.' })
  }
})

// ── Citas del propio usuario ───────────────────────────────────
// GET /api/auth/appointments — mis citas (como paciente)
router.get('/appointments', requireAuth, (req, res) => {
  const list = getAppointmentsForPatient(req.userId)
    .map(a => {
      const psy = findUserById(a.psychologistId)
      return {
        _id: a._id,
        date: a.date,
        durationMin: a.durationMin,
        modality: a.modality,
        status: a.status,
        psychologistName: psy?.name || 'Equipo Contigo'
      }
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  return res.json({ appointments: list })
})

// ── Línea de tiempo emocional del propio usuario ───────────────
// GET /api/auth/risk/heatmap?days=90 — mi mapa de calor de riesgo
router.get('/risk/heatmap', requireAuth, (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 366)
  return res.json(getRiskHeatmap(req.userId, days))
})

// GET /api/auth/risk/events?date=YYYY-MM-DD — mis alertas de ese día
router.get('/risk/events', requireAuth, (req, res) => {
  const fecha = String(req.query.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ message: 'Fecha inválida.' })
  return res.json({ events: getRiskEventsForDay(req.userId, fecha) })
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
