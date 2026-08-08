# Contigo — Aquí Estoy

> "No estás solo. Aquí estoy contigo."

Contigo — Aquí Estoy es un centro de bienestar emocional y salud mental. Combina un
espacio de conversación disponible a toda hora con las herramientas que un equipo
clínico necesita para acompañar a las personas que lo usan: seguimiento de metas,
detección temprana de señales de riesgo, fichas médicas, notas de progreso, agenda
de citas y reportes.

La aplicación funciona de dos maneras: como **programa de escritorio para Windows**,
donde toda la información se queda cifrada en el equipo del consultorio, o como
**servidor web**, cuando varias personas necesitan compartir la misma información.

---

## ⚠️ Aviso importante

**Contigo no es un servicio de urgencias ni reemplaza la atención profesional.**

El asistente conversacional es una herramienta de acompañamiento, no un terapeuta.
El análisis de riesgo se basa en la detección de palabras clave y puede equivocarse
en ambos sentidos: puede pasar por alto una situación grave o marcar como grave algo
que no lo es. Nunca debe usarse como único criterio clínico.

Si estás en una situación de crisis, busca ayuda de inmediato. La aplicación muestra
automáticamente estas líneas cuando detecta riesgo alto:

| País | Línea |
|---|---|
| 🇨🇴 Colombia | 106 (24 h) — Línea de la vida |
| 🇲🇽 México | 800-290-0024 — SAPTEL |
| 🇪🇸 España | 024 — Atención a la conducta suicida |
| 🇦🇷 Argentina | (011) 5275-1135 — Centro de Asistencia al Suicida |
| 🌍 Internacional | befrienders.org |

---

## 👥 Roles y permisos

Existen cuatro roles. El campo interno se llama `role` y sus valores válidos son
`user`, `monitor`, `psychologist` y `admin`.

| Acción | Paciente (`user`) | Monitor | Psicólogo (`psychologist`) | Admin |
|---|:---:|:---:|:---:|:---:|
| Chat de apoyo y sus propias metas | Sí | — | — | — |
| Registrar y editar su propia ficha médica | Sí | — | — | — |
| Ver sus propias citas | Sí | — | — | — |
| Ver lista de pacientes | No | Solo asignados | Solo asignados | **Todos** |
| Ver el expediente completo (chat, metas, alertas, ficha) | No | Solo asignados | Solo asignados | **Todos** |
| Dejar notas de progreso | No | Sí (sus pacientes) | Sí (sus pacientes) | Sí |
| **Validar o rechazar fichas médicas** | No | **No** | Sí | Sí |
| **Crear, editar o borrar citas** | No | **No** | Sí | Sí |
| Ver el calendario | No | Sí (lectura) | Sí | Sí (todas) |
| Ver reportes | No | De sus pacientes | De sus pacientes | Global |
| Crear cuentas de staff y cambiar roles | No | No | No | Sí |
| Asignar pacientes a un miembro del equipo | No | No | No | Sí |
| Restablecer la contraseña de otra persona | No | No | No | Sí |
| Ver la bandeja del formulario de contacto | No | No | No | Sí |
| Cambiar los ajustes de IA de la aplicación | No | No | No | Sí |
| Panel de alertas con mapa de calor (`/admin`) | No | No | No | Sí |

### Las dos reglas que definen todo

1. **El admin ve todo; el resto del equipo ve solo lo suyo.** Un psicólogo o un
   monitor únicamente accede a los pacientes que el administrador le asignó. Si
   intenta abrir el expediente de alguien más, la API responde `403 Este paciente no
   está asignado a ti`. El código de esa comprobación vive en
   `backend/routes/staff.js` (`canAccessPatient`).

2. **El monitor observa, no decide.** Ve pacientes, chats, alertas y calendario, y
   puede dejar notas de seguimiento; pero **no valida fichas médicas ni gestiona
   citas**, porque eso es criterio clínico. La distinción está en
   `backend/middleware/requireRole.js`: `requireStaff` acepta monitor, psicólogo y
   admin; `requireClinician` acepta únicamente psicólogo y admin.

> Compatibilidad: si defines la variable `ADMIN_EMAIL`, el usuario con ese correo se
> trata como administrador aunque su campo `role` diga otra cosa (`effectiveRole`).

---

## 💻 Dos formas de usar Contigo

### Modo A — Aplicación de escritorio (por defecto)

Un instalador de Windows que trae todo adentro: la interfaz, el servidor y los datos.
Al abrirla arranca un servidor local en un puerto libre de `127.0.0.1` y guarda la
información **cifrada en el propio equipo**. No necesita internet salvo que quieras
activar la IA real.

Es la opción indicada para un consultorio o una práctica individual.

### Modo B — Servidor (web)

El backend Express corre en un servidor (por ejemplo Railway, ver `railway.toml`),
sirve el frontend compilado y varias personas entran desde el navegador compartiendo
la misma información.

### Cómo se pasa de un modo al otro

Con el campo `apiUrl` del archivo de configuración de la app de escritorio
(`%APPDATA%\Contigo\config.json`):

```json
{
  "apiUrl": ""
}
```

- **Vacío** → modo A: la app arranca su propio servidor local.
- **Con una URL** (`"https://mi-servidor.example.com"`) → modo B: la app **no** arranca
  el servidor local; se convierte en una ventana que carga ese servidor central.

---

## 🚀 Puesta en marcha para desarrollo

**Requisitos:** Node.js 18 o superior y npm. La clave de IA es opcional: sin ella la
aplicación funciona en modo demo con respuestas predefinidas.

```bash
# Instalar dependencias (una vez por carpeta)
npm install
npm --prefix backend install
npm --prefix frontend install
```

Luego, en dos terminales:

```bash
# Terminal 1 — backend en http://localhost:3000
npm run backend        # equivale a: npm --prefix backend run dev

# Terminal 2 — frontend en http://localhost:5173
npm run frontend       # equivale a: npm --prefix frontend run dev
```

Vite abre el navegador solo y redirige todo lo que empiece por `/api` hacia
`http://localhost:3000` (ver `frontend/vite.config.js`), así que no hace falta
configurar CORS ni URLs absolutas durante el desarrollo.

Para probar la ventana de escritorio sin generar el instalador:

```bash
npm run build:frontend   # el backend sirve frontend/dist, hay que compilarlo antes
npm run desktop          # electron .
```

### Rutas de la interfaz

| Ruta | Quién entra |
|---|---|
| `/` | Pública — landing con el formulario de contacto |
| `/login`, `/register` | Pública |
| `/legal`, `/legal/:seccion` | Pública — textos legales |
| `/chat` | Cualquier sesión iniciada |
| `/goals` | Cualquier sesión iniciada |
| `/staff` | Solo staff: monitor, psicólogo o admin |
| `/admin` | Solo admin — panel de alertas |

El panel `/staff` muestra las pestañas Pacientes, Calendario, Reportes y Mi cuenta a
todo el equipo, y añade Equipo, Mensajes y Ajustes cuando quien entra es admin.

---

## 🔑 Cuentas de prueba

En **desarrollo** (`NODE_ENV` distinto de `production`) el backend crea solo tres
cuentas de staff con contraseñas fijas:

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | `admin@contigo.com` | `admin123` |
| Psicóloga | `psicologa@contigo.com` | `contigo123` |
| Monitor | `monitor@contigo.com` | `contigo123` |

**Estas cuentas existen únicamente en desarrollo.** En producción no se crean, a
menos que se defina explícitamente `CONTIGO_SEED_DEMO=true`. No son cuentas de
paciente: para probar el lado del paciente hay que registrarse desde `/register`.

En la **app instalada** el comportamiento es distinto y más seguro: en la primera
ejecución se genera una **contraseña aleatoria de unos 12 caracteres**, se crea
únicamente la cuenta `admin@contigo.com` con esa contraseña, y la app la muestra en
un diálogo **una sola vez**. Si no la anotaste, queda escrita en
`%APPDATA%\Contigo\config.json` bajo `adminPassword`. Desde esa cuenta se crean los
psicólogos, monitores y demás administradores en la pestaña **Equipo**.

---

## 📦 Generar el instalador de Windows

```bash
npm run dist
```

El comando compila el frontend y ejecuta `electron-builder --win`. El resultado queda
en la carpeta `installers/`:

- `Contigo Setup 1.0.0.exe` — instalador NSIS en español, con opción de elegir la
  carpeta de instalación y accesos directos en escritorio y menú inicio.
- `win-unpacked/` — la aplicación sin empaquetar, útil para depurar.

El icono se toma de `desktop/build/icon.ico`. Tanto `installers/` como `release/`
están ignorados por git.

---

## ⚙️ Configuración

### Variables de entorno del backend

Copia `backend/.env.example` a `backend/.env` y ajusta los valores.

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto del servidor. Por defecto `3000`. En la app de escritorio lo asigna Electron con un puerto libre. |
| `NODE_ENV` | Con cualquier valor distinto de `production` se activa el modo desarrollo (logs `dev` y cuentas de prueba). |
| `JWT_SECRET` | Secreto con el que se firman los tokens de sesión (duración: 7 días). **Obligatorio.** |
| `DEEPSEEK_API_KEY` | Activa la IA real usando DeepSeek (`deepseek-chat`). Tiene prioridad sobre OpenAI. |
| `OPENAI_API_KEY` | Alternativa: activa la IA usando OpenAI (`gpt-4o-mini`). |
| `ADMIN_EMAIL` | El usuario con este correo se considera admin aunque su `role` sea otro. |
| `CONTIGO_SEED_DEMO` | Con `true` fuerza la creación de las cuentas de prueba también en producción. |
| `CONTIGO_DATA_DIR` | Carpeta donde se guardan los datos en un archivo. Si no se define, todo vive en memoria. |
| `CONTIGO_DATA_KEY` | Clave de cifrado en hexadecimal, exactamente 32 bytes (64 caracteres). Sin ella el archivo se guarda en claro. |
| `CONTIGO_ADMIN_PASSWORD` | Contraseña del admin de la instalación de escritorio; el backend la sincroniza en cada arranque. |

Las tres últimas las define automáticamente la app de escritorio; no hace falta
tocarlas a mano.

Si no hay ninguna clave de IA configurada, el chat responde en **modo demo** con un
conjunto de respuestas escritas a mano. El análisis de riesgo, en cambio, se ejecuta
siempre, con o sin IA.

### `config.json` de la app de escritorio

Ubicación: `%APPDATA%\Contigo\config.json`

| Campo | Qué hace |
|---|---|
| `apiUrl` | Vacío = modo local. Con una URL, la app carga ese servidor central en vez de arrancar el suyo. |
| `deepseekApiKey` | Clave de IA opcional. Se puede pegar desde la pestaña **Ajustes** del panel admin y se aplica sin reiniciar. |
| `jwtSecret` | Se genera solo la primera vez (32 bytes aleatorios). |
| `adminPassword` | Contraseña aleatoria del admin de esta instalación. |
| `adminPasswordShown` | Marca interna: indica si ya se mostró el diálogo con la contraseña. |
| `dataKeyEncrypted` | Clave de cifrado de los datos, protegida por el almacén de credenciales del sistema. **No se puede leer a mano.** |

---

## 🔒 Almacenamiento y privacidad

Contigo usa **SQLite** a través de `sql.js` (SQLite compilado a WebAssembly). El almacén
(`backend/store.js`) mantiene la base en memoria y, según cómo se ejecute, la respalda en disco:

| Escenario | Qué pasa con los datos |
|---|---|
| Modo servidor (sin `CONTIGO_DATA_DIR`) | La base vive solo en memoria. **Se pierde al reiniciar el proceso.** |
| App de escritorio | Se guarda en `%APPDATA%\Contigo\contigo-data.json`, **cifrado con AES-256-GCM**. |
| Con `CONTIGO_DATA_DIR` pero sin `CONTIGO_DATA_KEY` | Se guarda como base SQLite, sin cifrar. |

El esquema tiene ocho tablas con claves foráneas e índices: `users`, `messages`, `goals`,
`risk_profiles`, `risk_alerts`, `medical_records`, `progress_notes`, `appointments` y
`contact_messages`. Toda la aplicación accede a los datos por las funciones que exporta
`store.js`; ninguna ruta escribe SQL directamente.

> **Por qué `sql.js` y no `better-sqlite3`:** el proyecto ejecuta el mismo backend bajo dos
> runtimes con ABI distinto —el Node del sistema (pruebas y `npm run dev`) y el Node embebido
> en Electron (app de escritorio)—. Un módulo nativo tendría que recompilarse por separado para
> cada uno; WebAssembly es portable entre ambos sin compilar nada.

Si al abrir la aplicación se encuentra un archivo con el formato anterior (volcado JSON), se
**migra automáticamente** a SQLite conservando los identificadores, y se deja una copia del
original como `contigo-data.json.pre-sql-backup`.

Detalles del cifrado en escritorio:

- La clave se genera aleatoriamente en la primera ejecución y se guarda protegida por
  `safeStorage` de Electron, que en Windows se apoya en **DPAPI**. Eso ata la clave a
  la cuenta de Windows: otra cuenta del mismo equipo, o una copia del archivo llevada
  a otra máquina, **no puede descifrarlo**.
- El archivo cifrado es un sobre JSON con `formato: "contigo-cifrado"`, algoritmo,
  IV, etiqueta de autenticación y datos, todo en base64.
- Si ya existía un archivo en claro y luego aparece una clave, se **migra
  automáticamente** a formato cifrado en el siguiente guardado.
- Si la clave no se puede recuperar (por ejemplo, tras restaurar el equipo), la app
  **se detiene y avisa**: nunca genera una clave nueva, porque eso volvería
  ilegibles los expedientes existentes para siempre.
- Si la lectura del archivo falla, el guardado queda desactivado para no sobrescribir
  lo que haya adentro.
- El guardado es atómico (se escribe un `.tmp` y luego se renombra) y ocurre cada 3
  segundos si hubo cambios, además de al cerrar la aplicación.

Otras medidas: contraseñas con bcrypt (12 rondas), cabeceras de seguridad con Helmet
y una Content-Security-Policy explícita, límite de 10 kB por petición, y sesiones con
versión (`tokenVersion`) que se invalidan al cambiar o restablecer una contraseña.

Límites de peticiones (`backend/server.js`):

| Ruta | Límite |
|---|---|
| `/api/auth/login` y `/api/auth/register` | 20 intentos cada 15 minutos |
| `/api/chat` | 30 mensajes por minuto |
| `/api/contact` | 10 envíos por hora |

---

## 📁 Estructura del proyecto

```
contigo-improved/
├── package.json            # Scripts raíz y configuración de electron-builder
├── railway.toml            # Despliegue en Railway (modo servidor)
│
├── desktop/
│   ├── main.js             # Electron: modo A (servidor embebido) vs modo B (apiUrl)
│   └── build/              # icon.ico e icon.png del instalador
│
├── backend/
│   ├── server.js           # Express: rutas, límites, seed de cuentas, frontend estático
│   ├── store.js            # Almacén en memoria + persistencia cifrada opcional
│   ├── riskAnalyzer.js     # Clasificación de riesgo por palabras clave y mensaje de crisis
│   ├── desktopConfig.js    # Lectura/escritura de config.json desde el backend
│   ├── middleware/
│   │   ├── requireAuth.js     # Sesión válida
│   │   ├── requireRole.js     # requireRole(), requireStaff, requireClinician, effectiveRole
│   │   └── requireAdmin.js    # Atajo de requireRole('admin')
│   ├── routes/
│   │   ├── auth.js         # Registro, login, /me, contraseña, ficha y citas propias
│   │   ├── chat.js         # Chat con IA o demo, análisis de riesgo, historial
│   │   ├── goals.js        # Metas del paciente
│   │   ├── staff.js        # Pacientes, notas, validación, citas, reportes, alertas
│   │   ├── admin.js        # Panel de alertas, equipo, roles, ajustes, contacto
│   │   └── contact.js      # Formulario público de la landing
│   └── tests/              # Pruebas de integración (ver más abajo)
│
└── frontend/
    ├── vite.config.js      # Puerto 5173 y proxy /api → localhost:3000
    ├── index.html
    ├── public/             # Imagen del bot, manifest.json, sw.js
    └── src/
        ├── main.jsx        # Rutas y guards (RequireAuth, RequireStaff, RequireAdmin)
        ├── context/        # AuthContext
        ├── components/     # Header, AuthForm, ChangePasswordCard, toasts, etc.
        └── pages/
            ├── Home.jsx        # Landing con formulario de contacto
            ├── Login.jsx / Register.jsx
            ├── ChatPage.jsx    # Chat de apoyo emocional
            ├── GoalsPage.jsx   # Metas y ficha médica del paciente
            ├── StaffPage.jsx   # Panel del equipo (pestañas por rol)
            ├── AdminPage.jsx   # Panel de alertas con mapa de calor
            └── LegalPage.jsx
```

---

## 🧪 Pruebas

Son pruebas de integración contra un backend **recién iniciado**. Detalle completo en
`backend/tests/README.md`.

```bash
# Terminal 1
npm --prefix backend run dev

# Terminal 2
npm --prefix backend test
```

> **Reinicia el backend antes de cada ejecución completa.** Los datos viven en
> memoria y las pruebas registran usuarios con correos fijos: sin reiniciar, el
> segundo intento falla con `409 (correo ya registrado)`. Además, el limitador
> permite 20 inicios de sesión o registros cada 15 minutos por IP y la suite se
> acerca a ese tope, así que dos ejecuciones seguidas devolverán `429`.

| Archivo | Qué cubre |
|---|---|
| `cifrado.test.mjs` | Cifrado del archivo, migración desde texto plano y protección contra sobrescribir datos ilegibles. **No necesita el servidor.** |
| `roles.test.mjs` | Permisos por rol, asignación de pacientes, validación de fichas, citas y reportes |
| `e2e.test.mjs` | Recorrido completo: registro → chat → análisis de riesgo → metas → ficha → seguimiento del staff |
| `citas-alertas.test.mjs` | Citas visibles para el paciente y resumen de alertas del encabezado |
| `permisos-contacto-ajustes.test.mjs` | Monitor como observador, formulario de contacto y ajustes de IA |
| `contrasenas.test.mjs` | Cambio de contraseña propia, restablecimiento por el admin e invalidación de sesiones |

---

## 🔌 Endpoints principales

Todas las rutas cuelgan de `/api`. Salvo las marcadas como públicas, exigen la
cabecera `Authorization: Bearer <token>`.

### Autenticación y cuenta propia (`/api/auth`)

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST /auth/register` | Público | Crea una cuenta de paciente (mínimo 6 caracteres de contraseña) |
| `POST /auth/login` | Público | Inicia sesión y devuelve el token |
| `GET /auth/me` | Sesión | Datos del usuario actual, incluido su rol |
| `PUT /auth/password` | Sesión | Cambia la propia contraseña y cierra las demás sesiones |
| `GET /auth/medical` | Sesión | Consulta la propia ficha médica |
| `PUT /auth/medical` | Sesión | Crea o actualiza la ficha (vuelve a quedar pendiente de validación) |
| `GET /auth/appointments` | Sesión | Citas propias como paciente |

### Chat y metas

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST /chat` | Sesión | Envía un mensaje; devuelve respuesta, metas sugeridas y nivel de riesgo |
| `GET /chat/history` | Sesión | Últimos 100 mensajes propios |
| `DELETE /chat/history` | Sesión | Borra el historial propio |
| `GET /goals` | Sesión | Lista de metas |
| `POST /goals` | Sesión | Crea una meta (categorías: general, bienestar, sueño, ejercicio, mente, social) |
| `PATCH /goals/:id` | Sesión | Marca o desmarca como completada |
| `DELETE /goals/:id` | Sesión | Elimina la meta |

### Panel del equipo (`/api/staff`) — monitor, psicólogo o admin

| Método y ruta | Rol | Descripción |
|---|---|---|
| `GET /staff/patients` | Staff | Mis pacientes; el admin ve todos |
| `GET /staff/patients/:id` | Staff | Expediente: chat, metas, riesgo, ficha y notas |
| `POST /staff/patients/:id/notes` | Staff | Añade una nota de progreso (máx. 2000 caracteres) |
| `PUT /staff/patients/:id/medical/validate` | **Psicólogo o admin** | Marca la ficha como validada, rechazada o pendiente |
| `GET /staff/appointments` | Staff | Calendario propio; el admin ve todas las citas |
| `POST /staff/appointments` | **Psicólogo o admin** | Agenda una cita (rechaza solapamientos con `409`) |
| `PUT /staff/appointments/:id` | **Psicólogo o admin** | Edita fecha, duración, modalidad, estado o notas |
| `DELETE /staff/appointments/:id` | **Psicólogo o admin** | Elimina la cita |
| `GET /staff/reports` | Staff | Reporte de mis pacientes; global si es admin |
| `GET /staff/alerts/summary` | Staff | Conteo de pacientes en riesgo alto y medio |
| `GET /staff/team` | Staff | Lista del equipo, para los selectores de la interfaz |

### Administración (`/api/admin`) — solo admin

| Método y ruta | Descripción |
|---|---|
| `GET /admin/dashboard` | Todos los pacientes con su nivel de riesgo y estadísticas globales |
| `GET /admin/user/:id` | Detalle de un usuario con sus últimos 30 mensajes |
| `GET /admin/staff` | Lista del equipo |
| `POST /admin/staff` | Crea una cuenta de monitor, psicólogo o admin |
| `PUT /admin/users/:id/role` | Cambia el rol (no puedes quitarte tu propio rol de admin) |
| `PUT /admin/users/:id/password` | Restablece la contraseña de otra persona y cierra sus sesiones |
| `PUT /admin/patients/:id/assign` | Asigna o desasigna un paciente a un miembro del equipo |
| `GET /admin/contact-messages` | Bandeja del formulario público |
| `GET /admin/settings` | Estado de la IA; nunca devuelve la clave completa |
| `PUT /admin/settings` | Guarda o borra la clave de IA (**solo en la app de escritorio**) |

### Otros

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST /contact` | Público | Formulario de la landing; exige aceptar la política de datos |
| `GET /health` | Público | Estado del servidor, proveedor de IA y tipo de almacenamiento (`memory`, `file` o `file-encrypted`) |

---

## 🧰 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 + React Router 6 + Axios |
| Backend | Node.js 18+ y Express 4 (módulos ES) |
| Escritorio | Electron 33 + electron-builder 25 (instalador NSIS) |
| IA | DeepSeek (`deepseek-chat`) u OpenAI (`gpt-4o-mini`); modo demo si no hay clave |
| Autenticación | JWT (7 días) + bcryptjs |
| Almacenamiento | SQLite vía sql.js (WebAssembly), con archivo cifrado (AES-256-GCM) en escritorio |
| Seguridad | Helmet, CSP, CORS, express-rate-limit |
| Despliegue web | Railway (`railway.toml`) |

---

## 🚧 Limitaciones conocidas y próximos pasos

Lo que hoy no está resuelto, dicho sin rodeos:

- **En modo servidor los datos viven solo en memoria.** Aunque el motor ya es SQLite, sin
  `CONTIGO_DATA_DIR` la base no se respalda en disco y se pierde al reiniciar el proceso. La
  app de escritorio sí define esa variable. Para un despliegue web con varias personas hace
  falta apuntar `CONTIGO_DATA_DIR` a un volumen persistente (el sistema de archivos de
  Railway es efímero por defecto).
- **No hay recuperación de contraseña por correo.** No existe servicio de envío de
  correos: si alguien pierde su contraseña, el administrador debe restablecerla desde
  la pestaña Equipo y entregarla por un canal seguro.
- **El instalador no está firmado digitalmente.** Windows SmartScreen mostrará una
  advertencia al ejecutarlo. Hace falta un certificado de firma de código.
- **El análisis de riesgo es por palabras clave.** No entiende contexto, ironía ni
  negaciones; genera falsos positivos y falsos negativos. Es una ayuda de triaje, no
  un diagnóstico.
- **Sin registro de auditoría.** No queda constancia de qué miembro del equipo
  consultó qué expediente y cuándo, algo esperable en un sistema con información
  clínica.
- **Solo se genera instalador para Windows.** El cifrado depende de `safeStorage` de
  Electron, que en Windows usa DPAPI; en otros sistemas habría que validar el
  comportamiento.
- **El archivo `public/manifest.json` y el service worker siguen en el repositorio,
  pero la aplicación ya no los registra**, así que hoy no funciona como PWA
  instalable.

---

## 🤝 Contribuciones

Este proyecto está en fase MVP. Si quieres colaborar o tienes sugerencias, abre un
issue o contacta al autor.

## 📄 Licencia

2025 Contigo — Aquí Estoy.

Este código es privado y confidencial. Solo puede ser visto y modificado por miembros
autorizados del equipo de desarrollo. Queda prohibida su copia, distribución o uso
comercial sin permiso explícito del autor Uneard (Santiago Turriago Laverde).
