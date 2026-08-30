// Registro de auditoría: qué queda constancia, quién puede leerlo y
// que no se pueda alterar desde la aplicación.

const BASE = process.env.CONTIGO_API_BASE || 'http://localhost:3000/api'
let failures = 0

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}
function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

const admin = (await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })).data
const psi   = (await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })).data
const pac   = (await api('POST', '/auth/register', { body: { name: 'Registro Prueba', email: 'registro@test.com', password: 'clave123' } })).data

console.log('── Qué queda registrado ──')
await api('PUT', `/admin/patients/${pac.user.id}/assign`, { token: admin.token, body: { staffId: psi.user.id } })
await api('GET', `/staff/patients/${pac.user.id}`, { token: psi.token })
await api('POST', `/staff/patients/${pac.user.id}/notes`, { token: psi.token, body: { text: 'Seguimiento inicial' } })
await api('PUT', '/auth/medical', { token: pac.token, body: { edad: '30' } })
await api('PUT', `/staff/patients/${pac.user.id}/medical/validate`, { token: psi.token, body: { status: 'validada' } })

const cuando = new Date(Date.now() + 864e5); cuando.setHours(11, 0, 0, 0)
const cita = await api('POST', '/staff/appointments', { token: psi.token, body: { patientId: pac.user.id, date: cuando.toISOString() } })
await api('PUT', `/staff/appointments/${cita.data.appointment._id}`, { token: psi.token, body: { status: 'completada' } })
await api('DELETE', `/staff/appointments/${cita.data.appointment._id}`, { token: psi.token })

const log = await api('GET', '/admin/audit-log', { token: admin.token })
check('El registro responde', log.status === 200)
const acciones = log.data.entries.map(e => e.action)
for (const esperada of ['expediente.ver', 'nota.crear', 'ficha.validar', 'cita.crear', 'cita.editar', 'cita.eliminar', 'paciente.asignar']) {
  check(`Registra ${esperada}`, acciones.includes(esperada), acciones.join(', '))
}

console.log('\n── Qué guarda de cada entrada ──')
const exp = log.data.entries.find(e => e.action === 'expediente.ver')
check('Quién actuó, con su rol', exp.actorName === 'Laura Cifuentes' && exp.actorRole === 'psychologist', JSON.stringify(exp))
check('Sobre quién', exp.targetName === 'Registro Prueba')
check('Descripción legible para la interfaz', exp.actionLabel === 'Consultó un expediente')
check('Fecha y hora', !!exp.createdAt && !isNaN(new Date(exp.createdAt)))
const val = log.data.entries.find(e => e.action === 'ficha.validar')
check('Guarda el detalle de la acción', (val.details || '').includes('validada'), val.details)

console.log('\n── Quién puede leerlo ──')
check('Psicóloga: no (403)', (await api('GET', '/admin/audit-log', { token: psi.token })).status === 403)
check('Paciente: no (403)', (await api('GET', '/admin/audit-log', { token: pac.token })).status === 403)
check('Sin sesión: no (401)', (await api('GET', '/admin/audit-log')).status === 401)

console.log('\n── No se puede alterar desde la aplicación ──')
for (const [metodo, ruta] of [['DELETE', '/admin/audit-log'], ['PUT', '/admin/audit-log'], ['POST', '/admin/audit-log']]) {
  const r = await api(metodo, ruta, { token: admin.token })
  check(`${metodo} sobre el registro no existe (${r.status})`, r.status === 404 || r.status === 405, `devolvió ${r.status}`)
}

console.log('\n── Filtros y paginación ──')
const porPaciente = await api('GET', `/admin/audit-log?targetId=${pac.user.id}`, { token: admin.token })
check('Filtra por paciente', porPaciente.data.entries.length > 0 && porPaciente.data.entries.every(e => e.targetId === pac.user.id))
const porAccion = await api('GET', '/admin/audit-log?action=expediente.ver', { token: admin.token })
check('Filtra por tipo de acción', porAccion.data.entries.every(e => e.action === 'expediente.ver'))
const porActor = await api('GET', `/admin/audit-log?actorId=${psi.user.id}`, { token: admin.token })
check('Filtra por quién actuó', porActor.data.entries.every(e => e.actorId === psi.user.id))
const pagina = await api('GET', '/admin/audit-log?limit=2', { token: admin.token })
check('Respeta el límite y devuelve el total', pagina.data.entries.length === 2 && pagina.data.total > 2, JSON.stringify({ n: pagina.data.entries.length, total: pagina.data.total }))

console.log('\n── Consultar el registro no se audita a sí mismo ──')
const antes = (await api('GET', '/admin/audit-log', { token: admin.token })).data.total
await api('GET', '/admin/audit-log', { token: admin.token })
const despues = (await api('GET', '/admin/audit-log', { token: admin.token })).data.total
check('Leerlo no genera entradas nuevas', antes === despues, `${antes} → ${despues}`)

console.log(failures === 0 ? '\n🎉 AUDITORÍA OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
