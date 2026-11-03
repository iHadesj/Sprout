// Sessão concluída cuja revisão ficou sem resposta (a aba fechou antes). Responder ainda vale:
// o tempo já foi conferido pelo servidor no finish_session; a resposta não tem prazo.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rateSession, type FocusSession } from '../../lib/api'
import type { DistractionTag, FocusRating } from './labels'
import { ResultSummary } from './ResultSummary'
import { ReviewScreen } from './ReviewScreen'
import styles from './FocusScreen.module.css'

export function PendingReview({ session }: { session: FocusSession }) {
  const queryClient = useQueryClient()
  const rate = useMutation({
    mutationFn: (answer: { rating: FocusRating; distraction: DistractionTag | null }) =>
      rateSession(session.id, answer.rating, answer.distraction),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plants'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      // marca como velha sem buscar já: assim o resultado continua na tela até sair dela
      await queryClient.invalidateQueries({ queryKey: ['sessions'], refetchType: 'none' })
    },
  })

  if (rate.data) return <ResultSummary result={rate.data} />

  return (
    <div className={styles.pending}>
      <p className={styles.note}>Sua última sessão terminou, mas faltou responder a revisão.</p>
      <ReviewScreen busy={rate.isPending} onSubmit={(rating, distraction) => rate.mutate({ rating, distraction })} />
      {rate.error && (
        <p className={styles.error} role="alert">
          {rate.error.message}
        </p>
      )}
    </div>
  )
}
