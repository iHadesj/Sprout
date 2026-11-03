// Tela de foco de um jardim: cada fase do timerMachine vira uma ficha do caderno.
// - pronto: "Protocolo da sessão" (as regras numeradas) e "Começar foco";
// - foco: uma etiqueta por cima da ilha em tela cheia, com o tempo e a régua de progresso;
// - revisão: "Registro da sessão"; pausa: a anotação do resultado e o tempo de descanso;
// - fim: o carimbo PERDIDA (desistiu) ou INVALIDADA (relógio mexido, tempo recusado).
// A cena do jardim fica no GardenLayout, atrás desta ficha.
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftIcon } from '../../components/icons/arrow-left'
import { ArrowRightIcon } from '../../components/icons/arrow-right'
import { PlayIcon } from '../../components/icons/play'
import { Button, ButtonLink } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Stamp } from '../../components/Stamp'
import { formatClock } from '../../lib/format'
import { fadeUp, stagger } from '../../lib/motion'
import { useNow } from '../../lib/useNow'
import { useGardenContext } from '../gardens/gardenContext'
import { GiveUpButton } from './GiveUpButton'
import { END_REASON_TEXT } from './labels'
import { PendingReview } from './PendingReview'
import { useActiveSession, usePendingReview } from './queries'
import { ResultSummary } from './ResultSummary'
import { ReviewScreen } from './ReviewScreen'
import { TimerLabel } from './TimerLabel'
import { remainingMs } from './timerMachine'
import { useFocusSession } from './useFocusSession'
import styles from './FocusScreen.module.css'

/** Cada ficha entra subindo um pouco e sai do mesmo jeito (sem desfoque nem escala). */
const panel = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transitionEnd: { transform: 'none' } },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.24, ease: [0.2, 0.7, 0.2, 1] as const },
}

const RULES = [
  'Pode usar outros apps e páginas (VS Code, PDF, aula): o tempo continua contando.',
  'Deixe esta aba aberta. Fechar ou desistir mata a árvore da vez.',
  'No fim, você conta se focou de verdade.',
]

export function FocusScreen() {
  const { garden } = useGardenContext()
  const focus = useFocusSession(garden)
  const { timer, session } = focus
  const active = useActiveSession()
  const pending = usePendingReview(garden.id)
  const now = useNow(1000, timer.phase === 'idle' && timer.nextFocusAt > 0)
  const waitMs = Math.max(0, timer.nextFocusAt - now)

  const otherSession = (active.data && active.data.id !== session?.id) || focus.error?.code === 'SP002'
  const pendingReview = pending.data && pending.data.id !== session?.id ? pending.data : null

  return (
    <div className={styles.focus} data-phase={timer.phase}>
      <AnimatePresence mode="wait">
        {timer.phase === 'idle' && (
          <motion.div key="idle" className={styles.sheet} {...panel}>
            <ButtonLink to=".." relative="path" variant="quiet" size="sm" icon={<ArrowLeftIcon size={15} strokeWidth={1.7} />} className={styles.back}>
              {garden.name}
            </ButtonLink>
            {pendingReview ? (
              <PendingReview session={pendingReview} />
            ) : otherSession ? (
              <div className={styles.notice}>
                <p className="kicker">Atenção</p>
                <h2>Tem uma sessão em andamento</h2>
                <p>Ela está aberta em outra aba ou dispositivo, e só dá pra ter uma de cada vez.</p>
                <Button variant="danger" busy={focus.busy} onClick={focus.endOtherSession}>
                  Encerrar a outra sessão
                </Button>
                <p className={styles.note}>Encerrar mata a árvore daquela sessão.</p>
              </div>
            ) : (
              <motion.div className={styles.ready} variants={stagger(0.06, 0.1)} initial="hidden" animate="show">
                <motion.p className="kicker" variants={fadeUp}>
                  Protocolo da sessão
                </motion.p>
                <motion.h2 variants={fadeUp}>
                  Pronto pra <em>focar</em>?
                </motion.h2>
                <motion.p className={styles.lead} variants={fadeUp}>
                  <span className="mono">{garden.focus_minutes} min</span> de foco, sem pausa no meio. Depois,{' '}
                  <span className="mono">{garden.break_minutes} min</span> de descanso.
                </motion.p>
                <motion.ol className={styles.protocol} variants={fadeUp}>
                  {RULES.map((rule, i) => (
                    <li key={rule}>
                      <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </motion.ol>
                {focus.error && (
                  <p className={styles.error} role="alert">
                    {focus.error.message}
                  </p>
                )}
                <motion.div variants={fadeUp}>
                  <Button size="lg" disabled={waitMs > 0} busy={focus.busy} onClick={focus.start} icon={<PlayIcon size={17} strokeWidth={1.8} />}>
                    {waitMs > 0 ? `Próximo foco em ${Math.ceil(waitMs / 1000)} s` : 'Começar foco'}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}

        {timer.phase === 'focus' && (
          <motion.div key="focus" className={styles.label} {...panel}>
            <p className="kicker">Em foco · {garden.name}</p>
            <TimerLabel tone="focus" progress={remainingMs(timer) / timer.focusMs} label={formatClock(remainingMs(timer))} caption={`de ${garden.focus_minutes} min`} />
            <p className={styles.note}>Pode ir pro outro app. Quando acabar, o Sprout te avisa.</p>
            <GiveUpButton onConfirm={focus.giveUp} />
          </motion.div>
        )}

        {timer.phase === 'review' && (
          <motion.div key="review" className={`${styles.sheet} ${styles.card}`} {...panel}>
            {session?.status === 'active' && !focus.syncError && (
              <p className={styles.note} role="status">
                Conferindo o tempo com o servidor…
              </p>
            )}
            {focus.syncError && (
              <div className={styles.notice}>
                <p role="alert">{focus.syncError}</p>
                <Button onClick={focus.retryFinish}>Tentar de novo</Button>
              </div>
            )}
            <ReviewScreen busy={focus.busy || session?.status !== 'completed'} onSubmit={focus.rate} />
            {focus.error && (
              <p className={styles.error} role="alert">
                {focus.error.message}
              </p>
            )}
          </motion.div>
        )}

        {timer.phase === 'break' && (
          <motion.div key="break" className={styles.sheet} {...panel}>
            {focus.result && <ResultSummary result={focus.result} />}
            <div className={styles.breakBox}>
              <p className="kicker">{timer.breakTotalMs > timer.breakMs ? 'Pausa longa' : 'Pausa'}</p>
              <TimerLabel tone="break" progress={remainingMs(timer) / timer.breakTotalMs} label={formatClock(remainingMs(timer))} caption="levante, beba água, olhe pra longe" />
              <Button variant="secondary" icon={<ArrowRightIcon size={16} strokeWidth={1.7} />} onClick={focus.skipBreak}>
                Pular pausa
              </Button>
            </div>
          </motion.div>
        )}

        {(timer.phase === 'failed' || timer.phase === 'invalid') && (
          <motion.div key="ended" className={styles.sheet} data-testid="session-ended" {...panel}>
            <Stamp tone={timer.phase === 'failed' ? 'stamp' : 'sepia'} className={styles.endStamp}>
              {timer.phase === 'failed' ? 'Perdida' : 'Invalidada'}
            </Stamp>
            <h2>{timer.phase === 'failed' ? 'A planta morreu' : 'Sessão inválida'}</h2>
            {timer.endReason && <p className={styles.lead}>{END_REASON_TEXT[timer.endReason]}</p>}
            <p className={styles.note}>
              {timer.phase === 'failed'
                ? 'Ela fica seca no jardim, como lembrança. O próximo foco planta uma semente nova.'
                : 'Sessão inválida não faz a árvore crescer, mas também não a mata.'}
            </p>
            <div>
              <Button onClick={focus.reset}>Voltar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={focus.blocker.state === 'blocked'} title="Sair do foco?" onClose={() => focus.blocker.reset?.()}>
        <p className={styles.dialogText}>Sair agora conta como desistir: a árvore desta sessão morre.</p>
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={() => focus.blocker.reset?.()}>
            Continuar focando
          </Button>
          <Button variant="danger" onClick={focus.leaveAndGiveUp}>
            Sair e desistir
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
