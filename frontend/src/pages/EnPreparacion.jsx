import { Link } from 'react-router-dom'
import { CORREO_CONTACTO } from '../config.js'
import '../landing.css'

/**
 * Pantalla que reemplaza al acceso cuando la interfaz está publicada sin
 * servidor detrás. Dice con claridad en qué punto está el proyecto en
 * lugar de ofrecer un formulario que no puede funcionar.
 */
export default function EnPreparacion() {
  return (
    <div className="landing">
      <header className="site-header is-scrolled">
        <div className="lp-container header-inner">
          <Link className="brand" to="/" aria-label="Contigo — Aquí Estoy. Ir al inicio">
            <span className="brand-mark" aria-hidden="true"></span>
            <span className="brand-name">
              <strong>Contigo</strong>
              <small>Aquí estoy</small>
            </span>
          </Link>
          <Link className="lp-btn lp-btn-secondary nav-cta" to="/">← Volver al inicio</Link>
        </div>
      </header>

      <main className="lp-section">
        <div className="lp-container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <p className="eyebrow">Fase de piloto</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)', marginBottom: '1rem' }}>
            Todavía no abrimos el registro
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
            La plataforma está funcionando, pero por ahora damos acceso solo a
            profesionales y personas que participan en el piloto. Queremos que
            un equipo con formación clínica la acompañe antes de abrirla a
            cualquiera.
          </p>
          <p style={{ color: 'var(--slate)', marginBottom: '2rem' }}>
            Si te interesa participar o conocerla por dentro, escríbenos y te
            respondemos.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="lp-btn lp-btn-primary" href={`mailto:${CORREO_CONTACTO}`}>
              Escribirnos
            </a>
            <Link className="lp-btn lp-btn-secondary" to="/">Conocer el proyecto</Link>
          </div>

          <aside className="notice" style={{ marginTop: '2.5rem', textAlign: 'left' }}>
            <strong>Si estás atravesando una emergencia</strong>
            <p>
              Contigo no es un servicio de urgencias. Si tú o alguien cercano está
              en riesgo inmediato, llama a la línea de emergencia de tu país
              (123 en Colombia) o acude al servicio de urgencias más cercano.
            </p>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <div className="lp-container footer-bottom" style={{ borderTop: 'none' }}>
          <p>&copy; {new Date().getFullYear()} Contigo — Aquí Estoy.</p>
          <p>Este sitio no reemplaza la atención de urgencias.</p>
        </div>
      </footer>
    </div>
  )
}
