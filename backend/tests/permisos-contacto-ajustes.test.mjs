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
const psy   = (await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })).data
const mon   = (await api('POST', '/auth/login', { body: { email: 'monitor@contigo.com', password: 'contigo123' } })).data

const pat = (await api('POST', '/auth/register', { body: { name: 'Paciente Decisiones', email: 'dec@test.com', password: 'test123' } })).data
const patId = pat.user.id
await api('PUT', '/auth/medical', { token: pat.token, body: { edad: '25', motivoConsulta: 'Prueba' } })

console.log('── Decisión 6: monitor = observador ──')
// Asignar el paciente al MONITOR
const asig = await api('PUT', `/admin/patients/${patId}/assign`, { token: admin.token, body: { staffId: mon.user.id } })
check('Admin asigna paciente al monitor', asig.status === 200)

// El monitor SÍ puede ver y anotar
const ver = await api('GET', `/staff/patients/${patId}`, { token: mon.token })
check('Monitor VE el expediente de su paciente', ver.status === 200)
const nota = await api('POST', `/staff/patients/${patId}/notes`, { token: mon.token, body: { text: 'Observación del monitor.' } })
check('Monitor SÍ puede dejar notas', nota.status === 201)
const cal = await api('GET', '/staff/appointments', { token: mon.token })
check('Monitor VE el calendario (solo lectura)', cal.status === 200)
const alertas = await api('GET', '/staff/alerts/summary', { token: mon.token })
check('Monitor VE el resumen de alertas', alertas.status === 200)

// El monitor NO puede tomar decisiones clínicas
const val = await api('PUT', `/staff/patients/${patId}/medical/validate`, { token: mon.token, body: { status: 'validada' } })
check('Monitor NO puede validar fichas (403)', val.status === 403, `status=${val.status}`)
const manana = new Date(Date.now() + 72 * 3600 * 1000); manana.setHours(11, 0, 0, 0)
const cita = await api('POST', '/staff/appointments', { token: mon.token, body: { patientId: patId, date: manana.toISOString() } })
check('Monitor NO puede agendar citas (403)', cita.status === 403, `status=${cita.status}`)

// El psicólogo SÍ puede (no se rompió nada)
await api('PUT', `/admin/patients/${patId}/assign`, { token: admin.token, body: { staffId: psy.user.id } })
const valPsy = await api('PUT', `/staff/patients/${patId}/medical/validate`, { token: psy.token, body: { status: 'validada' } })
check('Psicóloga SÍ puede validar fichas', valPsy.status === 200)
const citaPsy = await api('POST', '/staff/appointments', { token: psy.token, body: { patientId: patId, date: manana.toISOString() } })
check('Psicóloga SÍ puede agendar citas', citaPsy.status === 201)

console.log('\n── Decisión 10: formulario de contacto ──')
const envio = await api('POST', '/contact', {
  body: { nombre: 'Visitante Web', correo: 'visitante@ejemplo.com', telefono: '3009998877', motivo: 'Terapia individual', mensaje: 'Quisiera información sobre los horarios.', privacidad: true }
})
check('Formulario público envía sin sesión', envio.status === 201, `status=${envio.status}`)

const sinConsent = await api('POST', '/contact', { body: { nombre: 'X', correo: 'x@x.com', mensaje: 'hola', privacidad: false } })
check('Rechaza envío sin aceptar política (400)', sinConsent.status === 400)
const malCorreo = await api('POST', '/contact', { body: { nombre: 'X', correo: 'no-es-correo', mensaje: 'hola', privacidad: true } })
check('Rechaza correo inválido (400)', malCorreo.status === 400)
const vacio = await api('POST', '/contact', { body: { nombre: '', correo: 'x@x.com', mensaje: '', privacidad: true } })
check('Rechaza campos vacíos (400)', vacio.status === 400)

const bandeja = await api('GET', '/admin/contact-messages', { token: admin.token })
check('Admin ve el mensaje en su bandeja', bandeja.status === 200 && bandeja.data.messages.some(m => m.correo === 'visitante@ejemplo.com'))
const bandejaPsy = await api('GET', '/admin/contact-messages', { token: psy.token })
check('Psicóloga NO ve la bandeja (403)', bandejaPsy.status === 403)

console.log('\n── Decisión 8: ajustes de IA ──')
const set = await api('GET', '/admin/settings', { token: admin.token })
check('Admin consulta ajustes', set.status === 200 && typeof set.data.aiConfigured === 'boolean', JSON.stringify(set.data))
check('Ajustes NUNCA devuelven la clave completa', !JSON.stringify(set.data).includes(process.env.DEEPSEEK_API_KEY || '###nunca###'))
check('En modo servidor canEdit es false', set.data.canEdit === false)
const setPsy = await api('GET', '/admin/settings', { token: psy.token })
check('Psicóloga NO accede a ajustes (403)', setPsy.status === 403)
const editar = await api('PUT', '/admin/settings', { token: admin.token, body: { deepseekApiKey: 'sk-falsa' } })
check('En modo servidor no se puede editar (400)', editar.status === 400)

console.log(failures === 0 ? '\n🎉 TODAS LAS DECISIONES OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
