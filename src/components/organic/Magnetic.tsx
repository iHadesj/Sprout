// O botão principal "puxa" um pouco na direção do ponteiro (até 6 px) e volta com mola ao
// sair. Desliga no toque e com "reduzir movimento".
import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion, useSpring } from 'motion/react'

export function Magnetic({ children, strength = 6, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduced = useReducedMotion()
  const [fine] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)
  const x = useSpring(0, { stiffness: 300, damping: 18 })
  const y = useSpring(0, { stiffness: 300, damping: 18 })
  const off = reduced || !fine

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-flex', x, y }}
      onPointerMove={
        off
          ? undefined
          : (e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
              const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
              x.set(Math.max(-1, Math.min(1, dx)) * strength)
              y.set(Math.max(-1, Math.min(1, dy)) * strength)
            }
      }
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.span>
  )
}
