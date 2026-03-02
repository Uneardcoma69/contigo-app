import { useState, useCallback } from 'react'

let id = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const toastId = ++id
    setToasts(t => [...t, { id: toastId, message, type }])
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== toastId))
    }, duration)
  }, [])

  const success = useCallback((msg) => show(msg, 'success'), [show])
  const error   = useCallback((msg) => show(msg, 'error', 4500), [show])
  const info    = useCallback((msg) => show(msg, 'info'), [show])

  return { toasts, success, error, info }
}
