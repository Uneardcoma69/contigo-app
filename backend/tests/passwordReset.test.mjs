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

// El ciclo de vida del token (generarlo, canjearlo, que no se pueda reusar)
// se prueba aparte en passwordResetToken.test.mjs, importando store.js
// directo — no hay bandeja de correo real que leer acá, así que por HTTP
// solo se puede probar lo que no depende de conocer el token real.
await api('POST', '/auth/register', { body: { name: 'Reset Prueba', email: 'reset-prueba@test.com', password: 'original123' } })

const conCuenta = await api('POST', '/auth/forgot-password', { body: { email: 'reset-prueba@test.com' } })
const sinCuenta = await api('POST', '/auth/forgot-password', { body: { email: 'no-existe-nadie@test.com' } })
check('Responde 200 con una cuenta real', conCuenta.status === 200, JSON.stringify(conCuenta.data))
check('Responde 200 con un correo inexistente (no filtra si existe)', sinCuenta.status === 200, JSON.stringify(sinCuenta.data))
check('El mensaje es idéntico en ambos casos', conCuenta.data.message === sinCuenta.data.message)

const sinDatos = await api('PUT', '/auth/reset-password', { body: {} })
check('Sin token ni contraseña, rechaza (400)', sinDatos.status === 400, JSON.stringify(sinDatos.data))
const tokenFalso = await api('PUT', '/auth/reset-password', { body: { token: 'no-existe-este-token', newPassword: 'nuevaClave123' } })
check('Token inventado rechazado (400)', tokenFalso.status === 400, JSON.stringify(tokenFalso.data))
const corta = await api('PUT', '/auth/reset-password', { body: { token: 'lo-que-sea', newPassword: '123' } })
check('Contraseña nueva demasiado corta, rechaza (400)', corta.status === 400, JSON.stringify(corta.data))

console.log(failures === 0 ? '\n🎉 RECUPERACIÓN DE CONTRASEÑA (HTTP) OK' : `\n💥 ${failures} fallos`)
// Salir de golpe justo después de un fetch puede pisar el cierre del socket
// keep-alive en Windows (crash nativo de libuv, no un fallo real de test:
// todos los check() ya corrieron e imprimieron arriba). Un respiro breve
// alcanza para que el handle termine de cerrarse solo.
await new Promise(r => setTimeout(r, 200))
process.exit(failures === 0 ? 0 : 1)
