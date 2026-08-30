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

// Paciente de prueba
const reg = await api('POST', '/auth/register', {
  body: { name: 'Clave Prueba', email: 'clave@test.com', password: 'inicial123' }
})
check('Registro del paciente de prueba', reg.status === 201)
const tokenViejo = reg.data.token

console.log('\n── Cambiar mi propia contraseña ──')

const sinActual = await api('PUT', '/auth/password', { token: tokenViejo, body: { newPassword: 'nueva123' } })
check('Rechaza sin la contraseña actual (400)', sinActual.status === 400)

const corta = await api('PUT', '/auth/password', { token: tokenViejo, body: { currentPassword: 'inicial123', newPassword: '123' } })
check('Rechaza contraseña corta (400)', corta.status === 400)

const actualMala = await api('PUT', '/auth/password', { token: tokenViejo, body: { currentPassword: 'equivocada', newPassword: 'nueva123' } })
check('Rechaza si la contraseña actual no coincide (401)', actualMala.status === 401)

const igual = await api('PUT', '/auth/password', { token: tokenViejo, body: { currentPassword: 'inicial123', newPassword: 'inicial123' } })
check('Rechaza si la nueva es igual a la actual (400)', igual.status === 400)

const cambio = await api('PUT', '/auth/password', { token: tokenViejo, body: { currentPassword: 'inicial123', newPassword: 'nueva123' } })
check('Cambia la contraseña y devuelve token nuevo', cambio.status === 200 && !!cambio.data.token)
const tokenNuevo = cambio.data.token

console.log('\n── Invalidación de sesiones ──')

const conViejo = await api('GET', '/goals', { token: tokenViejo })
check('El token anterior queda invalidado (401)', conViejo.status === 401, `status=${conViejo.status}`)

const conNuevo = await api('GET', '/goals', { token: tokenNuevo })
check('El token nuevo sigue funcionando', conNuevo.status === 200)

const loginViejo = await api('POST', '/auth/login', { body: { email: 'clave@test.com', password: 'inicial123' } })
check('La contraseña anterior ya no sirve (401)', loginViejo.status === 401)

const loginNuevo = await api('POST', '/auth/login', { body: { email: 'clave@test.com', password: 'nueva123' } })
check('La contraseña nueva permite entrar', loginNuevo.status === 200)

console.log('\n── Restablecimiento por el administrador ──')

const admin = (await api('POST', '/auth/login', { body: { email: 'admin@contigo.com', password: 'admin123' } })).data
const psy   = (await api('POST', '/auth/login', { body: { email: 'psicologa@contigo.com', password: 'contigo123' } })).data
const usuarioId = loginNuevo.data.user.id
const sesionDelUsuario = loginNuevo.data.token

const porPsico = await api('PUT', `/admin/users/${usuarioId}/password`, { token: psy.token, body: { newPassword: 'intruso123' } })
check('Psicóloga NO puede restablecer contraseñas (403)', porPsico.status === 403)

const propia = await api('PUT', `/admin/users/${admin.user.id}/password`, { token: admin.token, body: { newPassword: 'otracosa123' } })
check('Admin no puede restablecer la suya por esta vía (400)', propia.status === 400)

const cortaAdmin = await api('PUT', `/admin/users/${usuarioId}/password`, { token: admin.token, body: { newPassword: 'abc' } })
check('Rechaza contraseña temporal corta (400)', cortaAdmin.status === 400)

const restablecer = await api('PUT', `/admin/users/${usuarioId}/password`, { token: admin.token, body: { newPassword: 'temporal123' } })
check('Admin restablece la contraseña', restablecer.status === 200)

const sesionCerrada = await api('GET', '/goals', { token: sesionDelUsuario })
check('El restablecimiento cierra las sesiones abiertas (401)', sesionCerrada.status === 401, `status=${sesionCerrada.status}`)

const conTemporal = await api('POST', '/auth/login', { body: { email: 'clave@test.com', password: 'temporal123' } })
check('Entra con la contraseña temporal', conTemporal.status === 200)

const staffSigue = await api('GET', '/staff/patients', { token: admin.token })
check('La sesión del admin no se ve afectada', staffSigue.status === 200)

console.log(failures === 0 ? '\n🎉 CONTRASEÑAS OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
