# 🌿 Contigo — Aquí Estoy v2.0

Aplicación fullstack de apoyo emocional con IA. Chat empático con historial persistente, técnicas de bienestar y diseño profesional.

---

## 🗂 Estructura

```
contigo-app/
├── backend/            → Express + MongoDB + JWT + OpenAI
│   ├── models/
│   │   ├── User.js          → Usuarios con bcrypt
│   │   └── Conversation.js  → Historial de conversaciones
│   ├── routes/
│   │   ├── auth.js          → Register / Login / Me
│   │   └── chat.js          → Chat + historial
│   ├── middleware/
│   │   └── requireAuth.js   → Verificación JWT
│   └── server.js            → Express con Helmet + Rate limiting + CORS
│
└── frontend/           → Vite + React 18 + React Router v6
    └── src/
        ├── context/         → AuthContext (estado global de auth)
        ├── hooks/           → useToast (notificaciones)
        ├── components/      → Header, AuthForm, TypingIndicator, ToastContainer
        └── pages/           → Home, Login, Register, ChatPage
```

---

## 🚀 Setup rápido

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edita .env con tus valores
npm install
npm run dev
```

Variables en `.env`:
| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default: 5000) |
| `MONGO_URI` | Connection string de MongoDB Atlas |
| `JWT_SECRET` | Secreto largo y aleatorio para JWT |
| `OPENAI_API_KEY` | (Opcional) API key de OpenAI — sin ella se activa modo demo |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173

---

## 🌟 Funcionalidades v2.0

### Backend
- ✅ Auto-login al registrarse (devuelve token)
- ✅ Historial persistente en MongoDB (GET / DELETE `/api/chat/history`)
- ✅ Contexto conversacional — OpenAI recibe las últimas 20 respuestas
- ✅ Rate limiting (15 req/min auth, 20 msg/min chat)
- ✅ Helmet para headers de seguridad HTTP
- ✅ Morgan para logging de requests
- ✅ Validación robusta de inputs
- ✅ Rotación automática de respuestas demo (7 variantes)
- ✅ Endpoint `/api/auth/me` para verificar sesión

### Frontend
- ✅ Context de autenticación global (AuthContext)
- ✅ Verificación de token al iniciar (auto-logout si expira)
- ✅ Carga del historial de conversaciones previas
- ✅ Indicador de escritura animado
- ✅ Toasts de notificación (sin dependencias externas)
- ✅ Respuestas rápidas (quick replies)
- ✅ Contador de caracteres con aviso
- ✅ Timestamps en burbujas y separadores de fecha
- ✅ Botón para borrar historial
- ✅ Diseño responsivo (mobile-friendly)
- ✅ Scrollbar automático al mensaje nuevo
- ✅ Enter para enviar, Shift+Enter para nueva línea
- ✅ Badge de modo demo cuando no hay API key

---

## 🔌 API Endpoints

### Auth
```
POST /api/auth/register  { name, email, password } → { token, user }
POST /api/auth/login     { email, password }        → { token, user }
GET  /api/auth/me        (Bearer token)             → { user }
```

### Chat
```
POST   /api/chat         (Bearer) { message }       → { reply, demo? }
GET    /api/chat/history (Bearer)                   → { messages[] }
DELETE /api/chat/history (Bearer)                   → { ok: true }
```

---

## 🏗 Producción

```bash
# Frontend: genera archivos estáticos
cd frontend && npm run build

# Sirve el frontend con nginx o déjalo en dist/
# Backend: usa pm2 o similar
NODE_ENV=production node server.js

# Variables adicionales para producción:
FRONTEND_URL=https://tudominio.com   # Para CORS
```

---

## ⚠️ Aviso importante

Contigo es un apoyo complementario y **no reemplaza** la atención de un profesional de salud mental. Si estás en crisis, contacta una línea de emergencias o un profesional.

---

*Contigo v2.0 — Aquí Estoy 🌿*
