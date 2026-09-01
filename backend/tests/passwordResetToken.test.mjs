// Test unitario: no necesita el backend levantado, solo importa el módulo
// (igual que riskAnalyzer.test.mjs). A propósito no mezcla `fetch()` con
// importar store.js en el mismo proceso, ver passwordReset.test.mjs.
import { createUser, createPasswordReset, consumePasswordReset } from '../store.js'

let failures = 0
function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

const u = createUser({ name: 'Ciclo Token', email: 'ciclo-token@test.com', password: 'hash-lo-que-sea' })

const token1 = createPasswordReset(u._id)
check('Canjear el token real devuelve el userId correcto', consumePasswordReset(token1) === u._id)
check('El mismo token no se puede reusar', consumePasswordReset(token1) === null)

const tokenViejo = createPasswordReset(u._id)
const tokenNuevo = createPasswordReset(u._id) // pedir de nuevo invalida el anterior sin usar
check('Pedir un enlace nuevo invalida el anterior sin usar', consumePasswordReset(tokenViejo) === null)
check('El más reciente sí es válido', consumePasswordReset(tokenNuevo) === u._id)

console.log(failures === 0 ? '\n🎉 CICLO DEL TOKEN DE RECUPERACIÓN OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
