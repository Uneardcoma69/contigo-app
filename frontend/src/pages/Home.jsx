import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import '../landing.css'

const services = [
  { title: 'Terapia individual', text: 'Un proceso uno a uno para trabajar ansiedad, estado de ánimo, autoestima o esa situación que hoy te pesa y aún no sabes cómo nombrar.' },
  { title: 'Terapia de pareja y familia', text: 'Sesiones para mejorar la comunicación, resolver conflictos y reconstruir acuerdos, con un espacio neutral para cada voz.' },
  { title: 'Manejo de ansiedad y estrés', text: 'Herramientas concretas de regulación emocional para el día a día: trabajo, estudio, descanso y relaciones.' },
  { title: 'Acompañamiento en duelo', text: 'Apoyo para transitar pérdidas y cambios de vida importantes, a tu propio ritmo y sin fechas impuestas.' },
  { title: 'Orientación inicial', text: 'Una sesión de valoración para entender tu situación, resolver dudas y definir juntos el mejor camino a seguir.' },
  { title: 'Bienestar y hábitos', text: 'Trabajo en rutinas, límites y autocuidado sostenible, para que los avances de la consulta se mantengan en tu vida diaria.' },
]

const whyItems = [
  { title: 'Escucha antes que protocolo', text: 'La primera tarea es entender tu historia. El plan de trabajo se construye contigo, no se aplica sobre ti.' },
  { title: 'Profesionales verificados', text: 'Todo el equipo cuenta con tarjeta profesional vigente, formación de posgrado y supervisión clínica constante.' },
  { title: 'Flexibilidad real', text: 'Sesiones presenciales o en línea, con horarios extendidos entre semana y sábados en la mañana.' },
  { title: 'Acompañamiento entre sesiones', text: 'Recibes pautas y material de apoyo para continuar el trabajo en tu día a día, no solo durante la consulta.' },
]

const team = [
  { initials: 'LC', name: 'Laura Cifuentes', role: 'Psicóloga clínica · Mg. en Psicología Clínica', focus: 'Ansiedad, estado de ánimo y regulación emocional en adultos.' },
  { initials: 'DH', name: 'Daniel Herrera', role: 'Psicólogo · Esp. en Terapia Cognitivo-Conductual', focus: 'Estrés, hábitos y acompañamiento a adultos jóvenes.' },
  { initials: 'AT', name: 'Ana María Torres', role: 'Psicóloga · Mg. en Terapia Familiar Sistémica', focus: 'Terapia de pareja, familia y acompañamiento en crianza.' },
  { initials: 'CR', name: 'Camilo Restrepo', role: 'Psicólogo · Esp. en Psicología de la Salud', focus: 'Duelo, enfermedad y transiciones de vida.' },
]

const stories = [
  { quote: 'Llegué sin saber cómo nombrar lo que me pasaba. Hoy tengo herramientas y, sobre todo, me siento escuchada.', author: 'Mariana G.', tag: 'Proceso individual' },
  { quote: 'Las sesiones en línea me permitieron ser constante por primera vez. El seguimiento entre citas marca la diferencia.', author: 'Jorge R.', tag: 'Manejo de ansiedad' },
  { quote: 'Nos ayudaron a hablar de temas que llevábamos años evitando, con respeto y sin tomar partido.', author: 'Claudia y Andrés', tag: 'Terapia de pareja' },
]

const faqs = [
  { q: '¿Necesito un diagnóstico o una remisión para consultar?', a: 'No. Basta con que sientas que algo te inquieta o que te gustaría entenderte mejor. La valoración inicial sirve precisamente para orientar el camino.' },
  { q: '¿Las sesiones en línea funcionan igual que las presenciales?', a: 'Sí. Usamos videollamada segura y la misma estructura de trabajo. Muchas personas las prefieren por comodidad y porque facilitan la constancia.' },
  { q: '¿Qué pasa en la primera sesión?', a: 'Hablamos de tu situación actual, tu historia y lo que esperas del proceso. Al final tendrás una recomendación clara sobre cómo continuar.' },
  { q: '¿Cuánto dura un proceso terapéutico?', a: 'Depende de cada persona y de sus objetivos. Algunos procesos toman pocas semanas; otros, varios meses. Lo revisamos contigo de forma periódica y transparente.' },
  { q: '¿Mi información es confidencial?', a: 'Sí. Toda tu información está protegida por el secreto profesional y por nuestra política de tratamiento de datos personales.' },
]

function Brand() {
  return (
    <a className="brand" href="#contenido" aria-label="Contigo — Aquí Estoy. Ir al inicio">
      {/* El distintivo era un par de círculos abstractos; ahora es el
          icono de la marca, el mismo que se ve en la aplicación. */}
      <img className="brand-mark" src="/marca/contigo-favicon.png" alt="" aria-hidden="true" />
      <span className="brand-name">
        <strong>Contigo</strong>
        <small>Aquí estoy</small>
      </span>
    </a>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [formSent, setFormSent] = useState(false)
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const rootRef = useRef(null)
  const statusRef = useRef(null)

  // Sombra del header al hacer scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cerrar el menú móvil con Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Animación de entrada (reveal) con IntersectionObserver
  useEffect(() => {
    if (loading || user) return
    const root = rootRef.current
    if (!root) return
    const items = root.querySelectorAll('.reveal')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [loading, user])

  if (loading) return null
  if (user) return <Navigate to={user.isAdmin ? '/admin' : user.isStaff ? '/staff' : '/chat'} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const form = e.target
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const datos = new FormData(form)
    setSending(true)
    setFormError('')
    try {
      await axios.post('/api/contact', {
        nombre: datos.get('nombre'),
        correo: datos.get('correo'),
        telefono: datos.get('telefono'),
        motivo: datos.get('motivo'),
        mensaje: datos.get('mensaje'),
        privacidad: datos.get('privacidad') === 'on'
      })
      form.reset()
      setFormSent(true)
      requestAnimationFrame(() => {
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch (err) {
      setFormError(err?.response?.data?.message || 'No pudimos enviar tu mensaje. Inténtalo de nuevo en un momento.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={rootRef} className={`landing${navOpen ? ' nav-open' : ''}`}>

      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="lp-container header-inner">
          <Brand />

          <nav className="site-nav" id="menu" aria-label="Navegación principal" onClick={(e) => { if (e.target.closest('a')) setNavOpen(false) }}>
            <a href="#servicios">Servicios</a>
            <a href="#por-que">Por qué Contigo</a>
            <a href="#equipo">Equipo</a>
            <a href="#historias">Historias</a>
            <a href="#preguntas">Preguntas</a>
            <Link className="nav-auth" to="/login">Iniciar sesión</Link>
            <Link className="lp-btn lp-btn-primary nav-cta nav-auth" to="/register">Crear cuenta</Link>
          </nav>

          <div className="header-cta">
            <Link className="header-cta-login" to="/login">Iniciar sesión</Link>
            <Link className="lp-btn lp-btn-primary nav-cta" to="/register">Crear cuenta</Link>
          </div>

          <button
            className="nav-toggle"
            type="button"
            aria-expanded={navOpen}
            aria-controls="menu"
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="nav-toggle-line"></span>
            <span className="nav-toggle-line"></span>
            <span className="visually-hidden">Abrir menú</span>
          </button>
        </div>
      </header>

      <main id="contenido">

        {/* ---------- Hero ---------- */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="lp-container hero-grid">
            <div className="hero-copy">
              {/* La marca reemplaza al antetítulo: su bajada ya dice «Bienestar
                  emocional y salud mental», así que mantener el texto encima
                  repetía la misma frase dos veces seguidas. */}
              <img
                className="hero-marca reveal"
                src="/marca/contigo-lockup.png"
                alt="Contigo — Aquí Estoy · Centro de bienestar emocional y salud mental"
                width="990"
                height="440"
              />
              <h1 id="hero-title" className="reveal" style={{ '--rd': '0.06s' }}>Cuidar cómo te sientes también es cuidar tu salud</h1>
              <p className="hero-lead reveal" style={{ '--rd': '0.12s' }}>
                En Contigo te acompaña un equipo de psicólogos titulados, en sesiones presenciales
                o en línea, con un proceso a tu ritmo y en total confidencialidad.
              </p>
              <div className="hero-actions reveal" style={{ '--rd': '0.18s' }}>
                <Link className="lp-btn lp-btn-primary" to="/register">Comenzar mi proceso</Link>
                <a className="lp-btn lp-btn-secondary" href="#servicios">Conocer los servicios</a>
              </div>
              <ul className="hero-trust reveal" style={{ '--rd': '0.24s' }}>
                <li>Psicólogos con tarjeta profesional</li>
                <li>Atención presencial y en línea</li>
                <li>Respuesta en menos de 24 h hábiles</li>
              </ul>
            </div>

            <div className="hero-visual reveal" style={{ '--rd': '0.2s' }} aria-hidden="true">
              <div className="hero-panel">
                <svg viewBox="0 0 520 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice">
                  <path d="M-60 470 C 95 320, 425 320, 580 470" stroke="var(--teal)" strokeOpacity="0.5" strokeWidth="1.6" />
                  <path d="M-60 520 C 100 385, 420 385, 580 520" stroke="var(--teal)" strokeOpacity="0.32" strokeWidth="1.6" />
                  <path d="M-60 570 C 105 450, 415 450, 580 570" stroke="var(--sage)" strokeOpacity="0.55" strokeWidth="1.6" />
                  <path d="M-60 620 C 110 515, 410 515, 580 620" stroke="var(--sage)" strokeOpacity="0.3" strokeWidth="1.6" />
                  <circle cx="368" cy="150" r="44" stroke="var(--teal)" strokeOpacity="0.4" strokeWidth="1.4" />
                  <circle cx="404" cy="136" r="44" stroke="var(--sage)" strokeOpacity="0.45" strokeWidth="1.4" />
                </svg>
                <span className="hero-chip"><span className="dot"></span>Agenda abierta esta semana</span>
              </div>
              <div className="hero-card">
                <p className="hero-card-label">Primera consulta</p>
                <p className="hero-card-value">Valoración inicial de 50 minutos, en línea o presencial.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Cifras ---------- */}
        <section className="stats" aria-label="Cifras de la institución">
          <div className="lp-container stats-grid">
            <div className="stat reveal"><strong>8+</strong><span>años de práctica clínica</span></div>
            <div className="stat reveal" style={{ '--rd': '0.06s' }}><strong>2.400+</strong><span>procesos de acompañamiento realizados</span></div>
            <div className="stat reveal" style={{ '--rd': '0.12s' }}><strong>4,9 / 5</strong><span>valoración promedio de nuestros pacientes</span></div>
            <div className="stat reveal" style={{ '--rd': '0.18s' }}><strong>93 %</strong><span>continúa su proceso después de la primera sesión</span></div>
          </div>
        </section>

        {/* ---------- Servicios ---------- */}
        <section id="servicios" className="lp-section" aria-labelledby="servicios-title">
          <div className="lp-container">
            <header className="section-head reveal">
              <p className="eyebrow">Servicios</p>
              <h2 id="servicios-title">Atención pensada para momentos distintos</h2>
              <p>No todas las personas llegan por lo mismo. Por eso cada servicio parte de una valoración inicial y se adapta a tu situación, tus tiempos y tus objetivos.</p>
            </header>

            <div className="services-grid">
              {services.map(s => (
                <article key={s.title} className="service-card reveal">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>

            <p className="services-note reveal">¿No sabes cuál necesitas? <a href="#contacto">Escríbenos</a> y te orientamos sin costo.</p>
          </div>
        </section>

        {/* ---------- Por qué Contigo ---------- */}
        <section id="por-que" className="why lp-section" aria-labelledby="porque-title">
          <div className="lp-container why-grid">
            <div className="why-intro reveal">
              <p className="eyebrow">Por qué Contigo</p>
              <h2 id="porque-title">Lo importante no es solo qué hacemos, sino cómo lo hacemos</h2>
              <p>Creemos que un buen proceso terapéutico empieza por una buena relación: cercana, honesta y sin juicios. Estos son los principios que guían nuestro trabajo todos los días.</p>
              <a className="why-link" href="#equipo">Conoce a nuestro equipo</a>
            </div>

            <ul className="why-list">
              {whyItems.map(item => (
                <li key={item.title} className="reveal">
                  <span className="tick" aria-hidden="true"></span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Proceso ---------- */}
        <section className="lp-section" aria-labelledby="proceso-title">
          <div className="lp-container">
            <header className="section-head reveal">
              <p className="eyebrow">Cómo empezar</p>
              <h2 id="proceso-title">Tres pasos, sin vueltas</h2>
            </header>

            <ol className="process">
              <li className="reveal">
                <span className="step-num" aria-hidden="true">01</span>
                <h3>Escríbenos</h3>
                <p>Cuéntanos brevemente qué está pasando. Te respondemos en menos de 24 horas hábiles, sin compromiso.</p>
              </li>
              <li className="reveal" style={{ '--rd': '0.08s' }}>
                <span className="step-num" aria-hidden="true">02</span>
                <h3>Sesión de valoración</h3>
                <p>Conoces a tu psicólogo, hablan de tu situación y resuelves todas tus dudas sobre el proceso.</p>
              </li>
              <li className="reveal" style={{ '--rd': '0.16s' }}>
                <span className="step-num" aria-hidden="true">03</span>
                <h3>Plan de acompañamiento</h3>
                <p>Definen juntos objetivos, frecuencia y modalidad. El plan se revisa y se ajusta a medida que avanzas.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ---------- Equipo ---------- */}
        <section id="equipo" className="team lp-section" aria-labelledby="equipo-title">
          <div className="lp-container">
            <header className="section-head reveal">
              <p className="eyebrow">Equipo</p>
              <h2 id="equipo-title">Personas preparadas para escucharte</h2>
              <p>Un equipo pequeño, cercano y en formación continua. Cada profesional trabaja bajo supervisión clínica y con actualización permanente.</p>
            </header>

            <div className="team-grid">
              {team.map(m => (
                <article key={m.initials} className="member reveal">
                  <div className="member-photo" aria-hidden="true"><span>{m.initials}</span></div>
                  <h3>{m.name}</h3>
                  <p className="member-role">{m.role}</p>
                  <p className="member-focus">{m.focus}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Historias ---------- */}
        <section id="historias" className="stories lp-section" aria-labelledby="historias-title">
          <div className="lp-container">
            <header className="section-head center reveal">
              <p className="eyebrow">Historias</p>
              <h2 id="historias-title">Lo que cuentan quienes ya dieron el paso</h2>
            </header>

            <div className="stories-grid">
              {stories.map(s => (
                <figure key={s.author} className="quote-card reveal">
                  <span className="quote-mark" aria-hidden="true">&ldquo;</span>
                  <blockquote>
                    <p>{s.quote}</p>
                  </blockquote>
                  <figcaption>
                    <strong>{s.author}</strong>
                    <span>{s.tag}</span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="stories-note reveal">Testimonios compartidos con autorización. Usamos solo iniciales para proteger la privacidad de cada persona.</p>
          </div>
        </section>

        {/* ---------- Llamado a la acción ---------- */}
        <section className="lp-section" aria-labelledby="cta-title">
          <div className="lp-container">
            <div className="cta-panel reveal">
              <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M-20 250 C 110 140, 310 140, 440 250" stroke="var(--teal)" strokeOpacity="0.5" strokeWidth="1.4" />
                <path d="M-20 295 C 115 200, 305 200, 440 295" stroke="var(--sage)" strokeOpacity="0.45" strokeWidth="1.4" />
                <circle cx="330" cy="80" r="36" stroke="var(--teal)" strokeOpacity="0.4" strokeWidth="1.2" />
                <circle cx="360" cy="68" r="36" stroke="var(--sage)" strokeOpacity="0.4" strokeWidth="1.2" />
              </svg>
              <div className="cta-content">
                <h2 id="cta-title">Dar el primer paso también es cuidarse</h2>
                <p>Crea tu cuenta para empezar tu proceso, o escríbenos tus dudas. Te responderemos con calma, con claridad y sin ningún compromiso.</p>
                <div className="cta-actions">
                  <Link className="lp-btn lp-btn-on-dark" to="/register">Crear mi cuenta</Link>
                  <a className="lp-btn lp-btn-ghost-dark" href="#preguntas">Ver preguntas frecuentes</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Preguntas frecuentes ---------- */}
        <section id="preguntas" className="lp-section" aria-labelledby="faq-title" style={{ paddingTop: 0 }}>
          <div className="lp-container">
            <header className="section-head center reveal">
              <p className="eyebrow">Preguntas frecuentes</p>
              <h2 id="faq-title">Resolvamos las dudas más comunes</h2>
            </header>

            <div className="faq-list reveal">
              {faqs.map(f => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Contacto ---------- */}
        <section id="contacto" className="contact lp-section" aria-labelledby="contacto-title">
          <div className="lp-container contact-grid">
            <div className="contact-info reveal">
              <p className="eyebrow">Contacto</p>
              <h2 id="contacto-title">Escríbenos: este es el primer paso</h2>
              <p>Cuéntanos qué está pasando con tus propias palabras. No necesitas tenerlo claro ni saber qué servicio elegir; de eso nos encargamos juntos.</p>

              <dl className="contact-list">
                <div>
                  <dt>Correo</dt>
                  <dd><a href="mailto:hola@contigoaquiestoy.com">hola@contigoaquiestoy.com</a></dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>(+57) 300 000 0000</dd>
                </div>
                <div>
                  <dt>Horario de atención</dt>
                  <dd>Lunes a viernes, 8:00 a. m. – 7:00 p. m. · Sábados, 9:00 a. m. – 1:00 p. m.</dd>
                </div>
                <div>
                  <dt>Modalidad</dt>
                  <dd>Sesiones presenciales y en línea, en español</dd>
                </div>
              </dl>

              <aside className="notice">
                <strong>Si estás atravesando una emergencia</strong>
                <p>Contigo no es un servicio de urgencias. Si tú o alguien cercano está en riesgo inmediato, llama a la línea de emergencia de tu país (123 en Colombia) o acude al servicio de urgencias más cercano.</p>
              </aside>
            </div>

            <form className="form-card reveal" noValidate onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="f-nombre">Nombre completo</label>
                  <input id="f-nombre" name="nombre" type="text" autoComplete="name" required />
                </div>
                <div className="field">
                  <label htmlFor="f-correo">Correo electrónico</label>
                  <input id="f-correo" name="correo" type="email" autoComplete="email" required />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor="f-telefono">Teléfono (opcional)</label>
                  <input id="f-telefono" name="telefono" type="tel" autoComplete="tel" />
                </div>
                <div className="field">
                  <label htmlFor="f-motivo">Motivo de consulta</label>
                  <select id="f-motivo" name="motivo" defaultValue="" required>
                    <option value="" disabled>Selecciona una opción</option>
                    <option>Terapia individual</option>
                    <option>Terapia de pareja y familia</option>
                    <option>Manejo de ansiedad y estrés</option>
                    <option>Acompañamiento en duelo</option>
                    <option>Bienestar y hábitos</option>
                    <option>Aún no lo sé</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="f-mensaje">Cuéntanos brevemente qué está pasando</label>
                <textarea id="f-mensaje" name="mensaje" required></textarea>
              </div>

              <div className="field-consent">
                <input id="f-privacidad" name="privacidad" type="checkbox" required />
                <label htmlFor="f-privacidad">He leído y acepto la <Link to="/legal/datos">política de tratamiento de datos personales</Link>. Mi información será utilizada únicamente para responder esta solicitud.</label>
              </div>

              <button className="lp-btn lp-btn-primary" type="submit" disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar mensaje'}
              </button>

              {formSent && (
                <p ref={statusRef} className="form-status" role="status">
                  Gracias por escribirnos. Recibimos tu mensaje y te responderemos en menos de 24 horas hábiles.
                </p>
              )}

              {formError && (
                <p className="form-status form-status--error" role="alert">{formError}</p>
              )}
            </form>
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <div className="lp-container footer-top">
          <div className="footer-brand">
            <Brand />
            <p>Centro de bienestar emocional y salud mental. Acompañamiento psicológico profesional, presencial y en línea, con un equipo de psicólogos titulados y con tarjeta profesional vigente.</p>
          </div>

          <nav className="footer-col" aria-label="Servicios">
            <h3>Servicios</h3>
            <ul>
              <li><a href="#servicios">Terapia individual</a></li>
              <li><a href="#servicios">Pareja y familia</a></li>
              <li><a href="#servicios">Ansiedad y estrés</a></li>
              <li><a href="#servicios">Orientación inicial</a></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Institucional">
            <h3>Institucional</h3>
            <ul>
              <li><a href="#por-que">Por qué Contigo</a></li>
              <li><a href="#equipo">Nuestro equipo</a></li>
              <li><a href="#historias">Historias</a></li>
              <li><a href="#preguntas">Preguntas frecuentes</a></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Cuenta y legal">
            <h3>Tu cuenta</h3>
            <ul>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/register">Crear cuenta</Link></li>
              <li><Link to="/legal/privacidad">Política de privacidad</Link></li>
              <li><Link to="/legal/datos">Tratamiento de datos</Link></li>
              <li><Link to="/legal/terminos">Términos de uso</Link></li>
            </ul>
          </nav>
        </div>

        <div className="lp-container footer-bottom">
          <p>&copy; {new Date().getFullYear()} Contigo — Aquí Estoy. Todos los derechos reservados.</p>
          <p>Este sitio no reemplaza la atención de urgencias.</p>
        </div>
      </footer>
    </div>
  )
}
