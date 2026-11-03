// Avisos rápidos ("Jardim criado", "Salvo", erros) numa cápsula que sobe com mola embaixo
// e some sozinha.
import { AnimatePresence, motion } from 'motion/react'
import { spring } from '../lib/motion'
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
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.pop, opacity: { duration: 0.15 } } }}
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
