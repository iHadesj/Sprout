// Avisos rápidos ("Jardim criado", "Salvo", erros) como um bilhete que aparece embaixo
// e some sozinho.
import { AnimatePresence, motion } from 'motion/react'
import { ease } from '../lib/motion'
import { useToasts } from '../lib/toast'
import styles from './Toaster.module.css'

export function Toaster() {
  const list = useToasts((s) => s.list)
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={styles.toast}
            data-kind={t.kind}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <span className="kicker">{t.kind === 'success' ? 'anotado' : 'atenção'}</span>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
