// O que o servidor decidiu depois da revisão, como anotação no caderno. O front só traduz o
// `outcome` em texto. Árvore adulta ganha o carimbo "ADULTA".
import { motion } from 'motion/react'
import { Stamp } from '../../components/Stamp'
import type { RatingResult } from '../../lib/api'
import { fadeUp } from '../../lib/motion'
import styles from './FocusScreen.module.css'

function describe({ outcome, points, plant_growth, plant_status }: RatingResult): [string, string] {
  switch (outcome) {
    case 'grew':
      return plant_status === 'grown'
        ? ['Sua planta ficou adulta!', 'Ela fica no jardim pra sempre. O próximo foco planta uma semente nova.']
        : [`+${points} de crescimento`, `A árvore está com ${plant_growth} de 10.`]
    case 'not_focused':
      return ['Valeu pela sinceridade', 'A árvore não cresceu, mas também não morreu. Isso conta pro seu selo de honestidade.']
    case 'daily_limit':
      return ['Limite do dia atingido', 'Você já fez 10 sessões hoje. Esta conta nas estatísticas, mas a árvore só cresce de novo amanhã.']
    default:
      return ['Sessão registrada', 'Essa árvore não estava mais crescendo, então nada mudou nela.']
  }
}

export function ResultSummary({ result }: { result: RatingResult }) {
  const [title, text] = describe(result)
  const adult = result.outcome === 'grew' && result.plant_status === 'grown'
  return (
    <motion.div
      className={styles.result}
      role="status"
      data-testid="rating-result"
      data-outcome={result.outcome ?? ''}
      variants={fadeUp}
      initial="hidden"
      animate="show"
    >
      <h2>{title}</h2>
      <p>{text}</p>
      {adult && (
        <Stamp tone="herb" className={styles.resultStamp}>
          Adulta
        </Stamp>
      )}
    </motion.div>
  )
}
