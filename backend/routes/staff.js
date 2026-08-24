import express from 'express'
import { requireStaff, requireClinician } from '../middleware/requireRole.js'
import { auditar } from '../auditoria.js'
import {
  findUserById, getPatients, getPatientsOf, getStaffMembers,
  getHistory, getGoals, getRiskProfile,
  getMedicalRecord, validateMedicalRecord,
  getProgressNotes, addProgressNote,
  createAppointment, getAppointmentById, getAllAppointments,
  getAppointmentsForStaff, updateAppointment, deleteAppointment,
  getRiskSummaries, getGoalStats, getNoteCounts, getMedicalStatuses,
  STAFF_ROLES
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

/**
 * Los pacientes que este profesional puede ver: todos si es admin, los
 * asignados en cualquier otro caso. La regla vivía repetida como ternario
 * en cada ruta; tenerla en un solo sitio evita que una ruta nueva se
 * quede con una versión distinta.
 */
function patientsInScope(req) {
  return req.userRole === 'admin' ? getPatients() : getPatientsOf(req.userId)
}

const SIN_RIESGO = { level: 'sin_datos', score: 0, lastAnalysis: null, alertCount: 0 }
const LEVEL_ORDER = { alto: 0, medio: 1, bajo: 2, sin_datos: 3 }

function patientSummary(p, resumenes) {
  const risk = resumenes.get(p._id)
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
      alertCount: risk.alertCount
    } : SIN_RIESGO
  }
}

// ── GET /api/staff/patients — mis pacientes (o todos si admin) ──
router.get('/patients', (req, res) => {
  const patients = patientsInScope(req)
  const resumenes = getRiskSummaries()
  const list = patients.map(p => patientSummary(p, resumenes))
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

  // Abrir un expediente da acceso a las conversaciones y a la ficha
  // médica: es la consulta que más importa dejar registrada.
  auditar(req, 'expediente.ver', { targetId: patient._id, targetName: patient.name })

  const risk = getRiskProfile(patient._id)
  const chat = getHistory(patient._id, 200).map(m => ({
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
  auditar(req, 'nota.crear', { targetId: patient._id, targetName: patient.name })
  return res.status(201).json({ note })
})

// ── PUT /api/staff/patients/:id/medical/validate ───────────────
// Solo psicólogos y admin: validar una ficha es criterio clínico.
router.put('/patients/:id/medical/validate', requireClinician, (req, res) => {
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
  auditar(req, 'ficha.validar', {
    targetId: patient._id, targetName: patient.name,
    details: `Estado: ${status}${note ? ` · Nota: ${String(note).slice(0, 120)}` : ''}`
  })
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

/**
 * Una cita solo es tuya si la agendaste tú Y el paciente sigue asignado a ti.
 *
 * La comprobación anterior miraba únicamente `psychologistId`, que queda
 * congelado al crear la cita. Reasignar un paciente a otro profesional
 * cortaba el acceso a su expediente pero no a sus citas anteriores, que
 * llevan notas clínicas: el psicólogo saliente seguía viéndolas, editándolas
 * y borrándolas indefinidamente.
 */
function canAccessAppointment(req, appt) {
  if (req.userRole === 'admin') return true
  if (appt.psychologistId !== req.userId) return false
  const patient = findUserById(appt.patientId)
  return !!patient && canAccessPatient(req, patient)
}

// GET /api/staff/appointments — mis citas (admin: todas)
router.get('/appointments', (req, res) => {
  const list = req.userRole === 'admin' ? getAllAppointments() : getAppointmentsForStaff(req.userId)
  const sorted = list
    .filter(a => canAccessAppointment(req, a))
    .map(apptWithNames)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  return res.json({ appointments: sorted })
})

// POST /api/staff/appointments — crear cita (solo psicólogos y admin)
router.post('/appointments', requireClinician, (req, res) => {
  const { patientId, date, durationMin, modality, notes, psychologistId } = req.body || {}
  if (!patientId || !date)
    return res.status(400).json({ message: 'Paciente y fecha son requeridos.' })

  const patient = findUserById(patientId)
  if (!patient || patient.role !== 'user')
    return res.status(404).json({ message: 'Paciente no encontrado.' })

  // El admin puede agendar a nombre de otro profesional; el resto solo a su
  // nombre. El identificador que llega en el cuerpo se valida como cualquier
  // otro dato de entrada: sin esto se podía dejar como "psicólogo" de la cita
  // a una cuenta de paciente, o a alguien que no acompaña a esa persona.
  let targetPsy = req.userId
  if (req.userRole === 'admin' && psychologistId) {
    const psy = findUserById(psychologistId)
    if (!psy || !STAFF_ROLES.includes(psy.role))
      return res.status(400).json({ message: 'El profesional indicado no pertenece al equipo.' })
    // Agendar para alguien a quien el paciente no está asignado crearía una
    // cita que esa persona no podría abrir (ver canAccessAppointment).
    if (psy.role !== 'admin' && patient.assignedPsychologistId !== psy._id)
      return res.status(400).json({ message: 'Asigna primero el paciente a ese profesional.' })
    targetPsy = psy._id
  } else if (!canAccessPatient(req, patient)) {
    return res.status(403).json({ message: 'Este paciente no está asignado a ti.' })
  }

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
  auditar(req, 'cita.crear', {
    targetId: patient._id, targetName: patient.name,
    details: `${when.toISOString()} · ${dur} min · ${appt.modality}`
  })
  return res.status(201).json({ appointment: apptWithNames(appt) })
})

// PUT /api/staff/appointments/:id — editar/cambiar estado
router.put('/appointments/:id', requireClinician, (req, res) => {
  const appt = getAppointmentById(req.params.id)
  if (!appt) return res.status(404).json({ message: 'Cita no encontrada.' })
  if (!canAccessAppointment(req, appt))
    return res.status(403).json({ message: 'Esta cita no es tuya.' })

  const { date, durationMin, modality, status, notes } = req.body || {}
  // Al crear se valida la fecha; al editar no se hacía, y una fecha ilegible
  // llegaba hasta `toISOString()` y salía como un 500 sin explicación.
  if (date !== undefined && isNaN(new Date(date).getTime()))
    return res.status(400).json({ message: 'Fecha inválida.' })

  const updated = updateAppointment(appt._id, { date, durationMin, modality, status, notes })
  const paciente = findUserById(appt.patientId)
  auditar(req, 'cita.editar', {
    targetId: appt.patientId, targetName: paciente?.name,
    details: status ? `Nuevo estado: ${status}` : 'Cambió fecha, duración, modalidad o notas'
  })
  return res.json({ appointment: apptWithNames(updated) })
})

// DELETE /api/staff/appointments/:id
router.delete('/appointments/:id', requireClinician, (req, res) => {
  const appt = getAppointmentById(req.params.id)
  if (!appt) return res.status(404).json({ message: 'Cita no encontrada.' })
  if (!canAccessAppointment(req, appt))
    return res.status(403).json({ message: 'Esta cita no es tuya.' })
  const paciente = findUserById(appt.patientId)
  deleteAppointment(appt._id)
  auditar(req, 'cita.eliminar', {
    targetId: appt.patientId, targetName: paciente?.name,
    details: `Cita del ${appt.date}`
  })
  return res.json({ ok: true })
})

// ── GET /api/staff/reports — reporte según rol ─────────────────
router.get('/reports', (req, res) => {
  const patients = patientsInScope(req)
  const appts = req.userRole === 'admin' ? getAllAppointments() : getAppointmentsForStaff(req.userId)

  // Cuatro consultas agrupadas en vez de cinco por paciente: con cien
  // personas esto pasaba de ~500 consultas seguidas —que bloqueaban a todo
  // el mundo mientras se generaba el reporte— a un puñado.
  const resumenes = getRiskSummaries()
  const metas     = getGoalStats()
  const notas     = getNoteCounts()
  const fichas    = getMedicalStatuses()

  const byLevel = { alto: 0, medio: 0, bajo: 0, sin_datos: 0 }
  let totalGoals = 0, completedGoals = 0, totalAlerts = 0, medicalValidated = 0, medicalPending = 0

  const patientRows = patients.map(p => {
    const risk = resumenes.get(p._id)
    const level = risk?.level || 'sin_datos'
    byLevel[level] = (byLevel[level] || 0) + 1
    totalAlerts += risk?.alertCount || 0

    const meta = metas.get(p._id) || { total: 0, completed: 0 }
    totalGoals += meta.total
    completedGoals += meta.completed

    const estadoFicha = fichas.get(p._id)
    if (estadoFicha === 'validada') medicalValidated++
    else if (estadoFicha) medicalPending++

    return {
      _id: p._id,
      name: p.name,
      level,
      score: risk?.score || 0,
      alerts: risk?.alertCount || 0,
      goals: meta.total,
      goalsCompleted: meta.completed,
      goalsPct: meta.total ? Math.round((meta.completed / meta.total) * 100) : 0,
      medical: estadoFicha || 'sin_ficha',
      notes: notas.get(p._id) || 0
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

// ── GET /api/staff/alerts/summary — para el badge del header ───
// Cuenta pacientes en riesgo alto/medio (según el alcance del rol)
router.get('/alerts/summary', (req, res) => {
  // Lo llama el encabezado en cada carga de página: conviene que sean dos
  // consultas fijas y no una por paciente.
  const patients = patientsInScope(req)
  const resumenes = getRiskSummaries()
  let alto = 0, medio = 0
  for (const p of patients) {
    const nivel = resumenes.get(p._id)?.level
    if (nivel === 'alto') alto++
    else if (nivel === 'medio') medio++
  }
  return res.json({ alto, medio })
})

// ── GET /api/staff/team — lista de staff (para selects) ────────
router.get('/team', (req, res) => {
  return res.json({ staff: getStaffMembers() })
})

export default router
