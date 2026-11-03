// Número que "conta" até o valor (0 → 200 min). Usa um MotionValue: o texto muda direto no
// DOM a cada frame, sem re-renderizar o React. Com "reduzir movimento", aparece já pronto.
import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}

export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 1, className }: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const current = useMotionValue(reduced ? value : 0)
  const text = useTransform(current, (n) => format(n))

  useEffect(() => {
    if (reduced) {
      current.set(value)
      return
    }
    const controls = animate(current, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [value, duration, reduced, current])

  return <motion.span className={className}>{text}</motion.span>
}
