// Mancha de papel atrás da ilha: uma forma que muda devagar (morph entre 3 contornos com o
// mesmo número de pontos) e escorrega uns pixels na direção do mouse. Só enfeite (aria-hidden).
// `still` (foco) e "reduzir movimento" deixam ela parada.
import { useEffect } from 'react'
import { motion, useReducedMotion, useSpring } from 'motion/react'
import styles from './Blob.module.css'

/** Contorno fechado e suave por 8 raios (Catmull-Rom virando curvas de Bézier). */
function blobPath(radii: number[]) {
  const n = radii.length
  const pts = radii.map((r, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return [Math.cos(a) * r * 100, Math.sin(a) * r * 100]
  })
  const p = (i: number) => pts[(i + n) % n]
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(p(0)[0])} ${f(p(0)[1])}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return `${d} Z`
}

const SHAPES = [
  [1, 0.92, 1.04, 0.95, 1.02, 0.9, 1.05, 0.96],
  [0.94, 1.04, 0.93, 1.03, 0.96, 1.05, 0.92, 1.02],
  [1.03, 0.97, 0.95, 1.05, 0.93, 1, 0.98, 0.94],
].map(blobPath)

const PULL = 12

export function Blob({ still = false, className }: { still?: boolean; className?: string }) {
  const reduced = useReducedMotion()
  const quiet = still || !!reduced
  const x = useSpring(0, { stiffness: 60, damping: 14 })
  const y = useSpring(0, { stiffness: 60, damping: 14 })

  useEffect(() => {
    if (quiet) {
      x.set(0)
      y.set(0)
      return
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const dx = e.clientX - window.innerWidth / 2
      const dy = e.clientY - window.innerHeight / 2
      const d = Math.hypot(dx, dy) || 1
      const pull = Math.min(PULL, d / 30)
      x.set((dx / d) * pull)
      y.set((dy / d) * pull)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [quiet, x, y])

  return (
    <motion.svg className={[styles.blob, className].filter(Boolean).join(' ')} viewBox="-115 -115 230 230" style={{ x, y }} aria-hidden="true">
      <motion.path
        d={SHAPES[0]}
        animate={quiet ? { d: SHAPES[0] } : { d: [SHAPES[0], SHAPES[1], SHAPES[2], SHAPES[0]] }}
        transition={quiet ? { duration: 0.6 } : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
  )
}
