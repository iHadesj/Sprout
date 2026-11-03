// Divisor em onda: um traço fino que se desenha quando entra na tela. Substitui o fio reto.
import { motion, useReducedMotion } from 'motion/react'
import { ease } from '../../lib/motion'
import styles from './Wave.module.css'

const PATHS = [
  'M0 14 C 100 3, 200 3, 300 14 S 500 25, 600 14 S 800 3, 900 14 S 1100 25, 1200 14',
  'M0 10 C 140 22, 260 22, 400 12 S 660 2, 800 12 S 1060 24, 1200 16',
]

export function Wave({ variant = 0, className }: { variant?: 0 | 1; className?: string }) {
  const reduced = useReducedMotion()
  return (
    // a altura do svg é a do viewBox (28): só a largura estica, então o traço não engrossa
    <svg className={[styles.wave, className].filter(Boolean).join(' ')} viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        d={PATHS[variant]}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 1.3, ease }}
      />
    </svg>
  )
}
