import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'

const features = [
  { icon: 'chat',     title: 'Conversación empática',    text: 'Un espacio sin juicios para expresarte libremente en cualquier momento.' },
  { icon: 'wind',     title: 'Técnicas de respiración',  text: 'Ejercicios guiados para calmar la mente y reducir el estrés al instante.' },
  { icon: 'brain',    title: 'Mindfulness',              text: 'Prácticas de atención plena adaptadas a tu ritmo y necesidades.' },
  { icon: 'target',   title: 'Objetivos de bienestar',   text: 'Establece metas personales y síguelas con progreso visual.' },
  { icon: 'lock',     title: 'Privacidad primero',       text: 'Tu información es tuya. Conversaciones protegidas y confidenciales.' },
  { icon: 'clock',    title: 'Siempre disponible',       text: 'Accede cuando lo necesites, a cualquier hora del día.' },
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
          <div className="home-hero__mascot">
            <img
              src="/contigo-bot.jpeg"
              alt="Contigo mascota"
              className="home-hero__mascot-img"
            />
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
                <div className="home-feature__icon-wrap">
                  <Icon name={f.icon} size={22} color="var(--teal-dark)" strokeWidth={1.6} />
                </div>
                <div className="home-feature__title">{f.title}</div>
                <p className="home-feature__text">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-disclaimer-wrap">
          <div className="home-disclaimer">
            <Icon name="info" size={16} color="var(--slate)" />
            <p>
              Contigo es un apoyo complementario y no reemplaza la atención
              de un profesional de salud mental. Si estás en crisis, contacta
              una línea de emergencias.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
