const BASE = 'http://localhost:3000/api'
let failures = 0

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

// ═══ Recorrido de un paciente real ═══

// 1. Registro
const reg = await api('POST', '/auth/register', { body: { name: 'María Prueba E2E', email: 'maria.e2e@test.com', password: 'maria123' } })
check('Registro de María', reg.status === 201)
const t = reg.data.token
const mariaId = reg.data.user.id

// 2. Chat normal (DeepSeek real)
const chat1 = await api('POST', '/chat', { token: t, body: { message: 'Hola, últimamente me cuesta dormir y quiero crear mejores hábitos' } })
check('Chat responde (IA o demo)', chat1.status === 200 && chat1.data.reply?.length > 0, `status=${chat1.status}`)
console.log(`   ↳ respuesta: "${chat1.data.reply?.slice(0, 90)}..."`)
if (chat1.data.suggestedGoals?.length) console.log(`   ↳ metas sugeridas: ${chat1.data.suggestedGoals.map(g => g.title).join(' | ')}`)

// 3. Chat con señales de riesgo medio (prueba del analizador)
const chat2 = await api('POST', '/chat', { token: t, body: { message: 'Me siento muy triste y sin esperanza, todo me sale mal' } })
check('Chat con mensaje de riesgo procesado', chat2.status === 200, `status=${chat2.status}`)
console.log(`   ↳ nivel de riesgo detectado: ${chat2.data.riskLevel}`)

// 4. Historial del chat
const hist = await api('GET', '/chat/history', { token: t })
check('Historial de chat guardado', hist.status === 200 && hist.data.messages.length >= 4)

// 5. Crear meta
const goal = await api('POST', '/goals', { token: t, body: { title: 'Dormir antes de las 11pm', category: 'sueño' } })
check('Meta creada', goal.status === 201 || goal.status === 200)

// 6. Completar la meta
const goalId = goal.data.goal?._id
if (goalId) {
  const toggled = await api('PATCH', `/goals/${goalId}`, { token: t })
  check('Meta completada', (toggled.status === 200) && toggled.data.goal.completed === true)
}

// 7. Ficha médica
const med = await api('PUT', '/auth/medical', { token: t, body: { edad: '31', ocupacion: 'Diseñadora', contactoEmergencia: 'Pedro Prueba', telefonoEmergencia: '3001234567', motivoConsulta: 'Problemas de sueño y estrés' } })
check('Ficha médica guardada', med.status === 200 && med.data.record.validationStatus === 'pendiente')

// ═══ Flujo staff con la paciente nueva ═══

const admin = await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })
const adminToken = admin.data.token
const psy = await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })
const psyToken = psy.data.token
const psyId = psy.data.user.id

// 8. Admin ve a María con nivel de riesgo del analizador
const dash = await api('GET', '/admin/dashboard', { token: adminToken })
const maria = dash.data.users.find(u => u._id === mariaId)
check('Admin ve a María en dashboard con riesgo analizado', !!maria && maria.risk.level !== 'sin_datos', JSON.stringify(maria?.risk))
console.log(`   ↳ riesgo de María: ${maria?.risk.level} (score ${maria?.risk.score})`)

// 9. Admin puede ver el chat completo de María (ve TODOS los chats)
const detail = await api('GET', `/staff/patients/${mariaId}`, { token: adminToken })
check('Admin ve chat completo de María', detail.status === 200 && detail.data.chat.length >= 4)
check('Admin ve progreso de metas de María', detail.data.progress.totalGoals === 1 && detail.data.progress.completedGoals === 1)
check('Admin ve ficha médica pendiente', detail.data.medicalRecord?.validationStatus === 'pendiente')

// 10. Psicóloga NO ve a María (no asignada)
const deny = await api('GET', `/staff/patients/${mariaId}`, { token: psyToken })
check('Psicóloga sin acceso a María (no asignada)', deny.status === 403)

// 11. Admin asigna → psicóloga ya la ve
await api('PUT', `/admin/patients/${mariaId}/assign`, { token: adminToken, body: { staffId: psyId } })
const nowOk = await api('GET', `/staff/patients/${mariaId}`, { token: psyToken })
check('Tras asignación, psicóloga ve a María', nowOk.status === 200)

// 12. Psicóloga agenda cita presencial con María
const when = new Date(Date.now() + 48 * 3600 * 1000)
when.setHours(15, 0, 0, 0)
const appt = await api('POST', '/staff/appointments', { token: psyToken, body: { patientId: mariaId, date: when.toISOString(), durationMin: 60, modality: 'presencial', notes: 'Primera valoración' } })
check('Cita presencial agendada', appt.status === 201 && appt.data.appointment.modality === 'presencial')

// 13. Cambiar estado de cita a completada
const apptId = appt.data.appointment._id
const done = await api('PUT', `/staff/appointments/${apptId}`, { token: psyToken, body: { status: 'completada' } })
check('Cita marcada completada', done.status === 200 && done.data.appointment.status === 'completada')

// 14. Reporte psicóloga ahora incluye 2 pacientes
const rep = await api('GET', '/staff/reports', { token: psyToken })
check('Reporte psicóloga con 2 pacientes', rep.status === 200 && rep.data.summary.patients === 2, `got ${rep.data.summary?.patients}`)
check('Reporte cuenta cita completada', rep.data.summary.appointments.completadas >= 1)

// 15. Monitor entra y NO ve pacientes (ninguno asignado)
const mon = await api('POST', '/auth/login', { body: { email: 'monitor@contigo.com', password: 'contigo123' } })
const monList = await api('GET', '/staff/patients', { token: mon.data.token })
check('Monitor sin asignados ve lista vacía', monList.status === 200 && monList.data.patients.length === 0)

console.log(failures === 0 ? '\n🎉 E2E COMPLETO: TODO FUNCIONA' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
