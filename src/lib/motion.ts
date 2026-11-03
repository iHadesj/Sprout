// Presets de movimento (Motion), reusados no app inteiro. O movimento é expressivo: as coisas
// entram com mola (um pouco de balanço), cliques dão um "pop" e o carimbo bate no papel.
// Regras: nada atrasa um clique, só transform/opacity/clip-path animam, e na tela de foco não
// tem movimento de ambiente. Quem pediu "reduzir movimento" no sistema vê só fades
// (MotionConfig reducedMotion="user" + useReducedMotion onde precisa).
import type { Transition, Variants } from 'motion/react'

export const spring = {
  /** entradas: assenta com um balanço leve */
  soft: { type: 'spring', stiffness: 180, damping: 20 } satisfies Transition,
  /** cliques, chips, carimbos: rápido e com overshoot */
  pop: { type: 'spring', stiffness: 420, damping: 16 } satisfies Transition,
  /** seguir o mouse: lento e macio */
  drift: { type: 'spring', stiffness: 60, damping: 14 } satisfies Transition,
  /** toques: rápido e firme */
  snappy: { type: 'spring', stiffness: 600, damping: 40 } satisfies Transition,
  /** carimbo batendo no papel */
  stamp: { type: 'spring', stiffness: 700, damping: 22, mass: 0.8 } satisfies Transition,
}

export const ease = [0.2, 0.7, 0.2, 1] as const
/** overshoot curto */
export const easeExpressive = [0.34, 1.56, 0.64, 1] as const

/** Sobe e aparece, com mola. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ...spring.soft, opacity: { duration: 0.2 } } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

/** Cresce do pequeno com um pop (pedrinhas, chips, bolinhas). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: { ...spring.pop, opacity: { duration: 0.15 } } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
}

/** Entra de um lado (custom: -1 esquerda, 1 direita), pra listas que alternam. */
export const fromSide: Variants = {
  hidden: (side: number = 1) => ({ opacity: 0, x: 28 * side }),
  show: { opacity: 1, x: 0, transition: { ...spring.soft, opacity: { duration: 0.2 } } },
}

/** Revela da esquerda pra direita, como tinta sendo escrita. */
export const writeIn: Variants = {
  hidden: { clipPath: 'inset(0 100% 0 0)' },
  show: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.6, ease } },
}

/** Carimbo: chega grande e meio torto, bate e assenta. */
export const stampIn: Variants = {
  hidden: { opacity: 0, scale: 1.6, rotate: -14 },
  show: { opacity: 1, scale: 1, rotate: -6, transition: spring.stamp },
}

/** Container que faz os filhos entrarem um depois do outro. */
export function stagger(gap = 0.05, delay = 0.02): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
    exit: {},
  }
}

/** Hover das coisas soltas (cards de jardim, bolinhas): cresce e gira um tiquinho. */
export const hoverTilt = (i = 0) => ({ scale: 1.04, rotate: i % 2 ? 1.5 : -1.5, transition: spring.pop })
