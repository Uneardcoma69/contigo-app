import Icon from './Icon.jsx'

const ICON_BY_TYPE = {
  success: 'check',
  error:   'alert',
  info:    'info'
}

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <Icon name={ICON_BY_TYPE[t.type] || 'info'} size={16} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
