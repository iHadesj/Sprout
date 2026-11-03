// "Desistir" com confirmação na própria tela. Sem window.confirm(): a caixa do navegador
// trava a página inteira (relógio e heartbeat param enquanto ela está aberta).
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '../../components/Button'
import styles from './FocusScreen.module.css'

export function GiveUpButton({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!asking ? (
        <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button variant="quiet" size="sm" onClick={() => setAsking(true)}>
            Desistir
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="confirm"
          className={styles.confirm}
          role="group"
          aria-label="Confirmar desistência"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4 }}
        >
          <p>Desistir agora mata a planta desta sessão.</p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" size="sm" onClick={() => setAsking(false)} autoFocus>
              Continuar focando
            </Button>
            <Button variant="danger" size="sm" onClick={onConfirm}>
              Desistir mesmo
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
