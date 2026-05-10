import { useEffect, useState } from 'react'
import axios from 'axios'
import Icon from './Icon.jsx'

// Banner contextual que aparece cuando se detecta nivel L2/L3.
// Carga recursos de ayuda según país (default si no se conoce).
// Persiste hasta que el usuario lo cierra explícitamente.

export default function CrisisBanner({ level, country = 'default', onClose }) {
  const [resources, setResources] = useState([])

  useEffect(() => {
    let cancelled = false
    axios.get(`/api/risk/resources?country=${country}`)
      .then(({ data }) => { if (!cancelled) setResources(data.resources || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [country])

  const isCritical = level === 'L3'

  return (
    <div className={`crisis-banner crisis-banner--${level.toLowerCase()}`} role="alert">
      <div className="crisis-banner__icon">
        <Icon name={isCritical ? 'shield' : 'heart'} size={22} />
      </div>
      <div className="crisis-banner__body">
        <p className="crisis-banner__title">
          {isCritical
            ? 'No tienes que pasar por esto solo/a'
            : 'Lo que sientes merece atención profesional'}
        </p>
        <p className="crisis-banner__text">
          {isCritical
            ? 'Habla con alguien especializado ahora. Las llamadas son confidenciales y gratuitas.'
            : 'Si lo que sientes se mantiene o se intensifica, considera apoyarte en un profesional.'}
        </p>

        {resources.length > 0 && (
          <div className="crisis-banner__resources">
            {resources.slice(0, 3).map((r, i) => (
              <div key={i} className="crisis-banner__resource">
                <div className="crisis-banner__resource-name">{r.name}</div>
                <div className="crisis-banner__resource-actions">
                  {r.phone && (
                    <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="crisis-banner__cta">
                      <Icon name="phone" size={14} />
                      {r.phone}
                    </a>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="crisis-banner__cta crisis-banner__cta--ghost">
                      <Icon name="external" size={14} />
                      Web
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onClose} className="crisis-banner__close" aria-label="Cerrar">
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}
