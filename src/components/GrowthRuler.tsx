// Régua de crescimento: 10 tracinhos, preenchidos até o growth da planta (x de 10).
import { motion } from 'motion/react'
import styles from './GrowthRuler.module.css'

export function GrowthRuler({ growth }: { growth: number }) {
  return (
    <span className={styles.ruler} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <motion.span
          key={i}
          className={styles.tick}
          data-on={i < growth || undefined}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.15 + i * 0.03, duration: 0.2 }}
        />
      ))}
    </span>
  )
}
