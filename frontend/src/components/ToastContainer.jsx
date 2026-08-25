import Icono from './Icono.jsx'
export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <Icono nombre={t.type === 'success' ? 'check' : t.type === 'error' ? 'cerrar' : 'info'} tamano={17} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
