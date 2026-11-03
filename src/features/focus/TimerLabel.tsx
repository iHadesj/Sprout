// Relógio do foco e da pausa: o tempo grande em Plex Mono dentro de um anel fino que vai
// esvaziando (cheio no começo, vazio no fim). Nada mais se mexe em volta.
import { motion } from 'motion/react'
import styles from './FocusScreen.module.css'

interface TimerLabelProps {
  /** 1 = cheio (começo), 0 = vazio (acabou). */
  progress: number
  label: string
  caption: string
  tone: 'focus' | 'break'
}

const R = 46
const LENGTH = 2 * Math.PI * R

export function TimerLabel({ progress, label, caption, tone }: TimerLabelProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className={styles.timer} data-tone={tone}>
      <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
        <circle className={styles.ringTrack} cx="50" cy="50" r={R} />
        <motion.circle
          className={styles.ringFill}
          cx="50"
          cy="50"
          r={R}
          strokeDasharray={LENGTH}
          transform="rotate(-90 50 50)"
          initial={false}
          animate={{ strokeDashoffset: LENGTH * (1 - clamped) }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      </svg>
      <span className={styles.ringText}>
        <span className={`mono ${styles.time}`} role="timer" aria-live="off" aria-label={label}>
          {label}
        </span>
        <span className={styles.caption}>{caption}</span>
      </span>
    </div>
  )
}
