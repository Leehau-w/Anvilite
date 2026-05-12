import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { generateId } from '@/utils/id'

interface ToastItem {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastContextValue {
  showToast: (message: string, action?: ToastItem['action'], duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // LOW-15: track timer IDs and clear on unmount
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [])

  const showToast = useCallback(
    (message: string, action?: ToastItem['action'], duration = 5000) => {
      const id = generateId()
      setToasts((prev) => [...prev, { id, message, action, duration }])
      const timer = setTimeout(() => {
        timersRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
      timersRef.current.set(id, timer)
    },
    []
  )

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                background: 'var(--color-text)',
                color: 'var(--color-bg)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-lg)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-lg)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{toast.message}</span>
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action!.onClick()
                    dismiss(toast.id)
                  }}
                  style={{
                    color: 'var(--color-accent)',
                    fontWeight: 600,
                    fontSize: 13,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
