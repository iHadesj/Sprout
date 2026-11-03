// Traço de tinta curvo embaixo do item ativo (nav, abas). Com o mesmo layoutId, ele desliza
// de um item pro outro e se redesenha ao chegar.
import { motion } from 'motion/react'
import { ease, spring } from '../../lib/motion'
import styles from './InkUnderline.module.css'

export function InkUnderline({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span layoutId={layoutId} className={[styles.ink, className].filter(Boolean).join(' ')} transition={spring.soft} aria-hidden="true">
      <svg viewBox="0 0 120 12" preserveAspectRatio="none">
        <motion.path
          d="M3 7 C 22 2, 38 11, 58 6 S 96 2, 117 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease }}
        />
      </svg>
    </motion.span>
  )
}
