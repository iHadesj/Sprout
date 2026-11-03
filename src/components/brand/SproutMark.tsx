// O broto da marca: uma haste a traço de tinta com 0 a 3 folhas, saindo do "t" de "Sprout".
// Fica em position: absolute sobre o pai (a letra), medido em em, então escala com a fonte.
// Com `draw`, a haste e as folhas se desenham ao montar; folha que chega depois (voltou do foco
// com mais minutos) brota sozinha. Na virada do dia volta pra haste sem animação.
// Dentro de um link, o broto balança uma vez no hover/foco (CSS). Decorativo: aria-hidden.
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ease, spring } from '../../lib/motion'
import type { LeafCount } from './sproutLeaves'
import styles from './SproutMark.module.css'

const STEM = 'M12 32 C 12 24, 11 18, 13 11'
/** Quanto da haste aparece com 0, 1, 2 e 3 folhas: o broto também cresce. */
const STEM_LENGTH = [0.42, 0.6, 0.8, 1]
/** Sem folha: a ponta da haste curta enrola, como semente que acabou de brotar. */
const CURL = 'M11.8 23 c 0.4 -1.9, 2.6 -2.8, 3.8 -1.7'
/** Cada folha é uma gota presa na haste; a origem (fração da caixa da folha) é o ponto de encaixe. */
const LEAVES = [
  { d: 'M11.9 25 C 13.6 21.4, 18 19.9, 21.5 21 C 19.6 24.6, 15.4 26.4, 11.9 25 Z', originX: 0, originY: 0.89 },
  { d: 'M11.7 19.5 C 10 15.9, 5.8 14.4, 2.5 15.5 C 4.4 19.1, 8.4 20.9, 11.7 19.5 Z', originX: 1, originY: 0.88 },
  { d: 'M12.8 12 C 13.9 9, 16.6 7.5, 19 7.5 C 18.2 10.4, 15.6 12.4, 12.8 12 Z', originX: 0, originY: 0.97 },
]
/** A primeira folha espera a haste chegar nela; as outras vêm em seguida. */
const LEAF_WAIT = 0.35
const LEAF_STAGGER = 0.12

interface SproutMarkProps {
  leaves: LeafCount
  /** desenha ao montar (senão o que já está lá aparece pronto) */
  draw?: boolean
  /** segundos antes de começar a desenhar */
  delay?: number
  className?: string
}

export function SproutMark({ leaves, draw = false, delay = 0, className }: SproutMarkProps) {
  const reduced = useReducedMotion() ?? false
  // quantas folhas tinha antes da última mudança (null: ainda o desenho inicial). O que passa
  // disso brota; se diminuiu (virou o dia), nada anima
  const [current, setCurrent] = useState(leaves)
  const [before, setBefore] = useState<number | null>(null)
  if (leaves !== current) {
    setBefore(current)
    setCurrent(leaves)
  }
  const fresh = before === null
  const shrinking = !fresh && leaves < before
  const isNew = (i: number) => i >= (before ?? leaves)
  // com `draw`, folha nova espera a haste chegar nela (também quando o dado chega no meio do desenho)
  const leafStart = draw ? delay + LEAF_WAIT : 0

  return (
    <svg className={[styles.mark, className].filter(Boolean).join(' ')} viewBox="0 0 24 32" aria-hidden="true" focusable="false">
      <motion.path
        d={STEM}
        className={styles.stem}
        initial={draw && !reduced ? { pathLength: 0 } : false}
        animate={{ pathLength: STEM_LENGTH[leaves] }}
        transition={reduced || shrinking ? { duration: 0 } : { duration: fresh ? 0.5 : 0.4, ease, delay: fresh ? delay : 0 }}
      />
      {leaves === 0 && (
        <motion.path
          d={CURL}
          className={styles.curl}
          initial={draw && !reduced && !shrinking ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25, ease, delay: leafStart }}
        />
      )}
      {LEAVES.slice(0, leaves).map((leaf, i) => {
        const grows = draw || isNew(i)
        const wait = leafStart + (i - (before ?? 0)) * LEAF_STAGGER
        return (
          <motion.path
            key={i}
            d={leaf.d}
            className={styles.leaf}
            style={{ originX: leaf.originX, originY: leaf.originY }}
            initial={!grows ? false : reduced ? { opacity: 0 } : { opacity: 0, pathLength: 0, scale: 0.6 }}
            animate={{ opacity: 1, pathLength: 1, scale: 1 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { opacity: { duration: 0.15, delay: wait }, pathLength: { duration: 0.4, ease, delay: wait }, scale: { ...spring.pop, delay: wait } }
            }
          />
        )
      })}
    </svg>
  )
}
