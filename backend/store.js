// ─── Almacén de datos (SQLite vía sql.js) ──────────────────────
// La base vive en memoria y se respalda en disco cuando
// CONTIGO_DATA_DIR está definido (app de escritorio).
//
// Si además CONTIGO_DATA_KEY trae una clave, el archivo se guarda
// cifrado con AES-256-GCM. El contenido incluye conversaciones sobre
// salud mental y fichas médicas, así que no debe quedar legible para
// otras cuentas del equipo ni si alguien copia el archivo.
//
// Motor: sql.js (SQLite compilado a WebAssembly). Se eligió sobre
// better-sqlite3 porque este proyecto corre el mismo código bajo dos
// runtimes con ABI distinto —el Node del sistema (tests y `npm run
// dev`) y el Node embebido en Electron (app de escritorio)—, y un
// módulo nativo exigiría recompilarse por separado para cada uno.
// WebAssembly es portable entre ambos sin compilar nada.

import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'
import { createRequire } from 'module'
import initSqlJs from 'sql.js'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)

// ── Configuración de persistencia ──────────────────────────────
const DATA_DIR    = process.env.CONTIGO_DATA_DIR || null
const DATA_FILE   = DATA_DIR ? path.join(DATA_DIR, 'contigo-data.json') : null
const BACKUP_FILE = DATA_FILE ? DATA_FILE + '.pre-sql-backup' : null
const LOCK_FILE   = DATA_FILE ? DATA_FILE + '.lock' : null

// Cada cuánto se refresca el candado y a partir de cuándo se considera
// abandonado (por ejemplo, tras un corte de luz).
const LOCK_REFRESH_MS = 5000
const LOCK_STALE_MS   = 20000

// Si la lectura del archivo falla, dejamos de guardar: sobrescribirlo
// con una base vacía borraría todos los expedientes.
let persistenceBlocked = false
let dirty = false

// Clave de cifrado (32 bytes en hexadecimal). Sin ella, el archivo se
// guarda sin cifrar, como en modo servidor.
const DATA_KEY = (() => {
  const raw = process.env.CONTIGO_DATA_KEY
  if (!raw) return null
  try {
    const key = Buffer.from(raw, 'hex')
    return key.length === 32 ? key : null
  } catch {
    return null
  }
})()

// ── Esquema ────────────────────────────────────────────────────
// Las fechas se guardan como texto ISO-8601: SQLite no tiene tipo
// fecha nativo y así se serializan igual en las respuestas JSON.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','monitor','psychologist','admin')),
  assigned_psychologist_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_assigned_psy ON users(assigned_psychologist_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

CREATE TABLE IF NOT EXISTS risk_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'bajo' CHECK (level IN ('bajo','medio','alto')),
  score REAL NOT NULL DEFAULT 0,
  last_message TEXT NOT NULL DEFAULT '',
  trigger_words TEXT NOT NULL DEFAULT '[]',
  last_analysis TEXT,
  level_since TEXT
);

CREATE TABLE IF NOT EXISTS risk_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  score REAL NOT NULL,
  message TEXT NOT NULL,
  trigger_words TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_user_created ON risk_alerts(user_id, created_at);

CREATE TABLE IF NOT EXISTS medical_records (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  edad TEXT,
  ocupacion TEXT,
  contacto_emergencia TEXT,
  telefono_emergencia TEXT,
  condiciones TEXT,
  medicamentos TEXT,
  antecedentes TEXT,
  motivo_consulta TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (validation_status IN ('pendiente','validada','rechazada')),
  validated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  validated_by_name TEXT,
  validation_note TEXT NOT NULL DEFAULT '',
  validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS progress_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_progress_notes_patient ON progress_notes(patient_id);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  psychologist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 50,
  modality TEXT NOT NULL DEFAULT 'online' CHECK (modality IN ('online','presencial')),
  status TEXT NOT NULL DEFAULT 'programada'
    CHECK (status IN ('programada','completada','cancelada')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_psy_date ON appointments(psychologist_id, date);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT '',
  mensaje TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at);

-- Quién consultó o modificó qué, y cuándo. Solo se añade: no hay forma
-- de editar ni borrar entradas desde la aplicación, porque un registro
-- que se puede alterar no sirve para rendir cuentas.
-- Los nombres se guardan copiados a propósito: si una cuenta se
-- renombra, el registro debe seguir diciendo lo que era en su momento.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_id);

-- El token en claro no vive acá, solo su hash: igual que una contraseña,
-- si alguien copiara este archivo no debería poder restablecer cuentas
-- ajenas con lo que encuentre en él.
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
`

// Topes de conservación (antes se aplicaban recortando arrays en JS)
const MAX_MESSAGES_PER_USER = 500
const MAX_ALERTS_PER_USER   = 50

// Ventana sin repetir el aviso de riesgo alto por correo a la misma
// persona: en una crisis real alguien puede escribir varios mensajes
// seguidos que califican en ALTO, y avisar por cada uno satura al
// equipo en vez de ayudarlo. El panel de alertas sigue registrando
// cada mensaje igual; esto solo limita el correo.
const ALERTA_RIESGO_COOLDOWN_MIN = 30
const MAX_CONTACT_MESSAGES  = 500

// El registro de auditoría se conserva mucho más tiempo que el resto:
// su valor está justamente en poder mirar atrás. El tope existe solo
// para que el archivo no crezca sin límite, y al recortar se avisa.
const MAX_AUDIT_ENTRIES = 20000

// Roles válidos: 'user' | 'monitor' | 'psychologist' | 'admin'
// Se declaran antes del arranque: la migración de datos heredados los
// necesita, y ejecutarla antes de esta línea daría un error de acceso.
export const ROLES = ['user', 'monitor', 'psychologist', 'admin']
export const STAFF_ROLES = ['monitor', 'psychologist', 'admin']

// ── Arranque del motor ─────────────────────────────────────────
const SQL = await initSqlJs({
  locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm')
})

let db = null

/**
 * `CREATE TABLE IF NOT EXISTS` no agrega columnas a una tabla que ya existe
 * en un archivo guardado de una versión anterior. Para esas, la columna se
 * agrega a mano una sola vez; para una base nueva, ya viene en el SCHEMA y
 * esto no hace nada.
 */
function asegurarColumnasNuevas(baseRef) {
  const stmt = baseRef.prepare("PRAGMA table_info(risk_profiles)")
  const columnas = []
  try {
    while (stmt.step()) columnas.push(stmt.getAsObject().name)
  } finally {
    stmt.free()
  }
  if (!columnas.includes('level_since')) {
    baseRef.run('ALTER TABLE risk_profiles ADD COLUMN level_since TEXT')
    // Para las filas ya existentes no se sabe desde cuándo está vigente el
    // nivel actual; el último análisis es la mejor aproximación disponible.
    baseRef.run('UPDATE risk_profiles SET level_since = last_analysis WHERE level_since IS NULL')
  }
}

function nuevaBase() {
  const base = new SQL.Database()
  base.run('PRAGMA foreign_keys = ON')
  base.exec(SCHEMA)
  asegurarColumnasNuevas(base)
  return base
}

// ── Utilidades de consulta ─────────────────────────────────────
function run(sql, params = []) {
  db.run(sql, params)
  dirty = true
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const filas = []
    while (stmt.step()) filas.push(stmt.getAsObject())
    return filas
  } finally {
    stmt.free()
  }
}

function one(sql, params = []) {
  return all(sql, params)[0] || null
}

const ahora = () => new Date().toISOString()
const aIso  = (v) => (v ? new Date(v).toISOString() : null)

// ── Cifrado del archivo ────────────────────────────────────────
function cifrar(bytes) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', DATA_KEY, iv)
  const datos = Buffer.concat([cipher.update(bytes), cipher.final()])
  return Buffer.from(JSON.stringify({
    formato: 'contigo-cifrado',
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    datos: datos.toString('base64')
  }))
}

function descifrar(sobre) {
  if (!DATA_KEY) throw new Error('El archivo está cifrado pero no hay clave disponible.')
  const decipher = createDecipheriv('aes-256-gcm', DATA_KEY, Buffer.from(sobre.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(sobre.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(sobre.datos, 'base64')),
    decipher.final()
  ])
}

/** Los archivos SQLite empiezan siempre con esta firma. */
function esSqlite(bytes) {
  return bytes.length >= 16 && bytes.subarray(0, 15).toString('latin1') === 'SQLite format 3'
}

// ── Candado de instancia única ─────────────────────────────────
// La base entera vive en memoria y se reescribe completa en cada
// guardado. Con dos procesos sobre el mismo archivo, el último en
// escribir borraría lo que hizo el otro, sin ningún aviso. El candado
// hace visible ese choque en vez de perder expedientes en silencio.
let lockTimer = null

function tomarCandado() {
  if (!LOCK_FILE) return true
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const previo = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
      const antiguedad = Date.now() - (previo.heartbeat || 0)
      if (antiguedad < LOCK_STALE_MS && previo.pid !== process.pid) {
        console.error('\n⛔ Otro proceso ya está usando este archivo de datos.')
        console.error(`   Archivo: ${DATA_FILE}`)
        console.error(`   En uso por: pid ${previo.pid}${previo.host ? ' en ' + previo.host : ''}`)
        console.error('   Esta aplicación guarda la base completa en cada escritura, así que')
        console.error('   dos instancias se pisarían. El guardado queda desactivado aquí.')
        console.error('   Si despliegas en la nube, deja una sola réplica.\n')
        return false
      }
    }
    escribirCandado()
    lockTimer = setInterval(escribirCandado, LOCK_REFRESH_MS)
    lockTimer.unref?.()
    return true
  } catch (e) {
    // Un candado ilegible no debe impedir arrancar: se avisa y sigue.
    console.warn('⚠️ No se pudo comprobar el candado del archivo:', e.message)
    return true
  }
}

function escribirCandado() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      pid: process.pid,
      host: os.hostname(),
      heartbeat: Date.now()
    }))
  } catch { /* si falla, el guardado normal ya reportará el problema */ }
}

function soltarCandado() {
  if (!LOCK_FILE) return
  try {
    if (lockTimer) clearInterval(lockTimer)
    const actual = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
    if (actual.pid === process.pid) fs.unlinkSync(LOCK_FILE)
  } catch { /* nada que soltar */ }
}

// ── Guardado y carga ───────────────────────────────────────────
function saveToDisk() {
  if (!DATA_FILE || persistenceBlocked || !dirty || !db) return
  try {
    const bytes = Buffer.from(db.export())
    fs.mkdirSync(DATA_DIR, { recursive: true })
    // Escritura atómica: primero a .tmp y luego renombrar
    const tmp = DATA_FILE + '.tmp'
    fs.writeFileSync(tmp, DATA_KEY ? cifrar(bytes) : bytes)
    fs.renameSync(tmp, DATA_FILE)
    dirty = false
  } catch (e) {
    console.error('⚠️ Error guardando datos:', e.message)
  }
}

/** Fuerza un guardado inmediato (lo usa el apagado ordenado del servidor). */
export function flushToDisk() {
  saveToDisk()
}

function loadFromDisk() {
  if (!DATA_FILE || !fs.existsSync(DATA_FILE)) {
    db = nuevaBase()
    return
  }

  try {
    const crudo = fs.readFileSync(DATA_FILE)
    let contenido = crudo
    let estabaCifrado = false

    // Un sobre cifrado —o un volcado JSON antiguo— empieza con '{'.
    // Un archivo SQLite empieza con su propia firma binaria.
    if (crudo.length > 0 && crudo[0] === 0x7b) {
      const sobre = JSON.parse(crudo.toString('utf8'))
      if (sobre?.formato === 'contigo-cifrado') {
        contenido = descifrar(sobre)
        estabaCifrado = true
      }
    }

    if (esSqlite(contenido)) {
      db = new SQL.Database(new Uint8Array(contenido))
      db.run('PRAGMA foreign_keys = ON')
      db.exec(SCHEMA)   // por si una versión futura agrega tablas
      asegurarColumnasNuevas(db)
      console.log(`💾 Datos cargados (${DATA_KEY ? '🔒 cifrados' : 'sin cifrar'}): ${contarUsuarios()} usuarios`)
      return
    }

    // Formato heredado: volcado JSON de los Map en memoria
    const volcado = JSON.parse(contenido.toString('utf8'))
    console.log('🔄 Detectado el formato anterior; migrando a base de datos...')
    respaldarAntesDeMigrar(crudo)
    db = nuevaBase()
    migrarDesdeVolcado(volcado)
    dirty = true
    saveToDisk()
    console.log(`✅ Migración completa: ${contarUsuarios()} usuarios${estabaCifrado ? ' (se conserva el cifrado)' : ''}`)
  } catch (e) {
    // No tocar el archivo: puede contener los únicos expedientes existentes
    persistenceBlocked = true
    db = nuevaBase()
    console.error('\n⛔ No se pudieron leer los datos guardados:', e.message)
    console.error(`   Archivo: ${DATA_FILE}`)
    console.error('   El guardado queda desactivado para no sobrescribirlo.')
    console.error('   Haz una copia del archivo antes de intentar recuperarlo.\n')
  }
}

function contarUsuarios() {
  return one('SELECT COUNT(*) AS n FROM users')?.n ?? 0
}

/** Copia el archivo anterior antes de reemplazarlo por el nuevo formato. */
function respaldarAntesDeMigrar(crudo) {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      fs.writeFileSync(BACKUP_FILE, crudo)
      console.log(`🗄️  Respaldo del formato anterior: ${BACKUP_FILE}`)
    }
  } catch (e) {
    console.error('⚠️ No se pudo crear el respaldo previo a la migración:', e.message)
  }
}

/**
 * Importa un volcado del almacén anterior conservando los identificadores
 * originales — si se regeneraran, las referencias entre tablas (mensajes,
 * citas, notas) apuntarían a usuarios inexistentes.
 */
function migrarDesdeVolcado(volcado) {
  const entradas = (nombre) => Array.isArray(volcado?.[nombre]) ? volcado[nombre] : []
  const ROLES_VALIDOS = new Set(ROLES)

  // Los usuarios van primero: el resto de tablas los referencia.
  for (const [, u] of entradas('users')) {
    if (!u?._id || !u?.email) continue
    run(
      `INSERT OR IGNORE INTO users
         (id, name, email, password, role, assigned_psychologist_id, token_version, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [u._id, u.name ?? '', String(u.email).toLowerCase(), u.password ?? '',
       ROLES_VALIDOS.has(u.role) ? u.role : 'user',
       null,                                  // se enlaza abajo, ya con todos creados
       Number(u.tokenVersion) || 0, aIso(u.createdAt) ?? ahora()]
    )
  }
  // Asignaciones en una segunda pasada, cuando ya existen ambos extremos
  for (const [, u] of entradas('users')) {
    if (!u?._id || !u?.assignedPsychologistId) continue
    run('UPDATE users SET assigned_psychologist_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ?)',
      [u.assignedPsychologistId, u._id, u.assignedPsychologistId])
  }

  const existeUsuario = (id) => !!one('SELECT 1 AS x FROM users WHERE id = ?', [id])
  let huérfanos = 0

  for (const [userId, mensajes] of entradas('conversations')) {
    if (!existeUsuario(userId)) { huérfanos++; continue }
    for (const m of mensajes || []) {
      run('INSERT OR IGNORE INTO messages (id, user_id, role, content, created_at) VALUES (?,?,?,?,?)',
        [m._id ?? randomUUID(), userId, m.role ?? 'user', m.content ?? '', aIso(m.createdAt) ?? ahora()])
    }
  }

  for (const [userId, metas] of entradas('goals')) {
    if (!existeUsuario(userId)) { huérfanos++; continue }
    for (const g of metas || []) {
      run(`INSERT OR IGNORE INTO goals (id, user_id, title, category, completed, completed_at, created_at)
           VALUES (?,?,?,?,?,?,?)`,
        [g._id ?? randomUUID(), userId, g.title ?? '', g.category ?? 'general',
         g.completed ? 1 : 0, aIso(g.completedAt), aIso(g.createdAt) ?? ahora()])
    }
  }

  for (const [userId, perfil] of entradas('riskAlerts')) {
    if (!existeUsuario(userId)) { huérfanos++; continue }
    run(`INSERT OR IGNORE INTO risk_profiles
           (user_id, user_name, user_email, level, score, last_message, trigger_words, last_analysis)
         VALUES (?,?,?,?,?,?,?,?)`,
      [userId, perfil.userName ?? '', perfil.userEmail ?? '',
       ['bajo', 'medio', 'alto'].includes(perfil.level) ? perfil.level : 'bajo',
       Number(perfil.score) || 0, perfil.lastMessage ?? '',
       JSON.stringify(perfil.triggerWords ?? []), aIso(perfil.lastAnalysis)])
    for (const a of perfil.alerts || []) {
      run(`INSERT INTO risk_alerts (id, user_id, level, score, message, trigger_words, created_at)
           VALUES (?,?,?,?,?,?,?)`,
        [randomUUID(), userId, a.level ?? 'bajo', Number(a.score) || 0, a.message ?? '',
         JSON.stringify(a.triggerWords ?? []), aIso(a.timestamp) ?? ahora()])
    }
  }

  for (const [userId, ficha] of entradas('medicalRecords')) {
    if (!existeUsuario(userId)) { huérfanos++; continue }
    const i = ficha.info ?? {}
    run(`INSERT OR IGNORE INTO medical_records
           (user_id, edad, ocupacion, contacto_emergencia, telefono_emergencia,
            condiciones, medicamentos, antecedentes, motivo_consulta,
            validation_status, validated_by, validated_by_name, validation_note,
            validated_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, i.edad ?? null, i.ocupacion ?? null, i.contactoEmergencia ?? null,
       i.telefonoEmergencia ?? null, i.condiciones ?? null, i.medicamentos ?? null,
       i.antecedentes ?? null, i.motivoConsulta ?? null,
       ['pendiente', 'validada', 'rechazada'].includes(ficha.validationStatus) ? ficha.validationStatus : 'pendiente',
       existeUsuario(ficha.validatedBy) ? ficha.validatedBy : null,
       ficha.validatedByName ?? null, ficha.validationNote ?? '',
       aIso(ficha.validatedAt), aIso(ficha.createdAt) ?? ahora(), aIso(ficha.updatedAt)])
  }

  for (const [patientId, notas] of entradas('progressNotes')) {
    if (!existeUsuario(patientId)) { huérfanos++; continue }
    for (const n of notas || []) {
      run(`INSERT OR IGNORE INTO progress_notes (id, patient_id, author_id, author_name, text, created_at)
           VALUES (?,?,?,?,?,?)`,
        [n._id ?? randomUUID(), patientId,
         existeUsuario(n.authorId) ? n.authorId : null,
         n.authorName ?? '', n.text ?? '', aIso(n.createdAt) ?? ahora()])
    }
  }

  for (const [, a] of entradas('appointments')) {
    if (!a?._id || !existeUsuario(a.patientId) || !existeUsuario(a.psychologistId)) { huérfanos++; continue }
    run(`INSERT OR IGNORE INTO appointments
           (id, patient_id, psychologist_id, date, duration_min, modality, status, notes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      [a._id, a.patientId, a.psychologistId, aIso(a.date) ?? ahora(),
       Number(a.durationMin) || 50,
       a.modality === 'presencial' ? 'presencial' : 'online',
       ['programada', 'completada', 'cancelada'].includes(a.status) ? a.status : 'programada',
       a.notes ?? '', aIso(a.createdAt) ?? ahora()])
  }

  for (const [, m] of entradas('contactMessages')) {
    if (!m?._id) continue
    run(`INSERT OR IGNORE INTO contact_messages (id, nombre, correo, telefono, motivo, mensaje, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      [m._id, m.nombre ?? '', m.correo ?? '', m.telefono ?? '', m.motivo ?? '',
       m.mensaje ?? '', aIso(m.createdAt) ?? ahora()])
  }

  if (huérfanos > 0) {
    console.warn(`⚠️ Se omitieron ${huérfanos} registro(s) sin usuario asociado durante la migración.`)
  }
}

// ── Arranque ───────────────────────────────────────────────────
// El candado va antes de cargar: si otro proceso ya tiene el archivo,
// esta instancia trabaja en memoria y no escribe nada.
if (DATA_FILE && !tomarCandado()) {
  persistenceBlocked = true
}

loadFromDisk()

if (DATA_FILE) {
  // Guardado periódico (solo escribe si hubo cambios) y al cerrar.
  // Importante: no se llama a process.exit() en ningún handler —con una
  // base de sql.js abierta, en Windows eso aborta el proceso con un fallo
  // de aserción de libuv. El apagado ordenado lo coordina server.js.
  const intervalo = setInterval(saveToDisk, 3000)
  intervalo.unref?.()
  process.on('exit', () => { saveToDisk(); soltarCandado() })
}

/** Estado de la persistencia, para diagnóstico desde la interfaz. */
export function getStorageStatus() {
  return {
    persistente: !!DATA_FILE,
    cifrado: !!DATA_KEY,
    bloqueado: persistenceBlocked
  }
}

// ── Conversores de fila a objeto ───────────────────────────────
// Las formas deben coincidir con las que ya consumen las rutas.

function aUsuario(f) {
  if (!f) return null
  return {
    _id: f.id,
    name: f.name,
    email: f.email,
    password: f.password,
    role: f.role,
    assignedPsychologistId: f.assigned_psychologist_id,
    tokenVersion: f.token_version,
    createdAt: f.created_at
  }
}

function aUsuarioPublico(f) {
  return {
    _id: f.id,
    name: f.name,
    email: f.email,
    role: f.role,
    assignedPsychologistId: f.assigned_psychologist_id,
    createdAt: f.created_at
  }
}

function aMeta(f) {
  if (!f) return null
  return {
    _id: f.id,
    title: f.title,
    category: f.category,
    completed: !!f.completed,
    completedAt: f.completed_at,
    createdAt: f.created_at
  }
}

// El guard de nulo no es decorativo: `getAppointmentById` recibe un id que
// viene de la URL, así que con una cita inexistente esta función se
// encontraba un `null` y lanzaba un TypeError. Las rutas de editar y borrar
// comprueban `if (!appt) return 404`, pero nunca llegaban a esa línea: el
// error salía antes como un 500 sin explicación.
function aCita(f) {
  if (!f) return null
  return {
    _id: f.id,
    patientId: f.patient_id,
    psychologistId: f.psychologist_id,
    date: f.date,
    durationMin: f.duration_min,
    modality: f.modality,
    status: f.status,
    notes: f.notes,
    createdAt: f.created_at
  }
}

function aPerfilRiesgo(f) {
  if (!f) return null
  return {
    userId: f.user_id,
    userName: f.user_name,
    userEmail: f.user_email,
    level: f.level,
    score: f.score,
    lastMessage: f.last_message,
    triggerWords: JSON.parse(f.trigger_words || '[]'),
    lastAnalysis: f.last_analysis,
    levelSince: f.level_since,
    alerts: alertasDe(f.user_id)
  }
}

function alertasDe(userId) {
  return all(
    'SELECT * FROM risk_alerts WHERE user_id = ? ORDER BY created_at ASC, rowid ASC',
    [userId]
  ).map(a => ({
    level: a.level,
    score: a.score,
    message: a.message,
    triggerWords: JSON.parse(a.trigger_words || '[]'),
    timestamp: a.created_at
  }))
}

// La ficha solo expone los campos que se llegaron a registrar: la interfaz
// recorre las claves presentes y mostrar las vacías cambiaría lo que ve el
// profesional.
const CAMPOS_FICHA = {
  edad: 'edad',
  ocupacion: 'ocupacion',
  contactoEmergencia: 'contacto_emergencia',
  telefonoEmergencia: 'telefono_emergencia',
  condiciones: 'condiciones',
  medicamentos: 'medicamentos',
  antecedentes: 'antecedentes',
  motivoConsulta: 'motivo_consulta'
}

function aFichaMedica(f) {
  if (!f) return null
  const info = {}
  for (const [clave, columna] of Object.entries(CAMPOS_FICHA)) {
    if (f[columna] !== null && f[columna] !== undefined) info[clave] = f[columna]
  }
  return {
    userId: f.user_id,
    info,
    validationStatus: f.validation_status,
    validatedBy: f.validated_by,
    validatedByName: f.validated_by_name,
    validationNote: f.validation_note,
    validatedAt: f.validated_at,
    createdAt: f.created_at,
    updatedAt: f.updated_at
  }
}

// ── Usuarios ───────────────────────────────────────────────────
export function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null
  return aUsuario(one('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]))
}

export function findUserById(id) {
  if (!id) return null
  return aUsuario(one('SELECT * FROM users WHERE id = ?', [id]))
}

export function createUser({ name, email, password, role = 'user' }) {
  const id = randomUUID()
  run(
    `INSERT INTO users (id, name, email, password, role, assigned_psychologist_id, token_version, created_at)
     VALUES (?,?,?,?,?,NULL,0,?)`,
    [id, name.trim(), email.toLowerCase(), password,
     ROLES.includes(role) ? role : 'user', ahora()]
  )
  return findUserById(id)
}

export function setUserRole(id, role) {
  if (!ROLES.includes(role)) return null
  const user = findUserById(id)
  if (!user) return null
  run('UPDATE users SET role = ? WHERE id = ?', [role, id])
  return findUserById(id)
}

/**
 * Cambia la contraseña. No invalida sesiones por sí sola: quien cambia
 * una contraseña de verdad debe llamar además a bumpTokenVersion().
 * (El arranque de la app de escritorio la re-aplica en cada inicio y no
 * debe cerrar la sesión del administrador.)
 */
export function setUserPassword(id, passwordHash) {
  const user = findUserById(id)
  if (!user) return null
  run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id])
  return findUserById(id)
}

/** Invalida todas las sesiones abiertas de ese usuario. */
export function bumpTokenVersion(id) {
  const user = findUserById(id)
  if (!user) return null
  run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id])
  return findUserById(id)
}

// ── Recuperación de contraseña por correo ───────────────────────
const RESET_TOKEN_VIGENCIA_MIN = 60

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Genera un token de un solo uso para restablecer la contraseña. Borra
 * cualquier token sin usar que ese usuario tuviera antes, para que no
 * queden varios enlaces "válidos" a la vez — solo el último pedido sirve.
 * Devuelve el token EN CLARO: es la única vez que existe fuera de la base
 * (para meterlo en el correo); acá solo se guarda su hash.
 */
export function createPasswordReset(userId) {
  run('DELETE FROM password_resets WHERE user_id = ? AND used = 0', [userId])
  const token = randomBytes(32).toString('hex')
  const vence = new Date(Date.now() + RESET_TOKEN_VIGENCIA_MIN * 60000).toISOString()
  run(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
     VALUES (?,?,?,?,0,?)`,
    [randomUUID(), userId, hashToken(token), vence, ahora()]
  )
  return token
}

/**
 * Canjea un token: si es válido (existe, sin usar, sin vencer), lo marca
 * usado y devuelve el userId asociado — nunca se puede reintentar con el
 * mismo token, valga o no. Si no es válido, null, sin decir por qué.
 */
export function consumePasswordReset(token) {
  const fila = one('SELECT * FROM password_resets WHERE token_hash = ?', [hashToken(token)])
  if (!fila || fila.used || fila.expires_at < ahora()) return null
  run('UPDATE password_resets SET used = 1 WHERE id = ?', [fila.id])
  return fila.user_id
}

export function assignPatient(patientId, staffId) {
  const patient = findUserById(patientId)
  if (!patient || patient.role !== 'user') return null
  if (staffId !== null && staffId !== undefined) {
    const staff = findUserById(staffId)
    if (!staff || !STAFF_ROLES.includes(staff.role)) return null
  }
  run('UPDATE users SET assigned_psychologist_id = ? WHERE id = ?', [staffId ?? null, patientId])
  return findUserById(patientId)
}

export function getAllUsers() {
  return all('SELECT * FROM users ORDER BY created_at ASC, rowid ASC').map(aUsuarioPublico)
}

export function getStaffMembers() {
  return all(
    `SELECT * FROM users WHERE role IN ('monitor','psychologist','admin')
     ORDER BY created_at ASC, rowid ASC`
  ).map(aUsuarioPublico)
}

export function getPatients() {
  return all(
    `SELECT * FROM users WHERE role = 'user' ORDER BY created_at ASC, rowid ASC`
  ).map(aUsuarioPublico)
}

export function getPatientsOf(staffId) {
  return all(
    `SELECT * FROM users WHERE role = 'user' AND assigned_psychologist_id = ?
     ORDER BY created_at ASC, rowid ASC`,
    [staffId]
  ).map(aUsuarioPublico)
}

// ── Conversaciones ─────────────────────────────────────────────
function aMensaje(m) {
  return {
    _id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at
  }
}

/**
 * Historial de una persona, del más antiguo al más reciente.
 *
 * Con `limit`, el recorte lo hace el motor. Antes todas las llamadas
 * pedían el historial entero —hasta 500 mensajes— y descartaban en JS
 * todos menos los últimos 20, 30, 100 o 200. Eso ocurría en cada mensaje
 * del chat, que es la ruta más transitada de la aplicación, y el coste
 * crecía a medida que la persona conversaba más.
 *
 * Se consulta en orden descendente para que LIMIT se quede con los
 * recientes, y se invierte al final para devolver el orden de siempre.
 */
export function getHistory(userId, limit) {
  if (limit === undefined) {
    return all(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC, rowid ASC',
      [userId]
    ).map(aMensaje)
  }
  return all(
    'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
    [userId, limit]
  ).map(aMensaje).reverse()
}

export function addMessage(userId, role, content) {
  run('INSERT INTO messages (id, user_id, role, content, created_at) VALUES (?,?,?,?,?)',
    [randomUUID(), userId, role, content, ahora()])
  // El staff necesita historial para el seguimiento, pero no ilimitado
  run(
    `DELETE FROM messages WHERE user_id = ? AND id NOT IN (
       SELECT id FROM messages WHERE user_id = ?
       ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_MESSAGES_PER_USER}
     )`,
    [userId, userId]
  )
}

export function clearHistory(userId) {
  run('DELETE FROM messages WHERE user_id = ?', [userId])
}

// ── Objetivos ──────────────────────────────────────────────────
export function getGoals(userId) {
  return all(
    'SELECT * FROM goals WHERE user_id = ? ORDER BY created_at ASC, rowid ASC',
    [userId]
  ).map(aMeta)
}

export function createGoal(userId, { title, category }) {
  const id = randomUUID()
  run(
    `INSERT INTO goals (id, user_id, title, category, completed, completed_at, created_at)
     VALUES (?,?,?,?,0,NULL,?)`,
    [id, userId, title.trim(), category || 'general', ahora()]
  )
  return aMeta(one('SELECT * FROM goals WHERE id = ?', [id]))
}

export function toggleGoal(userId, goalId) {
  const fila = one('SELECT * FROM goals WHERE id = ? AND user_id = ?', [goalId, userId])
  if (!fila) return null
  const completada = !fila.completed
  run('UPDATE goals SET completed = ?, completed_at = ? WHERE id = ?',
    [completada ? 1 : 0, completada ? ahora() : null, goalId])
  return aMeta(one('SELECT * FROM goals WHERE id = ?', [goalId]))
}

export function deleteGoal(userId, goalId) {
  const fila = one('SELECT id FROM goals WHERE id = ? AND user_id = ?', [goalId, userId])
  if (!fila) return false
  run('DELETE FROM goals WHERE id = ? AND user_id = ?', [goalId, userId])
  return true
}

// ── Alertas de Riesgo ──────────────────────────────────────────
export function updateRiskLevel(userId, { userName, userEmail, level, score, lastMessage, triggerWords }) {
  const actual = one('SELECT * FROM risk_profiles WHERE user_id = ?', [userId])
  const palabras = JSON.stringify(triggerWords ?? [])

  // El nivel solo escala dentro de esta función: nunca baja al llegar un
  // mensaje nuevo. El descenso vive aparte, en checkRiskDecay y en la
  // corrección manual (setRiskLevelManual).
  const ORDEN = { bajo: 0, medio: 1, alto: 2 }
  const nivelPrevio = actual?.level ?? 'bajo'
  const nivelFinal = ORDEN[level] >= ORDEN[nivelPrevio] ? level : nivelPrevio
  const puntajeFinal = Math.max(actual?.score ?? 0, score)

  // level_since marca desde cuándo está vigente el nivel actual: lo usa
  // checkRiskDecay para medir el tiempo y las señales positivas acumuladas
  // desde la última escalada. Si no hubo escalada, se conserva el valor
  // existente en vez de reiniciarlo en cada mensaje.
  const escalo = !actual || nivelFinal !== nivelPrevio
  const levelSinceFinal = escalo ? ahora() : actual.level_since

  if (actual) {
    run(
      `UPDATE risk_profiles
         SET user_name = ?, user_email = ?, level = ?, score = ?,
             last_message = ?, trigger_words = ?, last_analysis = ?, level_since = ?
       WHERE user_id = ?`,
      [userName, userEmail, nivelFinal, puntajeFinal, lastMessage, palabras, ahora(), levelSinceFinal, userId]
    )
  } else {
    run(
      `INSERT INTO risk_profiles
         (user_id, user_name, user_email, level, score, last_message, trigger_words, last_analysis, level_since)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [userId, userName, userEmail, nivelFinal, puntajeFinal, lastMessage, palabras, ahora(), levelSinceFinal]
    )
  }

  let notificarAlto = false
  if (score > 0) {
    if (level === 'alto') {
      const corte = new Date(Date.now() - ALERTA_RIESGO_COOLDOWN_MIN * 60000).toISOString()
      const reciente = one(
        `SELECT id FROM risk_alerts WHERE user_id = ? AND level = 'alto' AND created_at >= ?`,
        [userId, corte]
      )
      notificarAlto = !reciente
    }

    run(
      `INSERT INTO risk_alerts (id, user_id, level, score, message, trigger_words, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(), userId, level, score, lastMessage, palabras, ahora()]
    )
    run(
      `DELETE FROM risk_alerts WHERE user_id = ? AND id NOT IN (
         SELECT id FROM risk_alerts WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_ALERTS_PER_USER}
       )`,
      [userId, userId]
    )
  }

  return { profile: getRiskProfile(userId), notificarAlto }
}

/**
 * Corrección manual del nivel de riesgo (admin o el profesional asignado a
 * ese paciente — la ruta valida quién puede llamar a esto, y también audita
 * el cambio con auditar(), igual que el resto de acciones clínicas). A
 * diferencia de updateRiskLevel, esta SÍ puede bajar el nivel: es la única
 * forma de corregir un falso positivo antes de que se cumplan las
 * condiciones de descenso automático de checkRiskDecay.
 */
export function setRiskLevelManual(userId, level) {
  const actual = one('SELECT * FROM risk_profiles WHERE user_id = ?', [userId])
  const ahoraIso = ahora()

  if (actual) {
    run(
      `UPDATE risk_profiles SET level = ?, score = 0, level_since = ? WHERE user_id = ?`,
      [level, ahoraIso, userId]
    )
  } else {
    const user = findUserById(userId)
    if (!user) return null
    run(
      `INSERT INTO risk_profiles
         (user_id, user_name, user_email, level, score, last_message, trigger_words, last_analysis, level_since)
       VALUES (?,?,?,?,0,'','[]',?,?)`,
      [userId, user.name, user.email, level, ahoraIso, ahoraIso]
    )
  }

  return getRiskProfile(userId)
}

// Umbrales del descenso automático: propuesta inicial, ajustable. Sin
// alertas nuevas durante este tiempo y con suficientes señales positivas
// (metas cumplidas o citas asistidas) desde la última escalada, el nivel
// baja un escalón — nunca salta directo de alto a bajo.
const RIESGO_DECAY_DIAS_SIN_ALERTA = 21
const RIESGO_DECAY_MIN_SENALES = 2

/**
 * Revisa si un paciente reúne señales suficientes para que su nivel de
 * riesgo baje un escalón. Se llama de forma oportunista —no hay un cron en
 * esta app— desde los puntos donde esas señales ocurren: un mensaje nuevo
 * en el chat, completar una meta, o marcar una cita como asistida.
 */
export function checkRiskDecay(userId) {
  const actual = one('SELECT * FROM risk_profiles WHERE user_id = ?', [userId])
  if (!actual || actual.level === 'bajo' || !actual.level_since) return null

  const diasTranscurridos = (Date.now() - new Date(actual.level_since).getTime()) / 86400000
  if (diasTranscurridos < RIESGO_DECAY_DIAS_SIN_ALERTA) return null

  const alertaReciente = one(
    'SELECT id FROM risk_alerts WHERE user_id = ? AND created_at > ?',
    [userId, actual.level_since]
  )
  if (alertaReciente) return null

  const metas = one(
    'SELECT COUNT(*) AS n FROM goals WHERE user_id = ? AND completed = 1 AND completed_at > ?',
    [userId, actual.level_since]
  )?.n ?? 0
  const citas = one(
    `SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ? AND status = 'completada' AND date > ?`,
    [userId, actual.level_since]
  )?.n ?? 0
  if (metas + citas < RIESGO_DECAY_MIN_SENALES) return null

  const ORDEN = ['bajo', 'medio', 'alto']
  const nuevoNivel = ORDEN[Math.max(0, ORDEN.indexOf(actual.level) - 1)]
  const ahoraIso = ahora()
  run('UPDATE risk_profiles SET level = ?, score = 0, level_since = ? WHERE user_id = ?', [nuevoNivel, ahoraIso, userId])

  recordAudit({
    actorId: null, actorName: 'Sistema (automático)', actorRole: 'sistema',
    action: 'riesgo.corregir', targetId: userId, targetName: actual.user_name,
    details: `Nivel bajó automáticamente de ${actual.level} a ${nuevoNivel} ` +
      `(sin alertas nuevas en ${RIESGO_DECAY_DIAS_SIN_ALERTA} días, ${metas + citas} señales positivas)`
  })

  return getRiskProfile(userId)
}

export function getRiskProfile(userId) {
  return aPerfilRiesgo(one('SELECT * FROM risk_profiles WHERE user_id = ?', [userId]))
}

export function getAllRiskProfiles() {
  return all('SELECT * FROM risk_profiles').map(aPerfilRiesgo)
}

// ── Línea de tiempo emocional (vista propia del paciente) ──────
// risk_alerts solo conserva las últimas MAX_ALERTS_PER_USER entradas
// por persona: alguien con mensajes de riesgo muy frecuentes puede ver
// huecos en el extremo más antiguo de un rango de 6 meses o un año.
// Es el mismo tope que ya usa el panel de alertas del equipo.
const NIVEL_ORDEN = { bajo: 0, medio: 1, alto: 2 }

/** Agrupa mis propias alertas por día, para dibujar un mapa de calor. */
export function getRiskHeatmap(userId, days) {
  const desde = new Date(Date.now() - days * 86400000).toISOString()
  const filas = all(
    `SELECT substr(created_at, 1, 10) AS dia, level, score
       FROM risk_alerts WHERE user_id = ? AND created_at >= ?
       ORDER BY created_at ASC`,
    [userId, desde]
  )

  const porDia = new Map()
  for (const f of filas) {
    const dia = porDia.get(f.dia) || { date: f.dia, level: f.level, maxScore: 0, count: 0 }
    if (NIVEL_ORDEN[f.level] > NIVEL_ORDEN[dia.level]) dia.level = f.level
    dia.maxScore = Math.max(dia.maxScore, f.score)
    dia.count += 1
    porDia.set(f.dia, dia)
  }

  const cells = [...porDia.values()]
  const summary = {
    totalEvents: filas.length,
    daysWithEvents: cells.length,
    bajo:  cells.filter(c => c.level === 'bajo').length,
    medio: cells.filter(c => c.level === 'medio').length,
    alto:  cells.filter(c => c.level === 'alto').length,
    lastDate: cells.length ? cells[cells.length - 1].date : null
  }

  return { cells, summary }
}

/** Mis alertas de un día concreto (YYYY-MM-DD), para el detalle al hacer clic. */
export function getRiskEventsForDay(userId, date) {
  return all(
    `SELECT id, level, score, trigger_words, created_at
       FROM risk_alerts WHERE user_id = ? AND substr(created_at, 1, 10) = ?
       ORDER BY created_at ASC`,
    [userId, date]
  ).map(f => ({
    id: f.id,
    level: f.level,
    score: f.score,
    triggerWords: JSON.parse(f.trigger_words || '[]'),
    createdAt: f.created_at
  }))
}

// ── Línea de tiempo agregada (vista del equipo) ─────────────────
// A diferencia de getRiskHeatmap (una persona, muchos días), esto agrega
// TODOS los pacientes por día: para que el equipo vea el patrón de la
// semana de un vistazo, en vez de tener que abrir paciente por paciente.

const DIAS_SEMANA_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

// En UTC, no en hora local: created_at se guarda siempre en UTC (ahora()),
// así que agrupar los días en hora local desalinearía las celdas del mapa
// de calor con los datos reales apenas la hora local cruce la medianoche
// UTC (pasa todas las tardes/noches en Colombia, UTC-5).
function inicioDeSemanaBackend(fecha) {
  const d = new Date(fecha)
  const dia = (d.getUTCDay() + 6) % 7 // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Arma la oración-resumen a partir de los datos ya calculados.
 * Simplificación conocida: el rango horario de los picos se calcula con
 * min/max directo sobre la hora del día, así que un grupo de alertas entre
 * las 23:00 y la 1:00 se lee como "entre las 0:00 y las 23:00" en vez de
 * cruzar la medianoche. Es un caso borde razonable de dejar así por ahora.
 */
function construirResumenSemanal({ diasDeAlerta, diasTranquilos, nombresPico, horaMin, horaMax }) {
  if (diasDeAlerta === 0) {
    return `Esta semana no hubo días de alerta — ${diasTranquilos} ${diasTranquilos === 1 ? 'día tranquilo' : 'días tranquilos'}.`
  }

  const partes = [
    `Esta semana hubo ${diasDeAlerta} ${diasDeAlerta === 1 ? 'día de alerta' : 'días de alerta'}` +
    (diasTranquilos > 0 ? ` y ${diasTranquilos} ${diasTranquilos === 1 ? 'día tranquilo' : 'días tranquilos'}.` : '.')
  ]

  if (horaMin !== null) {
    partes.push(horaMin === horaMax
      ? `Los picos fueron alrededor de las ${horaMin}:00.`
      : `Los picos fueron entre las ${horaMin}:00 y las ${horaMax}:00.`)
  }

  if (nombresPico.length === 1) {
    partes.push(`Vinieron de la misma persona: ${nombresPico[0]}.`)
  } else if (nombresPico.length > 1) {
    partes.push(`Vinieron de ${nombresPico.length} personas distintas.`)
  }

  return partes.join(' ')
}

/**
 * Resumen semanal + mapa de calor de 6 semanas, agregados entre todos los
 * pacientes. Se calcula bajo demanda (no vive en un cron ni se cachea): el
 * volumen de datos de este proyecto no lo justifica todavía.
 */
export function getRiskWeeklyOverview() {
  const inicioSemana = inicioDeSemanaBackend(new Date())
  const ahora = new Date()

  const alertasSemana = all(
    `SELECT ra.level, ra.user_id, ra.created_at, u.name AS user_name
       FROM risk_alerts ra JOIN users u ON u.id = ra.user_id
      WHERE ra.created_at >= ?
      ORDER BY ra.created_at ASC`,
    [inicioSemana.toISOString()]
  )

  const diasTranscurridos = Math.min(7, Math.floor((ahora - inicioSemana) / 86400000) + 1)
  const picosAlto = alertasSemana.filter(a => a.level === 'alto')
  const diasDeAlerta = new Set(picosAlto.map(a => a.created_at.slice(0, 10))).size
  const diasTranquilos = Math.max(0, diasTranscurridos - diasDeAlerta)

  const horasPico = picosAlto.map(a => new Date(a.created_at).getHours())
  const horaMin = horasPico.length ? Math.min(...horasPico) : null
  const horaMax = horasPico.length ? Math.max(...horasPico) : null
  const nombresPico = [...new Set(picosAlto.map(a => a.user_name))]

  const mensajesSemana = all(
    `SELECT strftime('%H', created_at) AS hora FROM messages
      WHERE role = 'user' AND created_at >= ?`,
    [inicioSemana.toISOString()]
  )
  const porHora = new Map()
  for (const m of mensajesSemana) porHora.set(m.hora, (porHora.get(m.hora) || 0) + 1)
  let horaMasActiva = null, maxConteo = 0
  for (const [hora, n] of porHora) {
    if (n > maxConteo) { maxConteo = n; horaMasActiva = hora }
  }

  const resumen = construirResumenSemanal({ diasDeAlerta, diasTranquilos, nombresPico, horaMin, horaMax })

  // Mapa de 6 semanas: el nivel más alto alcanzado ese día entre todos los pacientes.
  const hace6Semanas = new Date(inicioSemana)
  hace6Semanas.setUTCDate(hace6Semanas.getUTCDate() - 35)
  const alertasHistoricas = all(
    `SELECT substr(created_at, 1, 10) AS dia, level FROM risk_alerts WHERE created_at >= ?`,
    [hace6Semanas.toISOString()]
  )
  const nivelPorDia = new Map()
  for (const f of alertasHistoricas) {
    const actual = nivelPorDia.get(f.dia)
    if (!actual || NIVEL_ORDEN[f.level] > NIVEL_ORDEN[actual]) nivelPorDia.set(f.dia, f.level)
  }

  const semanas = []
  for (let s = 5; s >= 0; s--) {
    const inicio = new Date(inicioSemana)
    inicio.setUTCDate(inicio.getUTCDate() - s * 7)
    const celdas = []
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio)
      dia.setUTCDate(dia.getUTCDate() + d)
      const clave = dia.toISOString().slice(0, 10)
      celdas.push({ fecha: clave, nivel: nivelPorDia.get(clave) || null })
    }
    semanas.push({ inicio: inicio.toISOString().slice(0, 10), celdas })
  }

  return {
    resumen,
    stats: {
      conversaciones: mensajesSemana.length,
      alertasAlto: picosAlto.length,
      horaMasActiva: horaMasActiva !== null ? `${horaMasActiva}:00` : null,
      personasEnSeguimiento: getPatients().length
    },
    diasSemana: DIAS_SEMANA_CORTOS,
    semanas
  }
}

// ── Resúmenes para listados ────────────────────────────────────
// Las pantallas de lista (pacientes, reportes, panel de alertas) solo
// necesitan conteos, pero pedían el objeto completo de cada paciente: una
// consulta por persona, y en el caso de las alertas dos, para acabar
// usando `.length`. Con cien pacientes eso eran cientos de consultas
// seguidas en el hilo que atiende la petición —sql.js corre dentro del
// proceso—, y mientras tanto ningún otro usuario era atendido.
//
// Estas funciones resuelven cada listado con UNA consulta agrupada.

/** Nº de alertas por paciente. */
export function getAlertCounts() {
  const conteos = new Map()
  for (const f of all('SELECT user_id, COUNT(*) AS n FROM risk_alerts GROUP BY user_id')) {
    conteos.set(f.user_id, f.n)
  }
  return conteos
}

/** Perfiles de riesgo con el conteo de alertas, sin cargar las alertas. */
export function getRiskSummaries() {
  const conteos = getAlertCounts()
  const resumenes = new Map()
  for (const f of all('SELECT * FROM risk_profiles')) {
    resumenes.set(f.user_id, {
      level: f.level,
      score: f.score,
      lastMessage: f.last_message,
      triggerWords: JSON.parse(f.trigger_words || '[]'),
      lastAnalysis: f.last_analysis,
      alertCount: conteos.get(f.user_id) || 0
    })
  }
  return resumenes
}

/** Metas totales y completadas por paciente. */
export function getGoalStats() {
  const stats = new Map()
  for (const f of all('SELECT user_id, COUNT(*) AS total, SUM(completed) AS hechas FROM goals GROUP BY user_id')) {
    stats.set(f.user_id, { total: f.total, completed: f.hechas || 0 })
  }
  return stats
}

/** Nº de notas de progreso por paciente. */
export function getNoteCounts() {
  const conteos = new Map()
  for (const f of all('SELECT patient_id, COUNT(*) AS n FROM progress_notes GROUP BY patient_id')) {
    conteos.set(f.patient_id, f.n)
  }
  return conteos
}

/** Estado de validación de la ficha médica por paciente. */
export function getMedicalStatuses() {
  const estados = new Map()
  for (const f of all('SELECT user_id, validation_status FROM medical_records')) {
    estados.set(f.user_id, f.validation_status)
  }
  return estados
}

// ── Fichas médicas ─────────────────────────────────────────────
// El paciente registra su información; el staff la valida.
export function getMedicalRecord(userId) {
  return aFichaMedica(one('SELECT * FROM medical_records WHERE user_id = ?', [userId]))
}

export function upsertMedicalRecord(userId, info) {
  const existe = one('SELECT user_id FROM medical_records WHERE user_id = ?', [userId])
  if (!existe) {
    run('INSERT INTO medical_records (user_id, created_at) VALUES (?,?)', [userId, ahora()])
  }

  // Actualización parcial: solo se tocan los campos enviados, igual que
  // el mezclado de objetos que hacía el almacén anterior.
  const asignaciones = []
  const valores = []
  for (const [clave, columna] of Object.entries(CAMPOS_FICHA)) {
    if (info?.[clave] !== undefined) {
      asignaciones.push(`${columna} = ?`)
      valores.push(info[clave])
    }
  }

  // Si el paciente edita su ficha, vuelve a quedar pendiente de validación
  asignaciones.push('updated_at = ?', "validation_status = 'pendiente'")
  valores.push(ahora(), userId)
  run(`UPDATE medical_records SET ${asignaciones.join(', ')} WHERE user_id = ?`, valores)

  return getMedicalRecord(userId)
}

export function validateMedicalRecord(userId, { staffId, staffName, status, note }) {
  if (!['validada', 'rechazada', 'pendiente'].includes(status)) return null
  const existe = one('SELECT user_id FROM medical_records WHERE user_id = ?', [userId])
  if (!existe) return null
  run(
    `UPDATE medical_records
       SET validation_status = ?, validated_by = ?, validated_by_name = ?,
           validation_note = ?, validated_at = ?
     WHERE user_id = ?`,
    [status, staffId ?? null, staffName ?? null, note || '', ahora(), userId]
  )
  return getMedicalRecord(userId)
}

// ── Notas de progreso (staff sobre pacientes) ──────────────────
export function getProgressNotes(patientId) {
  return all(
    'SELECT * FROM progress_notes WHERE patient_id = ? ORDER BY created_at ASC, rowid ASC',
    [patientId]
  ).map(n => ({
    _id: n.id,
    authorId: n.author_id,
    authorName: n.author_name,
    text: n.text,
    createdAt: n.created_at
  }))
}

export function addProgressNote(patientId, { authorId, authorName, text }) {
  const id = randomUUID()
  run(
    `INSERT INTO progress_notes (id, patient_id, author_id, author_name, text, created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, patientId, authorId ?? null, authorName, text.trim(), ahora()]
  )
  const f = one('SELECT * FROM progress_notes WHERE id = ?', [id])
  return {
    _id: f.id,
    authorId: f.author_id,
    authorName: f.author_name,
    text: f.text,
    createdAt: f.created_at
  }
}

// ── Citas / Calendario ─────────────────────────────────────────
export function createAppointment({ patientId, psychologistId, date, durationMin, modality, notes }) {
  const id = randomUUID()
  run(
    `INSERT INTO appointments
       (id, patient_id, psychologist_id, date, duration_min, modality, status, notes, created_at)
     VALUES (?,?,?,?,?,?,'programada',?,?)`,
    [id, patientId, psychologistId, new Date(date).toISOString(),
     durationMin || 50, modality === 'presencial' ? 'presencial' : 'online',
     notes || '', ahora()]
  )
  return getAppointmentById(id)
}

export function getAppointmentById(id) {
  return aCita(one('SELECT * FROM appointments WHERE id = ?', [id]))
}

export function getAllAppointments() {
  return all('SELECT * FROM appointments ORDER BY date ASC').map(aCita)
}

export function getAppointmentsForStaff(staffId) {
  return all('SELECT * FROM appointments WHERE psychologist_id = ? ORDER BY date ASC', [staffId]).map(aCita)
}

export function getAppointmentsForPatient(patientId) {
  return all('SELECT * FROM appointments WHERE patient_id = ? ORDER BY date ASC', [patientId]).map(aCita)
}

export function updateAppointment(id, changes) {
  const actual = one('SELECT id FROM appointments WHERE id = ?', [id])
  if (!actual) return null

  const asignaciones = []
  const valores = []
  if (changes.date !== undefined) {
    // La ruta ya rechaza las fechas inválidas con un 400. Esta comprobación
    // es la red de seguridad: `toISOString()` sobre una fecha inválida lanza
    // un RangeError que tumbaría la petición con un 500 sin explicación.
    const cuando = new Date(changes.date)
    if (!isNaN(cuando.getTime())) {
      asignaciones.push('date = ?'); valores.push(cuando.toISOString())
    }
  }
  if (changes.durationMin !== undefined) {
    asignaciones.push('duration_min = ?'); valores.push(changes.durationMin)
  }
  if (changes.modality !== undefined && ['online', 'presencial'].includes(changes.modality)) {
    asignaciones.push('modality = ?'); valores.push(changes.modality)
  }
  if (changes.status !== undefined && ['programada', 'completada', 'cancelada'].includes(changes.status)) {
    asignaciones.push('status = ?'); valores.push(changes.status)
  }
  if (changes.notes !== undefined) {
    asignaciones.push('notes = ?'); valores.push(changes.notes)
  }

  if (asignaciones.length > 0) {
    valores.push(id)
    run(`UPDATE appointments SET ${asignaciones.join(', ')} WHERE id = ?`, valores)
  }
  return getAppointmentById(id)
}

export function deleteAppointment(id) {
  const existe = one('SELECT id FROM appointments WHERE id = ?', [id])
  if (!existe) return false
  run('DELETE FROM appointments WHERE id = ?', [id])
  return true
}

// ── Mensajes del formulario de contacto (landing) ──────────────
export function createContactMessage({ nombre, correo, telefono, motivo, mensaje }) {
  const id = randomUUID()
  run(
    `INSERT INTO contact_messages (id, nombre, correo, telefono, motivo, mensaje, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id,
     String(nombre).trim().slice(0, 120),
     String(correo).trim().toLowerCase().slice(0, 160),
     telefono ? String(telefono).trim().slice(0, 30) : '',
     motivo ? String(motivo).trim().slice(0, 80) : '',
     String(mensaje).trim().slice(0, 2000),
     ahora()]
  )
  run(
    `DELETE FROM contact_messages WHERE id NOT IN (
       SELECT id FROM contact_messages ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_CONTACT_MESSAGES}
     )`
  )
  const f = one('SELECT * FROM contact_messages WHERE id = ?', [id])
  return f ? {
    _id: f.id, nombre: f.nombre, correo: f.correo, telefono: f.telefono,
    motivo: f.motivo, mensaje: f.mensaje, createdAt: f.created_at
  } : null
}

export function getContactMessages() {
  return all('SELECT * FROM contact_messages ORDER BY created_at DESC, rowid DESC').map(f => ({
    _id: f.id,
    nombre: f.nombre,
    correo: f.correo,
    telefono: f.telefono,
    motivo: f.motivo,
    mensaje: f.mensaje,
    createdAt: f.created_at
  }))
}

// ── Registro de auditoría ──────────────────────────────────────
// Deja constancia de quién consultó o modificó información clínica.
// Solo se añade; no existe función para editar ni borrar entradas.

/** Acciones que se registran, con su descripción para la interfaz. */
export const AUDIT_ACTIONS = {
  'expediente.ver':        'Consultó un expediente',
  'ficha.validar':         'Validó o rechazó una ficha médica',
  'nota.crear':            'Añadió una nota de progreso',
  'cita.crear':            'Agendó una cita',
  'cita.editar':           'Modificó una cita',
  'cita.eliminar':         'Eliminó una cita',
  'paciente.asignar':      'Cambió la asignación de un paciente',
  'rol.cambiar':           'Cambió el rol de una cuenta',
  'contrasena.restablecer':'Restableció la contraseña de otra persona',
  'staff.crear':           'Creó una cuenta del equipo',
  'alertas.ver-detalle':   'Abrió el detalle de un usuario en el panel de alertas',
  'riesgo.corregir':       'Corrigió el nivel de riesgo de un paciente',
}

export function recordAudit({ actorId, actorName, actorRole, action, targetId, targetName, details }) {
  run(
    `INSERT INTO audit_log
       (id, created_at, actor_id, actor_name, actor_role, action, target_id, target_name, details)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [randomUUID(), ahora(), actorId ?? null, actorName ?? '(desconocido)', actorRole ?? '',
     action, targetId ?? null, targetName ?? null, details ?? '']
  )

  const total = one('SELECT COUNT(*) AS n FROM audit_log')?.n ?? 0
  if (total > MAX_AUDIT_ENTRIES) {
    run(
      `DELETE FROM audit_log WHERE id NOT IN (
         SELECT id FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_AUDIT_ENTRIES}
       )`
    )
    console.warn(`⚠️ Registro de auditoría recortado a las ${MAX_AUDIT_ENTRIES} entradas más recientes.`)
  }
}

/**
 * Lee el registro, de lo más reciente a lo más antiguo.
 * Admite filtrar por quién actuó, sobre quién, o por tipo de acción.
 */
export function getAuditLog({ actorId, targetId, action, limit = 100, offset = 0 } = {}) {
  const condiciones = []
  const params = []
  if (actorId)  { condiciones.push('actor_id = ?');  params.push(actorId) }
  if (targetId) { condiciones.push('target_id = ?'); params.push(targetId) }
  if (action)   { condiciones.push('action = ?');    params.push(action) }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

  const total = one(`SELECT COUNT(*) AS n FROM audit_log ${where}`, params)?.n ?? 0
  const filas = all(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    [...params, Math.min(Number(limit) || 100, 500), Number(offset) || 0]
  )

  return {
    total,
    entries: filas.map(f => ({
      _id: f.id,
      createdAt: f.created_at,
      actorId: f.actor_id,
      actorName: f.actor_name,
      actorRole: f.actor_role,
      action: f.action,
      actionLabel: AUDIT_ACTIONS[f.action] || f.action,
      targetId: f.target_id,
      targetName: f.target_name,
      details: f.details
    }))
  }
}
