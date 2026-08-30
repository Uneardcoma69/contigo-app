// Prueba del enfriamiento del aviso de riesgo alto por correo
// (backend/mailer.js, disparado desde backend/store.js:updateRiskLevel).
// No necesita el servidor ni SMTP real: llama al store directamente,
// en memoria, en un proceso aparte para no tocar la base de datos que
// usan los demás tests ni la de desarrollo.

import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE = pathToFileURL(path.join(__dirname, '..', 'store.js')).href
let failures = 0

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

const script = `
import * as store from '${STORE}'

const paciente = store.createUser({ name: 'Paciente Riesgo', email: 'riesgo@test.com', password: 'x' })
const otro     = store.createUser({ name: 'Otro Paciente',   email: 'otro-riesgo@test.com', password: 'x' })

function marcar(user, level, score) {
  return store.updateRiskLevel(user._id, {
    userName: user.name, userEmail: user.email,
    level, score, lastMessage: 'mensaje de prueba', triggerWords: []
  })
}

const r1 = marcar(paciente, 'alto', 10)
const r2 = marcar(paciente, 'alto', 10)
const r3 = marcar(paciente, 'medio', 5)
const r4 = marcar(otro, 'alto', 10)

console.log(JSON.stringify({
  primeraAlerta: r1.notificarAlto,
  segundaSeguida: r2.notificarAlto,
  medioNoAvisa: r3.notificarAlto,
  otroPacienteIndependiente: r4.notificarAlto
}))
`

const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' })
const salida = r.stdout || ''
if (r.stderr) console.error(r.stderr)

let resultado = {}
try { resultado = JSON.parse(salida.trim().split('\\n').pop()) } catch { /* se reporta abajo */ }

check('Primer mensaje en ALTO sí avisa', resultado.primeraAlerta === true, JSON.stringify(resultado))
check('Segundo mensaje en ALTO seguido no repite el aviso', resultado.segundaSeguida === false, JSON.stringify(resultado))
check('Un mensaje en MEDIO nunca avisa por correo', resultado.medioNoAvisa === false, JSON.stringify(resultado))
check('El enfriamiento es por persona, no global', resultado.otroPacienteIndependiente === true, JSON.stringify(resultado))

console.log(failures === 0 ? '\n🎉 AVISO DE RIESGO ALTO OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
