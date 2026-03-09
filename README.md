# Contigo — Aquí Estoy 🌿

App de apoyo emocional con IA. Chat empático, objetivos de bienestar, PWA instalable en iPhone.

## 🚀 Deploy en Railway (paso a paso)

### 1. Sube el código a GitHub
```bash
git add .
git commit -m "proyecto listo para deploy"
git push origin main
```

### 2. En Railway (railway.app)
1. Crear nuevo proyecto → "Deploy from GitHub repo"
2. Seleccionar tu repositorio `contigo-app`
3. Railway detectará el `railway.toml` automáticamente ✅

### 3. Variables de entorno en Railway
En el panel de Railway → Variables → Agregar:

| Variable | Valor |
|----------|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Un texto secreto largo (mínimo 32 caracteres) |
| `OPENAI_API_KEY` | Tu key de OpenAI (o dejar vacío para modo demo) |

### 4. Deploy
Railway construye y despliega automáticamente. En ~2 minutos tendrás tu URL pública.

---

## 🛠️ Desarrollo local

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev    # → http://localhost:3000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev    # → http://localhost:5173
```

## 📱 PWA (instalar en iPhone)
1. Abre la app en Safari
2. Toca el botón compartir (cajita con flecha)
3. "Añadir a pantalla de inicio"

## 🔑 Cómo obtener una API Key de OpenAI
1. Ve a platform.openai.com
2. Crea cuenta → API Keys → Create new secret key
3. Pégala en Railway como `OPENAI_API_KEY`
4. Sin key = modo demo (respuestas pre-escritas, gratis)
