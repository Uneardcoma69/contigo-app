import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'

const features = [
  { icon: '💬', title: 'Conversación empática',    text: 'Un espacio sin juicios para expresarte libremente en cualquier momento.' },
  { icon: '🫁', title: 'Técnicas de respiración',  text: 'Ejercicios guiados para calmar la mente y reducir el estrés al instante.' },
  { icon: '🧘', title: 'Mindfulness',              text: 'Prácticas de atención plena adaptadas a tu ritmo y necesidades.' },
  { icon: '🎯', title: 'Objetivos de bienestar',   text: 'Establece metas personales y síguelas con progreso visual.' },
  { icon: '🔒', title: 'Privacidad primero',        text: 'Tu información es tuya. Conversaciones protegidas y confidenciales.' },
  { icon: '⏰', title: 'Siempre disponible',        text: 'Accede cuando lo necesites, a cualquier hora del día.' },
]

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/chat" replace />

  return (
    <div className="app-layout">
      <Header />

      <main>
        <section className="home-hero">

          {/* Mascota */}
          <div style={{ marginBottom: 24, position: 'relative', display: 'inline-block' }}>
            <img
              src="/contigo-bot.jpeg"
              alt="Contigo mascota"
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid rgba(255,255,255,0.8)',
                boxShadow: '0 12px 36px rgba(78,205,196,.3)',
                animation: 'float 3.5s ease-in-out infinite'
              }}
            />
            {/* Burbuja de saludo */}
            <div style={{
              position: 'absolute',
              top: -8, right: -14,
              background: 'var(--white)',
              border: '1.5px solid var(--teal-light)',
              borderRadius: '12px 12px 12px 2px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--teal-dark)',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-sm)'
            }}>
              ¡Hola! 👋
            </div>
          </div>

          <div className="home-hero__badge">
            Apoyo emocional con IA
          </div>

          <h1 className="home-hero__title">
            Aquí estoy,<br />
            <span>contigo siempre</span>
          </h1>

          <p className="home-hero__subtitle">
            Un espacio seguro y sin juicios para conversar,
            explorar tus emociones y practicar herramientas
            de bienestar mental.
          </p>

          <div className="home-hero__actions">
            <Link to="/register" className="btn btn--primary btn--lg">
              Comenzar gratis
            </Link>
            <Link to="/login" className="btn btn--outline btn--lg">
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section>
          <div className="home-features">
            {features.map(f => (
              <div className="home-feature" key={f.title}>
                <span className="home-feature__icon">{f.icon}</span>
                <div className="home-feature__title">{f.title}</div>
                <p className="home-feature__text">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: 'center', padding: '0 24px 80px' }}>
          <p style={{ color: 'var(--slate-light)', fontSize: '0.8rem', maxWidth: 400, margin: '0 auto' }}>
            ⚠️ Contigo es un apoyo complementario y no reemplaza la atención de un profesional de salud mental.
            Si estás en crisis, contacta una línea de emergencias.
          </p>
        </section>
      </main>
    </div>
  )
}
