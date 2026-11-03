// Carimbo de tinta: selos de honestidade, "ADULTO", "PERDIDO". Bate no papel ao aparecer
// (quem pediu "reduzir movimento" só vê ele aparecer).
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { stampIn } from '../lib/motion'
import styles from './Stamp.module.css'

interface StampProps {
  children: ReactNode
  /** linha pequena embaixo (ex.: "5 respostas sinceras") */
  note?: ReactNode
  tone?: 'stamp' | 'herb' | 'sepia'
  shape?: 'rect' | 'round'
  className?: string
}

export function Stamp({ children, note, tone = 'stamp', shape = 'rect', className }: StampProps) {
  return (
    <motion.div
      className={[styles.stamp, className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-shape={shape}
      variants={stampIn}
      initial="hidden"
      animate="show"
    >
      <span className={styles.text}>{children}</span>
      {note && <span className={styles.note}>{note}</span>}
    </motion.div>
  )
}
