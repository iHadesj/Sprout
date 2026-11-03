// Bilhete de presentes recebidos (regar, corações, flores, aplausos, chamados) e dos seus
// chamados que alguém atendeu. A animação toca na ilha; aqui fica quem mandou e o "ver de novo".
import { motion } from 'motion/react'
import { HeartIcon } from '../../components/icons/heart'
import { spring } from '../../lib/motion'
import type { Line } from './useReceivedGifts'
import styles from './ReceivedGifts.module.css'

/** "a, b e c" */
function joinAll(parts: string[]) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

function sentence({ from, water, hearts, flowers, claps, seed }: Line) {
  const parts: string[] = []
  if (water) parts.push('regou seu jardim')
  if (hearts > 0) parts.push(`mandou ${hearts} ${hearts === 1 ? 'coração' : 'corações'}`)
  if (flowers.length) parts.push(`plantou ${flowers.length === 1 ? 'uma flor' : `${flowers.length} flores`} em ${joinAll([...new Set(flowers)])}`)
  if (claps.length) parts.push(claps.length === 1 ? `aplaudiu ${claps[0]}` : `aplaudiu ${claps.length} conquistas suas`)
  if (seed) parts.push('te chamou pra focar')
  return `${from} ${joinAll(parts)}`
}

interface GiftNoteProps {
  lines: Line[]
  answered: { who: string; minutes: number }[]
  onReplay: () => void
}

export function GiftNote({ lines, answered, onReplay }: GiftNoteProps) {
  return (
    <motion.aside
      className={styles.note}
      aria-label="Presentes recebidos"
      initial={{ opacity: 0, y: -16, rotate: -5 }}
      animate={{ opacity: 1, y: 0, rotate: -1.5 }}
      transition={{ ...spring.pop, delay: 0.3 }}
    >
      <span className={styles.icon} aria-hidden="true">
        <HeartIcon size={16} filled />
      </span>
      <ul className={styles.lines}>
        {lines.map((line) => (
          <li key={line.from}>{sentence(line)}</li>
        ))}
        {answered.map((a) => (
          <li key={`r${a.who}`}>
            {a.who} atendeu seu chamado e focou <span className="mono">{a.minutes} min</span>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <button type="button" className={styles.replay} onClick={onReplay}>
          ver de novo
        </button>
      )}
    </motion.aside>
  )
}
