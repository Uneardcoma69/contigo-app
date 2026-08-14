// Pruebas del almacenamiento en disco: cifrado, migración desde el
// formato anterior y protección frente a datos ilegibles.
// No necesitan el servidor: ejecutan el store en procesos hijos con
// distintas variables de entorno.

import { spawnSync } from 'child_process'
import { createCipheriv, randomBytes } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import initSqlJs from 'sql.js'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
// En Windows el import dinámico exige una URL file://
const STORE = pathToFileURL(path.join(__dirname, '..', 'store.js')).href
const CLAVE = 'a'.repeat(64)   // 32 bytes en hexadecimal
let failures = 0

const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

function nuevoDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'contigo-test-'))
}

/**
 * Ejecuta código con el store cargado, en un proceso aparte.
 * Devuelve la salida estándar y la de error juntas: los avisos del
 * almacén (archivo ilegible, candado en uso) se escriben en stderr.
 */
function conStore(dir, clave, codigo) {
  const script = `import * as store from '${STORE}'\n${codigo}`
  const env = { ...process.env, CONTIGO_DATA_DIR: dir }
  if (clave) env.CONTIGO_DATA_KEY = clave
  else delete env.CONTIGO_DATA_KEY
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env, encoding: 'utf8'
  })
  return (r.stdout || '') + (r.stderr || '')
}

/** Abre el archivo como base SQLite y devuelve los correos registrados. */
function correosEnArchivo(archivo) {
  const base = new SQL.Database(new Uint8Array(fs.readFileSync(archivo)))
  try {
    const r = base.exec('SELECT email FROM users')
    return r[0]?.values.map(v => v[0]) ?? []
  } finally {
    base.close()
  }
}

/** Arma un volcado con el formato anterior (Map serializados). */
function volcadoHeredado() {
  const idPaciente = '11111111-1111-4111-8111-111111111111'
  const idPsicologa = '22222222-2222-4222-8222-222222222222'
  return {
    users: [
      [idPsicologa, {
        _id: idPsicologa, name: 'Laura Heredada', email: 'laura.heredada@ejemplo.com',
        password: 'hash-psi', role: 'psychologist', assignedPsychologistId: null,
        tokenVersion: 2, createdAt: '2026-01-01T10:00:00.000Z'
      }],
      [idPaciente, {
        _id: idPaciente, name: 'Pedro Heredado', email: 'pedro.heredado@ejemplo.com',
        password: 'hash-pac', role: 'user', assignedPsychologistId: idPsicologa,
        tokenVersion: 0, createdAt: '2026-01-02T10:00:00.000Z'
      }]
    ],
    conversations: [
      [idPaciente, [
        { _id: 'm1', role: 'user', content: 'Mensaje heredado del paciente', createdAt: '2026-01-03T10:00:00.000Z' },
        { _id: 'm2', role: 'assistant', content: 'Respuesta heredada', createdAt: '2026-01-03T10:00:05.000Z' }
      ]]
    ],
    goals: [
      [idPaciente, [
        { _id: 'g1', title: 'Meta heredada cumplida', category: 'sueño', completed: true, completedAt: '2026-01-04T10:00:00.000Z', createdAt: '2026-01-03T10:00:00.000Z' },
        { _id: 'g2', title: 'Meta heredada pendiente', category: 'mente', completed: false, createdAt: '2026-01-03T11:00:00.000Z' }
      ]]
    ],
    riskAlerts: [
      [idPaciente, {
        userId: idPaciente, userName: 'Pedro Heredado', userEmail: 'pedro.heredado@ejemplo.com',
        level: 'medio', score: 6, lastMessage: 'me siento muy triste',
        triggerWords: ['triste', 'sin esperanza'], lastAnalysis: '2026-01-05T10:00:00.000Z',
        alerts: [
          { level: 'medio', score: 6, message: 'me siento muy triste', triggerWords: ['triste'], timestamp: '2026-01-05T10:00:00.000Z' }
        ]
      }]
    ],
    medicalRecords: [
      [idPaciente, {
        userId: idPaciente,
        info: { edad: '31', ocupacion: 'Docente', motivoConsulta: 'Estrés laboral' },
        validationStatus: 'validada', validatedBy: idPsicologa, validatedByName: 'Laura Heredada',
        validationNote: 'Revisada', validatedAt: '2026-01-06T10:00:00.000Z',
        createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-05T12:00:00.000Z'
      }]
    ],
    progressNotes: [
      [idPaciente, [
        { _id: 'n1', authorId: idPsicologa, authorName: 'Laura Heredada', text: 'Nota heredada de seguimiento', createdAt: '2026-01-06T10:00:00.000Z' }
      ]]
    ],
    appointments: [
      ['a1', {
        _id: 'a1', patientId: idPaciente, psychologistId: idPsicologa,
        date: '2026-02-01T15:00:00.000Z', durationMin: 60, modality: 'presencial',
        status: 'completada', notes: 'Primera sesión', createdAt: '2026-01-07T10:00:00.000Z'
      }]
    ],
    contactMessages: [
      ['c1', {
        _id: 'c1', nombre: 'Visitante Heredado', correo: 'visitante@ejemplo.com',
        telefono: '3001112233', motivo: 'Terapia individual', mensaje: 'Consulta heredada',
        createdAt: '2026-01-08T10:00:00.000Z'
      }]
    ]
  }
}

/** Cifra un texto con el mismo sobre que usa el store. */
function cifrarComoElStore(texto, claveHex) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(claveHex, 'hex'), iv)
  const datos = Buffer.concat([cipher.update(Buffer.from(texto, 'utf8')), cipher.final()])
  return JSON.stringify({
    formato: 'contigo-cifrado', alg: 'aes-256-gcm',
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    datos: datos.toString('base64')
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

console.log('\n── Sin clave: base SQLite sin cifrar (modo servidor) ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')
  conStore(dir, null, `store.createUser({ name: 'Sin Cifrar', email: 'plano@ejemplo.com', password: 'hash' })`)

  const bytes = fs.readFileSync(archivo)
  check('Sin clave el archivo es una base SQLite', bytes.subarray(0, 15).toString('latin1') === 'SQLite format 3')
  // Se consulta la base de verdad en vez de buscar texto dentro de un binario
  check('La base contiene el usuario', correosEnArchivo(archivo).includes('plano@ejemplo.com'))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Migración desde el formato anterior (sin cifrar) ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')
  const respaldo = archivo + '.pre-sql-backup'
  fs.writeFileSync(archivo, JSON.stringify(volcadoHeredado()))

  const salida = conStore(dir, null, `
    const usuarios = store.getAllUsers()
    const paciente = usuarios.find(u => u.role === 'user')
    const psicologa = usuarios.find(u => u.role === 'psychologist')
    console.log(JSON.stringify({
      usuarios: usuarios.length,
      correos: usuarios.map(u => u.email).sort(),
      asignacion: paciente.assignedPsychologistId === psicologa._id,
      mensajes: store.getHistory(paciente._id).map(m => m.content),
      metas: store.getGoals(paciente._id).map(g => ({ t: g.title, c: g.completed })),
      riesgo: (() => { const r = store.getRiskProfile(paciente._id); return { nivel: r.level, score: r.score, palabras: r.triggerWords, alertas: r.alerts.length } })(),
      ficha: (() => { const f = store.getMedicalRecord(paciente._id); return { info: f.info, estado: f.validationStatus, validadaPor: f.validatedByName } })(),
      notas: store.getProgressNotes(paciente._id).map(n => n.text),
      citas: store.getAppointmentsForPatient(paciente._id).map(c => ({ m: c.modality, s: c.status, d: c.durationMin })),
      contacto: store.getContactMessages().map(c => c.correo)
    }))
  `)
  const d = JSON.parse(salida.trim().split('\n').pop())

  check('Migra ambos usuarios', d.usuarios === 2, JSON.stringify(d.correos))
  check('Conserva los identificadores y la asignación', d.asignacion === true)
  check('Migra los mensajes del chat', d.mensajes.length === 2 && d.mensajes[0] === 'Mensaje heredado del paciente')
  check('Migra las metas con su estado', d.metas.length === 2 && d.metas.find(m => m.t === 'Meta heredada cumplida')?.c === true)
  check('Migra el perfil de riesgo', d.riesgo.nivel === 'medio' && d.riesgo.score === 6 && d.riesgo.alertas === 1)
  check('Conserva las palabras detectadas', Array.isArray(d.riesgo.palabras) && d.riesgo.palabras.includes('triste'))
  check('Migra la ficha médica validada', d.ficha.estado === 'validada' && d.ficha.validadaPor === 'Laura Heredada')
  check('La ficha solo expone los campos registrados', Object.keys(d.ficha.info).sort().join(',') === 'edad,motivoConsulta,ocupacion', JSON.stringify(d.ficha.info))
  check('Migra las notas de progreso', d.notas.length === 1 && d.notas[0] === 'Nota heredada de seguimiento')
  check('Migra las citas', d.citas.length === 1 && d.citas[0].m === 'presencial' && d.citas[0].s === 'completada')
  check('Migra los mensajes de contacto', d.contacto.includes('visitante@ejemplo.com'))

  check('Deja un respaldo del formato anterior', fs.existsSync(respaldo))
  check('El respaldo conserva el contenido original', JSON.parse(fs.readFileSync(respaldo, 'utf8')).users.length === 2)
  check('El archivo queda en formato SQLite', fs.readFileSync(archivo).subarray(0, 15).toString('latin1') === 'SQLite format 3')

  // Idempotencia: al abrir de nuevo no debe volver a migrar ni duplicar
  const segunda = conStore(dir, null, `console.log(JSON.stringify({ n: store.getAllUsers().length }))`)
  check('Abrir de nuevo no duplica datos', JSON.parse(segunda.trim().split('\n').pop()).n === 2)
  check('No vuelve a anunciar la migración', !segunda.includes('migrando'))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Migración desde el formato anterior (cifrado) ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')
  fs.writeFileSync(archivo, cifrarComoElStore(JSON.stringify(volcadoHeredado()), CLAVE))

  const salida = conStore(dir, CLAVE, `console.log(JSON.stringify(store.getAllUsers().map(u => u.email).sort()))`)
  check('Migra un archivo heredado que estaba cifrado', salida.includes('pedro.heredado@ejemplo.com'), salida.trim())

  const contenido = fs.readFileSync(archivo, 'utf8')
  check('Sigue cifrado después de migrar', contenido.includes('contigo-cifrado'))
  check('Ningún correo queda en claro', !contenido.includes('pedro.heredado@ejemplo.com'))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Candado: una sola instancia por archivo ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')
  const candado = archivo + '.lock'

  conStore(dir, null, `store.createUser({ name: 'Primero', email: 'primero@ejemplo.com', password: 'hash' })`)
  const original = fs.readFileSync(archivo)

  // Simular que otro proceso vivo tiene el archivo tomado
  fs.writeFileSync(candado, JSON.stringify({ pid: 999999, host: 'otro-equipo', heartbeat: Date.now() }))

  const salida = conStore(dir, null, `
    store.createUser({ name: 'Segunda instancia', email: 'segunda@ejemplo.com', password: 'hash' })
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Detecta que otro proceso tiene el archivo', salida.includes('Otro proceso ya está usando'), salida.trim().split('\n').pop())
  check('La segunda instancia no guarda nada', salida.includes('"bloqueado":true'))
  check('El archivo de la primera queda intacto', fs.readFileSync(archivo).equals(original))

  // Un candado viejo (proceso caído) no debe bloquear para siempre
  fs.writeFileSync(candado, JSON.stringify({ pid: 999999, host: 'otro-equipo', heartbeat: Date.now() - 60000 }))
  const salida2 = conStore(dir, null, `
    store.createUser({ name: 'Tras reinicio', email: 'reinicio@ejemplo.com', password: 'hash' })
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Un candado abandonado no bloquea el arranque', salida2.includes('"bloqueado":false'), salida2.trim().split('\n').pop())
  check('Tras retomar el candado sí guarda', correosEnArchivo(archivo).includes('reinicio@ejemplo.com'))
  check('El candado se libera al terminar', !fs.existsSync(candado))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('\n── Protección: no sobrescribir datos ilegibles ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')

  conStore(dir, CLAVE, `store.createUser({ name: 'Valioso', email: 'valioso@ejemplo.com', password: 'hash' })`)
  const original = fs.readFileSync(archivo)

  // Se abre con la clave equivocada y se crean datos nuevos
  const claveMala = 'b'.repeat(64)
  const salida = conStore(dir, claveMala, `
    store.createUser({ name: 'Intruso', email: 'intruso@ejemplo.com', password: 'hash' })
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Avisa que la persistencia queda bloqueada', salida.includes('"bloqueado":true'), salida.trim().split('\n').pop())
  check('El archivo original NO se sobrescribió', fs.readFileSync(archivo).equals(original))

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

console.log('\n── Base SQLite truncada ──')
{
  const dir = nuevoDir()
  const archivo = path.join(dir, 'contigo-data.json')

  conStore(dir, null, `store.createUser({ name: 'Antes', email: 'antes@ejemplo.com', password: 'hash' })`)
  const completo = fs.readFileSync(archivo)
  // Cortar la base a la mitad: conserva la firma, pero el contenido es inválido
  fs.writeFileSync(archivo, completo.subarray(0, Math.floor(completo.length / 2)))
  const truncado = fs.readFileSync(archivo)

  const salida = conStore(dir, null, `
    store.createUser({ name: 'Despues', email: 'despues@ejemplo.com', password: 'hash' })
    console.log('estado:', JSON.stringify(store.getStorageStatus()))
  `)
  check('Detecta la base truncada y bloquea el guardado', salida.includes('"bloqueado":true'), salida.trim().split('\n').pop())
  check('Deja el archivo truncado intacto', fs.readFileSync(archivo).equals(truncado))

  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(failures === 0 ? '\n🎉 CIFRADO Y PERSISTENCIA OK' : `\n💥 ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
