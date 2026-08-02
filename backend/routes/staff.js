import express from 'express'
import { requireStaff } from '../middleware/requireRole.js'
import {
  findUserById, getPatients, getPatientsOf, getStaffMembers,
  getHistory, getGoals, getRiskProfile,
  getMedicalRecord, validateMedicalRecord,
  getProgressNotes, addProgressNote,
  createAppointment, getAppointmentById, getAllAppointments,
  getAppointmentsForStaff, updateAppointment, deleteAppointment
} from '../store.js'

const router = express.Router()
router.use(requireStaff)

/**
 * Regla de acceso:
 *  - admin        → todos los pacientes
 *  - psychologist → solo sus pacientes asignados
 *  - monitor      → solo sus pacientes asignados
 */
function canAccessPatient(req, patient) {
  if (req.userRole === 'admin') return true
  return patient.assignedPsychologistId === req.userId
}

function patientSummary(p) {
  const risk = getRiskProfile(p._id)
  return {
    _id: p._id,
    name: p.name,
    email: p.email,
    createdAt: p.createdAt,
    assignedPsychologistId: p.assignedPsychologistId,
    risk: risk ? {
      level: risk.level,
      score: risk.score,
      lastAnalysis: risk.lastAnalysis,
      alertCount: risk.alerts.length
    } : { level: 'sin_datos', score: 0, lastAnalysis: null, alertCount: 0 }
  }
}

// ── GET /api/staff/patients — mis pacientes (o todos si admin) ──
router.get('/patients', (req, res) => {
  const patients = req.userRole === 'admin' ? getPatients() : getPatientsOf(req.userId)
  const LEVEL_ORDER = { alto: 0, medio: 1, bajo: 2, sin_datos: 3 }
  const list = patients.map(patientSummary)
    .sort((a, b) => LEVEL_ORDER[a.risk.level] - LEVEL_ORDER[b.risk.level])
  return res.json({ patients: list })
})

// ── GET /api/staff/patients/:id — expediente completo ──────────
router.get('/patients/:id', (req, res) => {
  const patient = findUserById(req.params.id)
  if (!patient || patient.role !== 'user')
    return res.status(404).json({ message: 'Paciente no encontrado.' })
  if (!canAccessPatient(req, patient))
    return res.status(403).json({ message: 'Este paciente no está asignado a ti.' })

  const risk = getRiskProfile(patient._id)
  const chat = getHistory(patient._id).slice(-60).map(m => ({
    role: m.role, content: m.content, timestamp: m.createdAt
  }))
  const goals = getGoals(patient._id)
  const completedGoals = goals.filter(g => g.completed).length

  return res.json({
    patient: {
      _id: patient._id,
      name: patient.name,
      email: patient.email,
      createdAt: patient.createdAt,
      assignedPsychologistId: patient.assignedPsychologistId
    },
    risk: risk || { level: 'sin_datos', score: 0, alerts: [], triggerWords: [] },
    chat,
    goals,
    progress: {
      totalGoals: goals.length,
      completedGoals,
      pct: goals.length ? Math.round((completedGoals / goals.length) * 100) : 0
    },
    medicalRecord: getMedicalRecord(patient._id),
    notes: getProgressNotes(patient._id)
  })
})

// ── POST /api/staff/patients/:id/notes — nota de progreso ──────
router.post('/patients/:id/notes', (req, res) => {
  const patient = findUserById(req.params.id)
  if (!patient || patient.role !== 'user')
    return res.status(404).json({ message: 'Paciente no encontrado.' })
  if (!canAccessPatient(req, patient))
    return res.status(403).json({ message: 'Este paciente no está asignado a ti.' })

  const { text } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ message: 'La nota no puede estar vacía.' })
  if (text.length > 2000) return res.status(400).json({ message: 'Nota demasiado larga (máx. 2000).' })

  const note = addProgressNote(patient._id, {
    authorId: req.userId,
    authorName: req.user.name,
    text
  })
  return res.status(201).json({ note })
})

// ── PUT /api/staff/patients/:id/medical/validate ───────────────
router.put('/patients/:id/medical/validate', (req, res) => {
  const patient = findUserById(req.params.id)
  if (!patient || patient.role !== 'user')
    return res.status(404).json({ message: 'Paciente no encontrado.' })
  if (!canAccessPatient(req, patient))
    return res.status(403).json({ message: 'Este paciente no está asignado a ti.' })

  const { status, note } = req.body || {}
  if (!['validada', 'rechazada', 'pendiente'].includes(status))
    return res.status(400).json({ message: 'Estado inválido. Usa: validada, rechazada o pendiente.' })

  const record = validateMedicalRecord(patient._id, {
    staffId: req.userId,
    staffName: req.user.name,
    status,
    note
  })
  if (!record) return res.status(404).json({ message: 'El paciente aún no ha registrado su ficha médica.' })
  return res.json({ record })
})

// ── Citas / Calendario ─────────────────────────────────────────
function apptWithNames(a) {
  const patient = findUserById(a.patientId)
  const psy = findUserById(a.psychologistId)
  return {
    ...a,
    patientName: patient?.name || '(eliminado)',
    psychologistName: psy?.name || '(eliminado)'
  }
}

// GET /api/staff/appointments — mis citas (admin: todas)
router.get('/appointments', (req, res) => {
  const list = req.userRole === 'admin' ? getAllAppointments() : getAppointmentsForStaff(req.userId)
  const sorted = list.map(apptWithNames).sort((a, b) => new Date(a.date) - new Date(b.date))
  return res.json({ appointments: sorted })
})

// POST /api/staff/appointments — crear cita
router.post('/appointments', (req, res) => {
  const { patientId, date, durationMin, modality, notes, psychologistId } = req.body || {}
  if (!patientId || !date)
    return res.status(400).json({ message: 'Paciente y fecha son requeridos.' })

  const patient = findUserById(patientId)
  if (!patient || patient.role !== 'user')
    return res.status(404).json({ message: 'Paciente no encontrado.' })

  // El admin puede agendar a nombre de otro psicólogo; el resto solo a su nombre
  const targetPsy = (req.userRole === 'admin' && psychologistId) ? psychologistId : req.userId
  if (!canAccessPatient(req, patient) && req.userRole !== 'admin')
    return res.status(403).json({ message: 'Este paciente no está asignado a ti.' })

  const when = new Date(date)
  if (isNaN(when.getTime()))
    return res.status(400).json({ message: 'Fecha inválida.' })

  // Evitar solapamiento simple para el mismo psicólogo
  const dur = durationMin || 50
  const overlap = getAppointmentsForStaff(targetPsy).some(a => {
    if (a.status === 'cancelada') return false
    const aStart = new Date(a.date).getTime()
    const aEnd = aStart + a.durationMin * 60000
    const s = when.getTime()
    const e = s + dur * 60000
    return s < aEnd && e > aStart
  })
  if (overlap)
    return res.status(409).json({ message: 'Ya existe una cita en ese horario.' })

  const appt = createAppointment({ patientId, psychologistId: targetPsy, date: when, durationMin: dur, modality, notes })
  return res.status(201).json({ appointment: apptWithNames(appt) })
})

// PUT /api/staff/appointments/:id — editar/cambiar estado
router.put('/appointments/:id', (req, res) => {
  const appt = getAppointmentById(req.params.id)
  if (!appt) return res.status(404).json({ message: 'Cita no encontrada.' })
  if (req.userRole !== 'admin' && appt.psychologistId !== req.userId)
    return res.status(403).json({ message: 'Esta cita no es tuya.' })

  const { date, durationMin, modality, status, notes } = req.body || {}
  const updated = updateAppointment(appt._id, { date, durationMin, modality, status, notes })
  return res.json({ appointment: apptWithNames(updated) })
})

// DELETE /api/staff/appointments/:id
router.delete('/appointments/:id', (req, res) => {
  const appt = getAppointmentById(req.params.id)
  if (!appt) return res.status(404).json({ message: 'Cita no encontrada.' })
  if (req.userRole !== 'admin' && appt.psychologistId !== req.userId)
    return res.status(403).json({ message: 'Esta cita no es tuya.' })
  deleteAppointment(appt._id)
  return res.json({ ok: true })
})

// ── GET /api/staff/reports — reporte según rol ─────────────────
router.get('/reports', (req, res) => {
  const patients = req.userRole === 'admin' ? getPatients() : getPatientsOf(req.userId)
  const appts = req.userRole === 'admin' ? getAllAppointments() : getAppointmentsForStaff(req.userId)

  const byLevel = { alto: 0, medio: 0, bajo: 0, sin_datos: 0 }
  let totalGoals = 0, completedGoals = 0, totalAlerts = 0, medicalValidated = 0, medicalPending = 0

  const patientRows = patients.map(p => {
    const risk = getRiskProfile(p._id)
    const level = risk?.level || 'sin_datos'
    byLevel[level] = (byLevel[level] || 0) + 1
    totalAlerts += risk?.alerts?.length || 0

    const goals = getGoals(p._id)
    const completed = goals.filter(g => g.completed).length
    totalGoals += goals.length
    completedGoals += completed

    const record = getMedicalRecord(p._id)
    if (record?.validationStatus === 'validada') medicalValidated++
    else if (record) medicalPending++

    return {
      _id: p._id,
      name: p.name,
      level,
      score: risk?.score || 0,
      alerts: risk?.alerts?.length || 0,
      goals: goals.length,
      goalsCompleted: completed,
      goalsPct: goals.length ? Math.round((completed / goals.length) * 100) : 0,
      medical: record ? record.validationStatus : 'sin_ficha',
      notes: getProgressNotes(p._id).length
    }
  })

  const now = Date.now()
  const upcoming = appts.filter(a => a.status === 'programada' && new Date(a.date).getTime() >= now).length
  const completed = appts.filter(a => a.status === 'completada').length
  const cancelled = appts.filter(a => a.status === 'cancelada').length

  return res.json({
    generatedAt: new Date(),
    scope: req.userRole === 'admin' ? 'global' : 'mis_pacientes',
    summary: {
      patients: patients.length,
      riskLevels: byLevel,
      totalAlerts,
      goals: { total: totalGoals, completed: completedGoals, pct: totalGoals ? Math.round((completedGoals / totalGoals) * 100) : 0 },
      medical: { validadas: medicalValidated, pendientes: medicalPending, sinFicha: patients.length - medicalValidated - medicalPending },
      appointments: { total: appts.length, proximas: upcoming, completadas: completed, canceladas: cancelled }
    },
    patients: patientRows
  })
})

// ── GET /api/staff/team — lista de staff (para selects) ────────
router.get('/team', (req, res) => {
  return res.json({ staff: getStaffMembers() })
})

export default router
