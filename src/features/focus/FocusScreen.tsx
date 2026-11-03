// Tela de foco de um jardim: cada fase do timerMachine vira uma ficha curta.
// - pronto: só o botão "Começar foco" (vindo da página principal, começa sozinho); se já tem
//   um foco rodando no servidor neste jardim e a página dele sumiu (iPhone recarregou a aba),
//   retoma sozinho; se a outra página está viva, oferece "Continuar aqui";
// - foco: uma etiqueta por cima da ilha em tela cheia, com o tempo e a régua de progresso;
// - revisão: "Você focou de verdade?"; pausa: o resultado e o tempo de descanso;
// - fim: o carimbo PERDIDA (desistiu) ou INVALIDADA (relógio mexido, tempo recusado).
// A cena do jardim fica no GardenLayout, atrás desta ficha.
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeftIcon } from '../../components/icons/arrow-left'
import { ArrowRightIcon } from '../../components/icons/arrow-right'
import { PlayIcon } from '../../components/icons/play'
import { Button, ButtonLink } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Stamp } from '../../components/Stamp'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useGardenContext } from '../gardens/gardenContext'
import { GiveUpButton } from './GiveUpButton'
import { END_REASON_TEXT } from './labels'
import { PendingReview } from './PendingReview'
import { useGardens } from '../gardens/queries'
import { useActiveSession, usePendingReview } from './queries'
import { ResultSummary } from './ResultSummary'
import { ReviewScreen } from './ReviewScreen'
import type { FocusRouteState } from './startFocus'
import { TimerLabel } from './TimerLabel'
import { canStart, remainingMs } from './timerMachine'
import { useFocusSession } from './useFocusSession'
import styles from './FocusScreen.module.css'

/** Sem heartbeat há mais que isso, a página que tinha o foco sumiu (o servidor espera 30 s entre eles). */
const STALE_HEARTBEAT_MS = 75_000

/** Cada ficha entra subindo um pouco e sai do mesmo jeito (sem desfoque nem escala). */
const panel = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transitionEnd: { transform: 'none' } },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.24, ease: [0.2, 0.7, 0.2, 1] as const },
}

export function FocusScreen() {
  const { garden } = useGardenContext()
  const focus = useFocusSession(garden)
  const { timer, session } = focus
  const active = useActiveSession()
  const pending = usePendingReview(garden.id)
  const now = useNow(1000, timer.phase === 'idle' && timer.nextFocusAt > 0)
  const waitMs = Math.max(0, timer.nextFocusAt - now)
  const location = useLocation()
  const navigate = useNavigate()

  const gardens = useGardens()
  // foco rodando no servidor que não é o desta aba: neste jardim (dá pra retomar aqui) ou em outro
  const live = active.data && active.data.id !== session?.id ? active.data : null
  const here = live?.garden_id === garden.id ? live : null
  const otherSession = Boolean(live) || focus.error?.code === 'SP002'
  const liveGardenName = gardens.data?.find((g) => g.id === live?.garden_id)?.name
  const pendingReview = pending.data && pending.data.id !== session?.id ? pending.data : null

  // a página que tinha esse foco sumiu (o iPhone recarregou a aba, heartbeat parado): retoma sozinho
  const resumed = useRef(false)
  const { resume } = focus
  useEffect(() => {
    if (!here || resumed.current || timer.phase !== 'idle') return
    if (Date.now() - Date.parse(here.last_heartbeat_at) < STALE_HEARTBEAT_MS) return
    resumed.current = true
    void resume(here)
  }, [here, timer.phase, resume])

  // veio do "Começar foco" da página principal: começa sozinho, se nada impedir
  const autostart = (location.state as FocusRouteState | null)?.autostart === true
  const tried = useRef(false)
  const { start } = focus
  useEffect(() => {
    if (!autostart || tried.current || !active.isSuccess || !pending.isSuccess) return
    tried.current = true
    navigate(location.pathname, { replace: true, state: null }) // recarregar a página não começa de novo
    if (!otherSession && !pendingReview && canStart(timer, performance.now())) void start()
  }, [autostart, active.isSuccess, pending.isSuccess, otherSession, pendingReview, timer, start, navigate, location.pathname])

  return (
    <div className={styles.focus} data-phase={timer.phase}>
      <AnimatePresence mode="wait">
        {timer.phase === 'idle' && (
          <motion.div key="idle" className={styles.sheet} {...panel}>
            <ButtonLink to=".." relative="path" variant="quiet" size="sm" icon={<ArrowLeftIcon size={15} />} className={styles.back}>
              {garden.name}
            </ButtonLink>
            {pendingReview ? (
              <PendingReview session={pendingReview} />
            ) : otherSession ? (
              <div className={styles.notice}>
                <h2>Tem uma sessão em andamento</h2>
                {here ? (
                  <>
                    <p>Esse foco está aberto em outra aba ou aparelho. Dá pra continuar ele aqui.</p>
                    <Button busy={focus.busy} onClick={() => void focus.resume(here)} icon={<PlayIcon size={17} />}>
                      Continuar aqui
                    </Button>
                  </>
                ) : (
                  <>
                    <p>{liveGardenName ? `O foco está rolando em ${liveGardenName}.` : 'Ela está aberta em outra aba ou aparelho.'} Só dá pra ter um de cada vez.</p>
                    {live && (
                      <ButtonLink to={`/jardim/${live.garden_id}/foco`} icon={<ArrowRightIcon size={16} />}>
                        Ir pra ele
                      </ButtonLink>
                    )}
                  </>
                )}
                <Button variant="danger" size="sm" busy={focus.busy} onClick={focus.endOtherSession}>
                  Encerrar a outra sessão
                </Button>
              </div>
            ) : (
              <div className={styles.ready}>
                <h2>{garden.name}</h2>
                <p className={styles.lead}>
                  <span className="mono">{garden.focus_minutes} min</span> de foco · <span className="mono">{garden.break_minutes} min</span> de pausa
                </p>
                {focus.error && (
                  <p className={styles.error} role="alert">
                    {focus.error.message}
                  </p>
                )}
                <Button size="lg" disabled={waitMs > 0} busy={focus.busy} onClick={focus.start} icon={<PlayIcon size={17} />}>
                  {waitMs > 0 ? `Próximo foco em ${Math.ceil(waitMs / 1000)} s` : 'Começar foco'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {timer.phase === 'focus' && (
          <motion.div key="focus" className={styles.label} {...panel}>
            <p className={styles.labelGarden}>{garden.name}</p>
            <TimerLabel tone="focus" progress={remainingMs(timer) / timer.focusMs} label={formatClock(remainingMs(timer))} caption={`de ${garden.focus_minutes} min`} />
            <p className={styles.note}>Pode usar outros apps. Só não feche esta aba.</p>
            <GiveUpButton onConfirm={focus.giveUp} />
          </motion.div>
        )}

        {timer.phase === 'review' && (
          <motion.div key="review" className={`${styles.sheet} ${styles.card}`} {...panel}>
            {session?.status === 'active' && !focus.syncError && (
              <p className={styles.note} role="status">
                Conferindo o tempo…
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
              <TimerLabel
                tone="break"
                progress={remainingMs(timer) / timer.breakTotalMs}
                label={formatClock(remainingMs(timer))}
                caption={timer.breakTotalMs > timer.breakMs ? 'pausa longa' : 'pausa'}
              />
              <Button variant="secondary" icon={<ArrowRightIcon size={16} />} onClick={focus.skipBreak}>
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
