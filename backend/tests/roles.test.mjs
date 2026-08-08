const BASE = 'http://localhost:3000/api'
let failures = 0

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

// 1. Login admin
const admin = await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })
check('Login admin', admin.status === 200 && admin.data.user.role === 'admin', JSON.stringify(admin.data))
const adminToken = admin.data.token

// 2. Login psicóloga
const psy = await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })
check('Login psicóloga (role psychologist, isStaff)', psy.status === 200 && psy.data.user.role === 'psychologist' && psy.data.user.isStaff === true)
const psyToken = psy.data.token
const psyId = psy.data.user.id

// 3. Registrar paciente
const pat = await api('POST', '/auth/register', { body: { name: 'Paciente Prueba', email: 'paciente@test.com', password: 'test123' } })
check('Registro paciente (role user)', pat.status === 201 && pat.data.user.role === 'user')
const patToken = pat.data.token
const patId = pat.data.user.id

// 4. Paciente llena ficha médica
const med = await api('PUT', '/auth/medical', { token: patToken, body: { edad: '28', ocupacion: 'Estudiante', condiciones: 'Ansiedad leve', motivoConsulta: 'Estrés académico' } })
check('Paciente guarda ficha médica (pendiente)', med.status === 200 && med.data.record.validationStatus === 'pendiente')

// 5. Paciente NO puede acceder a rutas staff
const forbidden = await api('GET', '/staff/patients', { token: patToken })
check('Paciente bloqueado en /staff (403)', forbidden.status === 403)

// 6. Psicóloga sin pacientes asignados → lista vacía
const empty = await api('GET', '/staff/patients', { token: psyToken })
check('Psicóloga sin asignados ve lista vacía', empty.status === 200 && empty.data.patients.length === 0)

// 7. Psicóloga NO puede ver el expediente de un paciente no asignado
const noAccess = await api('GET', `/staff/patients/${patId}`, { token: psyToken })
check('Psicóloga bloqueada en paciente no asignado (403)', noAccess.status === 403)

// 8. Admin SÍ ve todos los pacientes
const allPat = await api('GET', '/staff/patients', { token: adminToken })
check('Admin ve todos los pacientes', allPat.status === 200 && allPat.data.patients.some(p => p._id === patId))

// 9. Admin asigna paciente a psicóloga
const assign = await api('PUT', `/admin/patients/${patId}/assign`, { token: adminToken, body: { staffId: psyId } })
check('Admin asigna paciente a psicóloga', assign.status === 200 && assign.data.patient.assignedPsychologistId === psyId)

// 10. Ahora la psicóloga SÍ ve al paciente
const nowVisible = await api('GET', `/staff/patients/${patId}`, { token: psyToken })
check('Psicóloga ve expediente de su paciente asignado', nowVisible.status === 200 && nowVisible.data.patient._id === patId)
check('Expediente incluye ficha médica', !!nowVisible.data.medicalRecord)

// 11. Psicóloga agrega nota de progreso
const note = await api('POST', `/staff/patients/${patId}/notes`, { token: psyToken, body: { text: 'Primera sesión de valoración completada.' } })
check('Psicóloga agrega nota', note.status === 201)

// 12. Psicóloga valida ficha médica
const validate = await api('PUT', `/staff/patients/${patId}/medical/validate`, { token: psyToken, body: { status: 'validada' } })
check('Psicóloga valida ficha médica', validate.status === 200 && validate.data.record.validationStatus === 'validada')

// 13. Psicóloga crea cita
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
tomorrow.setHours(10, 0, 0, 0)
const appt = await api('POST', '/staff/appointments', { token: psyToken, body: { patientId: patId, date: tomorrow.toISOString(), durationMin: 50, modality: 'online' } })
check('Psicóloga agenda cita', appt.status === 201 && appt.data.appointment.patientName === 'Paciente Prueba')

// 14. Solapamiento rechazado
const overlap = await api('POST', '/staff/appointments', { token: psyToken, body: { patientId: patId, date: tomorrow.toISOString(), durationMin: 30 } })
check('Cita solapada rechazada (409)', overlap.status === 409)

// 15. Reporte de psicóloga (scope: mis pacientes)
const rep = await api('GET', '/staff/reports', { token: psyToken })
check('Reporte psicóloga', rep.status === 200 && rep.data.scope === 'mis_pacientes' && rep.data.summary.patients === 1)

// 16. Reporte admin (global)
const repA = await api('GET', '/staff/reports', { token: adminToken })
check('Reporte admin global', repA.status === 200 && repA.data.scope === 'global')

// 17. Admin dashboard solo pacientes (sin staff)
const dash = await api('GET', '/admin/dashboard', { token: adminToken })
check('Dashboard admin sin staff en la lista', dash.status === 200 && dash.data.users.every(u => u.email !== 'psicologa@contigo.com'))

// 18. Admin crea nueva cuenta de staff
const newStaff = await api('POST', '/admin/staff', { token: adminToken, body: { name: 'Nuevo Psico', email: 'nuevo@contigo.com', password: 'clave123', role: 'psychologist' } })
check('Admin crea staff', newStaff.status === 201 && newStaff.data.user.role === 'psychologist')

// 19. Psicóloga NO puede crear staff
const denied = await api('POST', '/admin/staff', { token: psyToken, body: { name: 'X', email: 'x@x.com', password: 'xxxxxx', role: 'monitor' } })
check('Psicóloga bloqueada en /admin (403)', denied.status === 403)

// 20. Cambio de rol: la respuesta debe traer el rol NUEVO, no el anterior
const nuevoId = newStaff.data.user?._id
const cambio = await api('PUT', `/admin/users/${nuevoId}/role`, { token: adminToken, body: { role: 'monitor' } })
check('Cambio de rol devuelve el rol actualizado', cambio.status === 200 && cambio.data.user.role === 'monitor', JSON.stringify(cambio.data))
const listaStaff = await api('GET', '/admin/staff', { token: adminToken })
check('El cambio de rol persiste en la lista de equipo',
  listaStaff.data.staff?.find(m => m._id === nuevoId)?.role === 'monitor')

console.log(failures === 0 ? '\n🎉 TODAS LAS PRUEBAS PASARON' : `\n💥 ${failures} pruebas fallaron`)
process.exit(failures === 0 ? 0 : 1)
