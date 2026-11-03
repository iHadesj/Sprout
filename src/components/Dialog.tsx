// Modal com o <dialog> nativo (prende o foco e responde ao Esc). A folha de papel sobe um
// pouco ao abrir; ao fechar, só depois da animação de saída o <dialog> fecha de verdade.
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { ease } from '../lib/motion'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault() // Esc: deixa a animação de saída rodar antes de fechar
        onClose()
      }}
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open && (
          <motion.div
            key="overlay"
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          >
            <motion.div
              className={styles.sheet}
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease } }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            >
              <header className={styles.header}>
                <h2 id="dialog-title">{title}</h2>
                <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
                  <X size={18} strokeWidth={1.6} />
                </button>
              </header>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}
