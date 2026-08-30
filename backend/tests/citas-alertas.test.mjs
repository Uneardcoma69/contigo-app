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

const maria = await api('POST', '/auth/login', { body: { email: 'maria.e2e@test.com', password: 'maria123' } })
const psy = await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })
const admin = await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })

// 1. Paciente ve sus citas
const appts = await api('GET', '/auth/appointments', { token: maria.data.token })
check('María ve sus citas', appts.status === 200 && appts.data.appointments.length === 1, JSON.stringify(appts.data))
check('Cita incluye nombre del psicólogo', appts.data.appointments[0]?.psychologistName === 'Laura Cifuentes')
check('Cita NO expone datos internos', appts.data.appointments[0]?.patientId === undefined)

// 2. Resumen de alertas para el badge
const alertsPsy = await api('GET', '/staff/alerts/summary', { token: psy.data.token })
check('Resumen de alertas psicóloga (María en medio)', alertsPsy.status === 200 && alertsPsy.data.medio === 1 && alertsPsy.data.alto === 0, JSON.stringify(alertsPsy.data))
const alertsAdmin = await api('GET', '/staff/alerts/summary', { token: admin.data.token })
check('Resumen de alertas admin (global)', alertsAdmin.status === 200 && alertsAdmin.data.medio >= 1)

// 3. Paciente NO puede ver el resumen de staff
const denied = await api('GET', '/staff/alerts/summary', { token: maria.data.token })
check('Paciente bloqueado en resumen de alertas (403)', denied.status === 403)

console.log(failures === 0 ? '\n🎉 FUNCIONES NUEVAS OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
