// ─── Orquestador de la suite completa ───────────────────────────
// Antes había que iniciar el backend a mano en una terminal y correr
// los tests en otra, reiniciando el backend antes de cada intento
// (los datos viven en memoria y varios tests registran usuarios con
// correos fijos: sin reiniciar, el segundo intento fallaba con 409).
//
// Este script levanta su propio backend, en memoria, en un puerto
// libre elegido por el sistema operativo, corre la suite contra él y
// lo apaga al terminar. Así "npm test" siempre parte de cero, sin
// pasos manuales — y puede correr igual en una terminal local o en CI.

import { spawn, spawnSync } from 'child_process'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAIZ_BACKEND = path.join(__dirname, '..')

// Orden importante: citas-alertas.test.mjs reutiliza la sesión y las
// alertas que deja registradas e2e.test.mjs, así que debe correr justo
// después. El resto es independiente entre sí.
const ARCHIVOS = [
  'cifrado.test.mjs',
  'roles.test.mjs',
  'e2e.test.mjs',
  'citas-alertas.test.mjs',
  'permisos-contacto-ajustes.test.mjs',
  'contrasenas.test.mjs',
  'auditoria.test.mjs',
  'alerta-riesgo-correo.test.mjs',
]

function puertoLibre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function esperarListo(base, limiteMs = 12000) {
  const hasta = Date.now() + limiteMs
  while (Date.now() < hasta) {
    try {
      const r = await fetch(base + '/api/health')
      if (r.ok) return
    } catch { /* el puerto aún no acepta conexiones */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('El backend de pruebas no respondió a tiempo.')
}

async function main() {
  const port = await puertoLibre()
  const base = `http://localhost:${port}`

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'development',            // siembra admin/psicóloga/monitor de prueba
    JWT_SECRET: randomBytes(48).toString('hex'),
    CONTIGO_DATA_DIR: '',                // fuerza memoria, sin importar lo que diga .env
    CONTIGO_API_BASE: `${base}/api`,
  }

  console.log(`🧪 Backend de pruebas aislado en el puerto ${port} (en memoria)\n`)
  const servidor = spawn(process.execPath, ['server.js'], { cwd: RAIZ_BACKEND, env, stdio: 'pipe' })
  let logServidor = ''
  servidor.stdout.on('data', d => { logServidor += d })
  servidor.stderr.on('data', d => { logServidor += d })

  let codigoSalida = 0
  try {
    await esperarListo(base)

    for (const archivo of ARCHIVOS) {
      console.log(`\n── ${archivo} ${'─'.repeat(Math.max(0, 50 - archivo.length))}`)
      const r = spawnSync(process.execPath, [archivo], { cwd: __dirname, env, stdio: 'inherit' })
      if (r.status !== 0) {
        codigoSalida = 1
        console.log(`\n💥 ${archivo} falló — se detiene la suite ahí.`)
        break
      }
    }
  } catch (e) {
    codigoSalida = 1
    console.error(`\n⛔ ${e.message}`)
    if (logServidor) console.error(`\n── Salida del backend de pruebas ──\n${logServidor}`)
  } finally {
    servidor.kill()
  }

  process.exit(codigoSalida)
}

main()
