// "Sprout" com o broto saindo do "t". O texto continua texto (é o nome acessível e dá pra
// selecionar); o broto é enfeite por cima. O tamanho vem da fonte do pai.
import { SproutMark } from './SproutMark'
import type { LeafCount } from './sproutLeaves'
import styles from './Wordmark.module.css'

interface WordmarkProps {
  leaves: LeafCount
  draw?: boolean
  className?: string
}

export function Wordmark({ leaves, draw, className }: WordmarkProps) {
  return (
    <span className={[styles.wordmark, className].filter(Boolean).join(' ')}>
      Sprou
      <span className={styles.t}>
        t<SproutMark leaves={leaves} draw={draw} />
      </span>
    </span>
  )
}
