// Presets de movimento (Motion), reusados no app inteiro. No caderno o movimento é contido:
// coisas aparecem como se fossem escritas ou coladas na página, rápido e sem quicar.
// A exceção é o carimbo, que "bate" no papel quando há algo pra comemorar (ou lamentar).
import type { Transition, Variants } from 'motion/react'

export const spring = {
  /** padrão: assenta sem quicar */
  soft: { type: 'spring', stiffness: 320, damping: 34 } satisfies Transition,
  /** toques: rápido e firme */
  snappy: { type: 'spring', stiffness: 600, damping: 40 } satisfies Transition,
  /** carimbo batendo no papel */
  stamp: { type: 'spring', stiffness: 700, damping: 22, mass: 0.8 } satisfies Transition,
}

export const ease = [0.2, 0.7, 0.2, 1] as const

/** Sobe um pouquinho e aparece. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
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
