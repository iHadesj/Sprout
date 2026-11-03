// Tela de revisão: "Você focou de verdade?", como um formulário de registro com caixas de marcar.
// "Sim" envia direto; "mais ou menos" e "não" abrem a opção de marcar o que distraiu.
// Quem transforma a resposta em crescimento é o servidor, nunca esta tela.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Button } from '../../components/Button'
import { fadeUp, stagger } from '../../lib/motion'
import { DISTRACTION_OPTIONS, RATING_OPTIONS, type DistractionTag, type FocusRating } from './labels'
import styles from './ReviewScreen.module.css'

interface ReviewScreenProps {
  onSubmit: (rating: FocusRating, distraction: DistractionTag | null) => void
  /** Enquanto o servidor confere o tempo (ou salva a resposta), os botões ficam travados. */
  busy?: boolean
}

export function ReviewScreen({ onSubmit, busy = false }: ReviewScreenProps) {
  const [rating, setRating] = useState<FocusRating | null>(null)
  const [tag, setTag] = useState<DistractionTag | null>(null)

  function choose(value: FocusRating) {
    if (value === 'sim') onSubmit('sim', null)
    else setRating(value)
  }

  return (
    <section className={styles.review} aria-labelledby="review-title">
      <p className="kicker">Registro da sessão</p>
      <h2 id="review-title">
        Você focou <em>de verdade</em>?
      </h2>
      <p className={styles.lead}>Responda com sinceridade. Admitir que não focou não mata a árvore.</p>

      <motion.div className={styles.options} role="group" aria-label="Como foi o foco" variants={stagger(0.06, 0.1)} initial="hidden" animate="show">
        {RATING_OPTIONS.map((option) => {
          const selected = rating === option.value
          return (
            <motion.button
              variants={fadeUp}
              key={option.value}
              type="button"
              className={styles.option}
              data-rating={option.value}
              aria-pressed={selected}
              disabled={busy}
              onClick={() => choose(option.value)}
            >
              <span className={styles.box} aria-hidden="true">
                {selected && <Check size={15} strokeWidth={2.4} />}
              </span>
              <span className={styles.optionLabel}>{option.label}</span>
              <span className={styles.optionHint}>{option.hint}</span>
            </motion.button>
          )
        })}
      </motion.div>

      <AnimatePresence>
        {rating && (
          <motion.div
            className={styles.distraction}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
          >
            <p className="kicker">O que mais distraiu? (opcional)</p>
            <div className={styles.tags} role="group" aria-label="O que distraiu">
              {DISTRACTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.tag}
                  aria-pressed={tag === option.value}
                  onClick={() => setTag(tag === option.value ? null : option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button disabled={busy} onClick={() => onSubmit(rating, tag)}>
              Enviar resposta
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
