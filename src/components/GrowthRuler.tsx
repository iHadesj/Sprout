// Régua de crescimento: 10 cápsulas, preenchidas até o growth da planta (x de 10). Entram uma
// a uma com mola.
import { motion } from 'motion/react'
import { spring } from '../lib/motion'
import styles from './GrowthRuler.module.css'

export function GrowthRuler({ growth }: { growth: number }) {
  return (
    <span className={styles.ruler} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <motion.span
          key={i}
          className={styles.tick}
          data-on={i < growth || undefined}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring.pop, delay: 0.15 + i * 0.04 }}
        />
      ))}
    </span>
  )
}
