// Pruebas del almacenamiento cifrado en disco.
// No necesitan el servidor: ejecutan el store en procesos hijos con
// distintas variables de entorno.

import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// En Windows el import dinámico exige una URL file://
const STORE = pathToFileURL(path.join(__dirname, '..', 'store.js')).href
const CLAVE = 'a'.repeat(64)   // 32 bytes en hexadecimal
let failures = 0

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

function nuevoDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'contigo-test-'))
}

/** Ejecuta código con el store cargado, en un proceso aparte. */
function conStore(dir, clave, codigo) {
  const script = `import * as store from '${STORE}'\n${codigo}`
  const env = { ...process.env, CONTIGO_DATA_DIR: dir }
  if (clave) env.CONTIGO_DATA_KEY = clave
  else delete env.CONTIGO_DATA_KEY
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
  })
}

console.log('── Cifrado en disco ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')

  conStore(dir, CLAVE, `store.createUser({ name: 'Ana Secreta', email: 'ana.secreta@ejemplo.com', password: 'hash' })`)

  const contenido = fs.readFileSync(archivo, 'utf8')
  check('El archivo se crea', fs.existsSync(archivo))
  check('El correo NO aparece en claro', !contenido.includes('ana.secreta@ejemplo.com'))
  check('El nombre NO aparece en claro', !contenido.includes('Ana Secreta'))
  check('Tiene el sobre cifrado esperado', contenido.includes('contigo-cifrado') && contenido.includes('aes-256-gcm'))

  const salida = conStore(dir, CLAVE, `console.log(JSON.stringify(store.getAllUsers().map(u => u.email)))`)
  check('Se descifra al volver a cargar', salida.includes('ana.secreta@ejemplo.com'), salida.trim())

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Sin clave: se guarda en claro (modo servidor) ──')
{
  const dir = nuevoDir()
  conStore(dir, null, `store.createUser({ name: 'Sin Cifrar', email: 'plano@ejemplo.com', password: 'hash' })`)
  const contenido = fs.readFileSync(path.join(dir, 'contigo-data.json'), 'utf8')
  check('Sin clave el contenido queda legible', contenido.includes('plano@ejemplo.com'))
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Migración de archivo en claro a cifrado ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')

  // Se crea sin clave (como una instalación anterior)
  conStore(dir, null, `store.createUser({ name: 'Antiguo Usuario', email: 'antiguo@ejemplo.com', password: 'hash' })`)
  check('Punto de partida en claro', fs.readFileSync(archivo, 'utf8').includes('antiguo@ejemplo.com'))

  // Ahora se abre con clave: debe migrarse solo
  const salida = conStore(dir, CLAVE, `console.log(JSON.stringify(store.getAllUsers().map(u => u.email)))`)
  check('Los datos anteriores se conservan', salida.includes('antiguo@ejemplo.com'))
  const despues = fs.readFileSync(archivo, 'utf8')
  check('El archivo queda cifrado tras migrar', despues.includes('contigo-cifrado'))
  check('Ya no hay datos en claro', !despues.includes('antiguo@ejemplo.com'))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Protección: no sobrescribir datos ilegibles ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')

  conStore(dir, CLAVE, `store.createUser({ name: 'Valioso', email: 'valioso@ejemplo.com', password: 'hash' })`)
  const original = fs.readFileSync(archivo, 'utf8')

  // Se abre con la clave equivocada y se crean datos nuevos
  const claveMala = 'b'.repeat(64)
  const salida = conStore(dir, claveMala, `
    store.createUser({ name: 'Intruso', email: 'intruso@ejemplo.com', password: 'hash' })
    console.log('usuarios en memoria:', store.getAllUsers().length)
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Avisa que la persistencia queda bloqueada', salida.includes('"bloqueado":true'), salida.trim().split('\n').pop())

  const despues = fs.readFileSync(archivo, 'utf8')
  check('El archivo original NO se sobrescribió', despues === original)

  // Con la clave correcta, los datos siguen intactos
  const recuperado = conStore(dir, CLAVE, `console.log(JSON.stringify(store.getAllUsers().map(u => u.email)))`)
  check('Los datos se recuperan con la clave correcta', recuperado.includes('valioso@ejemplo.com'))
  check('El intruso no llegó al archivo', !recuperado.includes('intruso@ejemplo.com'))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Archivo corrupto ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')
  fs.writeFileSync(archivo, '{ esto no es json valido')

  const salida = conStore(dir, CLAVE, `
    store.createUser({ name: 'Nuevo', email: 'nuevo@ejemplo.com', password: 'hash' })
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Detecta el archivo corrupto y bloquea el guardado', salida.includes('"bloqueado":true'))
  check('Deja el archivo corrupto intacto para recuperarlo', fs.readFileSync(archivo, 'utf8') === '{ esto no es json valido')

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(failures === 0 ? '\n🎉 CIFRADO Y PERSISTENCIA OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
