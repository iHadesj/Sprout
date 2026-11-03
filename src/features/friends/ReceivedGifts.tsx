// Bilhete de presentes recebidos (regar e corações), em cima da prancha em destaque.
// A animação toca na ilha; aqui fica quem mandou e o "ver de novo".
import { motion } from 'motion/react'
import { HeartIcon } from '../../components/icons/heart'
import type { Line } from './useReceivedGifts'
import styles from './ReceivedGifts.module.css'

function sentence({ from, water, hearts }: Line) {
  const love = hearts > 0 && `mandou ${hearts} ${hearts === 1 ? 'coração' : 'corações'}`
  if (water && love) return `${from} regou seu jardim e ${love}`
  if (water) return `${from} regou seu jardim`
  return `${from} ${love}`
}

export function GiftNote({ lines, onReplay }: { lines: Line[]; onReplay: () => void }) {
  return (
    <motion.aside
      className={styles.note}
      aria-label="Presentes recebidos"
      initial={{ opacity: 0, y: -10, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -0.8 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <span className={styles.icon} aria-hidden="true">
        <HeartIcon size={16} filled />
      </span>
      <div className={styles.body}>
        <p className="kicker">Chegou presente</p>
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line.from}>{sentence(line)}</li>
          ))}
        </ul>
      </div>
      <button type="button" className={styles.replay} onClick={onReplay}>
        ver de novo
      </button>
    </motion.aside>
  )
}
