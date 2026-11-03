// Pedrinha: um número (mono) e o rótulo dentro de um seixo de papel, sem borda. O canto
// muda devagar e, com `float`, ela boia. Tamanhos sm/md/lg; o número encolhe se for comprido.
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { popIn } from '../../lib/motion'
import styles from './Pebble.module.css'

interface PebbleProps {
  value: ReactNode
  label: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** boia pra cima e pra baixo (período em segundos) */
  float?: number
  /** quantos caracteres o número tem (pra caber); padrão: o tamanho do texto */
  chars?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function Pebble({ value, label, size = 'md', float, chars, className, style, children }: PebbleProps) {
  const length = chars ?? (typeof value === 'string' || typeof value === 'number' ? String(value).length : 4)
  const vars = { '--chars': Math.max(4, length), '--period': float ? `${float}s` : undefined, ...style } as CSSProperties
  return (
    <motion.div className={[styles.pebble, styles[size], float && styles.float, className].filter(Boolean).join(' ')} style={vars} variants={popIn}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {children}
    </motion.div>
  )
}
