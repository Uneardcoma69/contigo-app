// Test unitario: no necesita el backend levantado, solo importa el módulo.
import { analyzeMessage } from '../riskAnalyzer.js'

let failures = 0
function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

// Frases de uso cotidiano bajadas de ALTO a MEDIO: una sola no debe disparar
// la alerta de crisis completa (mensaje al paciente + correo al equipo).
const soloUnaFrase = analyzeMessage('Tengo un plan para mañana con mis amigas')
check('Una sola frase ambigua da MEDIO, no ALTO', soloUnaFrase.level === 'medio', JSON.stringify(soloUnaFrase))

const otraFraseSola = analyzeMessage('Voy a colgarme de la videollamada en 5 minutos')
check('"colgarme" en contexto benigno da MEDIO, no ALTO', otraFraseSola.level === 'medio', JSON.stringify(otraFraseSola))

// Dos de estas frases combinadas en el mismo mensaje sí deben seguir
// clasificando como ALTO: la señal combinada se conserva.
const dosFrases = analyzeMessage('Tengo un plan para esta noche y sé cómo hacerlo')
check('Dos frases ambiguas combinadas siguen dando ALTO', dosFrases.level === 'alto', JSON.stringify(dosFrases))

// Las frases inequívocas de HIGH_KEYWORDS no se tocaron: deben seguir en ALTO por sí solas.
const inequivoco = analyzeMessage('Ya decidí suicidarme')
check('Frase inequívoca sigue dando ALTO por sí sola', inequivoco.level === 'alto', JSON.stringify(inequivoco))

console.log(failures === 0 ? '\n🎉 TODAS LAS PRUEBAS PASARON' : `\n💥 ${failures} pruebas fallaron`)
process.exit(failures === 0 ? 0 : 1)
