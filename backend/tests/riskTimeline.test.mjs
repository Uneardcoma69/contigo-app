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

const admin = await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })
const adminToken = admin.data.token
const psy = await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })

const sinPermiso = await api('GET', '/admin/risk-timeline', { token: psy.data.token })
check('Psicóloga bloqueada en risk-timeline (403)', sinPermiso.status === 403, JSON.stringify(sinPermiso.data))

// 1er paciente con un mensaje de riesgo ALTO inequívoco: por ahora es el
// único, así que el resumen debe nombrarlo como "la misma persona".
const pat1 = await api('POST', '/auth/register', { body: { name: 'Timeline Uno', email: 'timeline1@test.com', password: 'test123' } })
await api('POST', '/chat', { token: pat1.data.token, body: { message: 'Ya decidí suicidarme, tengo una carta de despedida' } })

const overviewUno = await api('GET', '/admin/risk-timeline', { token: adminToken })
check('risk-timeline responde 200', overviewUno.status === 200, JSON.stringify(overviewUno.data))
check('Con una sola persona, el resumen la nombra', overviewUno.data.resumen.includes('Timeline Uno'), overviewUno.data.resumen)
check('Con una sola persona, dice "la misma persona"', overviewUno.data.resumen.includes('la misma persona'), overviewUno.data.resumen)

// 2do paciente, también con un mensaje inequívoco: ahora deben ser "personas distintas".
const pat2 = await api('POST', '/auth/register', { body: { name: 'Timeline Dos', email: 'timeline2@test.com', password: 'test123' } })
await api('POST', '/chat', { token: pat2.data.token, body: { message: 'No quiero seguir viviendo, ya lo decidí' } })

const overviewDos = await api('GET', '/admin/risk-timeline', { token: adminToken })
check('Con dos personas, el resumen dice "personas distintas"', overviewDos.data.resumen.includes('personas distintas'), overviewDos.data.resumen)
check('Ya no nombra a una sola persona', !overviewDos.data.resumen.includes('la misma persona'), overviewDos.data.resumen)
check('stats.alertasAlto cuenta al menos las dos', overviewDos.data.stats.alertasAlto >= 2, JSON.stringify(overviewDos.data.stats))
check('stats.personasEnSeguimiento incluye a los pacientes', overviewDos.data.stats.personasEnSeguimiento >= 2, JSON.stringify(overviewDos.data.stats))
check('Trae 6 semanas de 7 días cada una',
  overviewDos.data.semanas?.length === 6 && overviewDos.data.semanas.every(s => s.celdas?.length === 7),
  JSON.stringify(overviewDos.data.semanas?.length))
check('La semana actual (última) tiene alguna celda en alto',
  overviewDos.data.semanas[5].celdas.some(c => c.nivel === 'alto'), JSON.stringify(overviewDos.data.semanas[5]))

console.log(failures === 0 ? '\n🎉 LÍNEA DE TIEMPO OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
