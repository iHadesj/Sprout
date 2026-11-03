// Tudo o que se mexe na tela de login/cadastro: tempos, variants do Motion e as medidas
// que o CSS e a cena 3D precisam combinar. Pra ajustar o ritmo, mexa aqui.
//
// Ordem da montagem (segundos desde que a tela abre):
//   1. fundo de papel (screen)              0
//   2. canvas aparece e a câmera chega       quando a cena carrega (scene.*: desde esse momento)
//   3. ilha sobe, muda cresce do chão        scene.island / scene.sprout
//   4. wordmark letra por letra              wordmark
//   5. card                                  card
//   6. campos do card, um depois do outro    card + fields.delay, passo fields.stagger
import type { Transition, Variants } from 'motion/react'

export const TIMING = {
  screen: 0.3,
  wordmark: 0.55,
  letterStagger: 0.04,
  card: 0.8,
  fields: { delay: 0.14, stagger: 0.06 },
  /** contados a partir do primeiro quadro da cena 3D */
  scene: {
    canvasFade: 0.7,
    camera: 1.2,
    island: 0.15,
    sprout: 0.4,
    /** quanto a ilha sobe ao aparecer, em pixels de tela */
    islandRisePx: 20,
  },
  /** quanto tempo as folhas ficam murchas depois de um erro */
  wiltMs: 1500,
  success: {
    /** o card sai antes de a câmera andar */
    cardExit: 0.35,
    /** intervalo entre uma pétala e a próxima */
    petalStagger: 0.11,
    dollyDelay: 0.35,
    dolly: 1.3,
    /** a cena some no papel no fim do dolly, e aí o app abre */
    fadeOut: 0.5,
  },
  /** com "reduzir movimento": sem dolly, só a flor e um fade curto antes de abrir o app */
  reducedSuccess: 0.7,
} as const

/** Quando o app abre depois do sucesso, em segundos. */
export function successDuration(reduced: boolean) {
  return reduced ? TIMING.reducedSuccess : TIMING.success.dollyDelay + TIMING.success.dolly
}

/**
 * Faixa de "céu" acima do card, onde a muda aparece. O CSS usa como margem de cima do card
 * (variável --sky) e a cena 3D, pra enquadrar a ilha dentro dela.
 */
export const SKY = { min: 190, vh: 0.42, max: 440, top: 56 }

export function skyHeight(viewportHeight: number) {
  return Math.min(SKY.max, Math.max(SKY.min, viewportHeight * SKY.vh))
}

export const skyCss = `clamp(${SKY.min}px, ${SKY.vh * 100}svh, ${SKY.max}px)`

const ease = [0.2, 0.7, 0.2, 1] as const
const softSpring: Transition = { type: 'spring', stiffness: 260, damping: 26 }

export const screenVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: TIMING.screen } },
}

export const canvasVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: TIMING.scene.canvasFade, ease } },
  leaving: { opacity: 0, transition: { duration: TIMING.success.fadeOut, ease: 'easeIn' } },
}

export const wordmarkVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: TIMING.letterStagger, delayChildren: TIMING.wordmark } },
}

const LETTER_DURATION = 0.32

export const letterVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: LETTER_DURATION, ease } },
}

/** O broto do "t" começa a desenhar quando a última letra assenta. */
export const markDelay = (letters: number) => TIMING.wordmark + (letters - 1) * TIMING.letterStagger + LETTER_DURATION

/** Card: entra com spring suave; no sucesso sai encolhendo e desfocando. */
export function cardVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: 24, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { ...softSpring, delay: TIMING.card } },
    exit: reduced
      ? { opacity: 0, transition: { duration: 0.2 } }
      : { opacity: 0, scale: 0.95, filter: 'blur(6px)', transition: { duration: TIMING.success.cardExit, ease } },
  }
}

/** Mudança de altura do card entre login e cadastro (prop `layout`). */
export const cardLayout: Transition = { layout: { type: 'spring', stiffness: 320, damping: 34 } }

/**
 * Conteúdo do card (um por rota). `custom` = atraso antes do primeiro campo: na montagem
 * espera o card chegar; ao trocar de rota, entra logo.
 */
export const formVariants: Variants = {
  hidden: {},
  show: (delay: number) => ({ transition: { staggerChildren: TIMING.fields.stagger, delayChildren: delay } }),
  exit: { opacity: 0, transition: { duration: 0.14 } },
}

export function formDelay(firstMount: boolean) {
  return firstMount ? TIMING.card + TIMING.fields.delay : 0.04
}

/** Cada linha do form: label+campo, botão, link. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
}

/** Balanço de "não" no card quando o login falha. */
export const shake = {
  keyframes: { x: [0, -8, 8, -4, 4, 0] },
  transition: { duration: 0.42, ease: 'easeInOut' } satisfies Transition,
}

/** Borda do campo (mesmos valores de --rule-strong/--herb do tokens.css, o Motion não anima var()). */
export const fieldBorder: Variants = {
  rest: { borderColor: 'rgba(42, 40, 35, 0.2)', transition: { duration: 0.2 } },
  focus: { borderColor: '#2f5b45', transition: { duration: 0.2 } },
}

/** Label que sobe e encolhe (prop `layout`). */
export const labelLayout: Transition = { layout: { type: 'spring', stiffness: 520, damping: 38 } }

const buttonShadow = {
  rest: '0 1px 2px rgba(31, 52, 41, 0.18), 0 4px 10px -6px rgba(31, 52, 41, 0.4)',
  hover: '0 2px 4px rgba(31, 52, 41, 0.2), 0 10px 22px -10px rgba(31, 52, 41, 0.55)',
}

export const button = {
  rest: { boxShadow: buttonShadow.rest },
  hover: { y: -1, boxShadow: buttonShadow.hover, transition: { duration: 0.18 } },
  tap: { scale: 0.98 },
}

/** Troca do texto do botão pelos três pontinhos (os dois ocupam a mesma célula do grid). */
export const buttonContent: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.16 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
}

export const dotsVariants: Variants = {
  ...buttonContent,
  show: { ...buttonContent.show, transition: { duration: 0.16, staggerChildren: 0.14 } },
}

export const dotVariants: Variants = {
  hidden: { opacity: 0.35, scale: 0.8 },
  show: {
    opacity: [0.35, 1, 0.35],
    scale: [0.8, 1, 0.8],
    transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
  },
}

/** Mensagem de erro/aviso: abre a altura e aparece. */
export const messageVariants: Variants = {
  hidden: { height: 0, opacity: 0, transition: { duration: 0.2, ease } },
  show: { height: 'auto', opacity: 1, transition: { height: { duration: 0.26, ease }, opacity: { duration: 0.2, delay: 0.06 } } },
}
