// Relógio do foco e da pausa como etiqueta de caderno: o tempo grande em Plex Mono e uma
// régua fina embaixo que vai esvaziando (com tracinhos a cada 10%).
import { motion } from 'motion/react'
import styles from './FocusScreen.module.css'

interface TimerLabelProps {
  /** 1 = cheio (começo), 0 = vazio (acabou). */
  progress: number
  label: string
  caption: string
  tone: 'focus' | 'break'
}

export function TimerLabel({ progress, label, caption, tone }: TimerLabelProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className={styles.timer} data-tone={tone}>
      <span className={`mono ${styles.time}`} role="timer" aria-live="off" aria-label={label}>
        {label}
      </span>
      <span className={styles.track} aria-hidden="true">
        <motion.span className={styles.fill} initial={false} animate={{ scaleX: clamped }} transition={{ duration: 0.25, ease: 'linear' }} />
      </span>
      <span className={styles.caption}>{caption}</span>
    </div>
  )
}
