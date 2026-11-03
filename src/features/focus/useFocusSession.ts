// Controla o ciclo do foco: faz o relógio andar (TICK), liga o heartbeat e a proteção de
// saída da página, e conversa com o servidor nas mudanças de fase.
// Sair da aba não conta: o relógio e o heartbeat rodam num worker, que segue batendo com o
// Sprout em segundo plano, e no fim uma notificação chama a pessoa de volta.
// O front só relata o que aconteceu; quem decide se a sessão vale é o servidor.
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  ApiError,
  failSession,
  finishSession,
  getActiveSession,
  invalidateSession,
  rateSession,
  startSession,
  type FocusSession,
  type Garden,
  type ReportedFailReason,
} from '../../lib/api'
import { setBackgroundInterval } from '../../lib/backgroundClock'
import { playChime, primeChime } from '../../lib/chime'
import { formatClock } from '../../lib/format'
import { askNotifyPermission, notify } from '../../lib/notify'
import { useWakeLock } from '../../lib/useWakeLock'
import { useFocusStore } from '../../stores/focusStore'
import { useAuth } from '../auth/authContext'
import type { DistractionTag, FocusRating } from './labels'
import { sessionKeys } from './queries'
import { canStart, remainingMs, type FailReason, type InvalidReason, type TimerState } from './timerMachine'
import { useHeartbeat } from './useHeartbeat'
import { usePageExitGuard } from './usePageExitGuard'

const TICK_MS = 250
const FINISH_ATTEMPTS = 4
/** Ao retomar, conta uns segundos a menos (relógio do celular x do servidor): concluir cedo invalidaria. */
const RESUME_MARGIN_MS = 15_000

export function useFocusSession(garden: Garden) {
  const timer = useFocusStore((s) => s.timer)
  const session = useFocusStore((s) => s.session)
  const result = useFocusStore((s) => s.result)
  const syncError = useFocusStore((s) => s.syncError)
  const dispatch = useFocusStore((s) => s.dispatch)
  const { session: auth } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const phase = timer.phase
  const activeId = phase === 'focus' ? (session?.id ?? null) : null

  useTicker(phase === 'focus' || phase === 'break')
  useHeartbeat(activeId, () => dispatch({ type: 'FAIL', reason: 'ended_elsewhere' }))
  const blocker = usePageExitGuard(activeId, auth?.access_token ?? null)
  useWakeLock(phase === 'focus')
  useDocumentTitle(timer)

  // toda vez que a fase de foco termina (tempo acabou, falhou, relógio mexido), relata ao servidor.
  // subscribe chama uma vez por mudança de estado, então cada transição é relatada uma vez só.
  useEffect(
    () =>
      useFocusStore.subscribe((state, prev) => {
        // sininho quando o foco acaba e quando a pausa termina sozinha (pular não toca)
        const from = prev.timer
        if (from.phase === 'focus' && state.timer.phase === 'review') {
          playChime()
          notify('Foco concluído', 'Volte pro Sprout e conte se focou de verdade.')
        }
        if (from.phase === 'break' && state.timer.phase === 'idle' && from.elapsedMs >= from.breakTotalMs - 1_500) {
          playChime()
          notify('A pausa acabou', 'Quando quiser, comece o próximo foco.')
        }

        if (from.phase !== 'focus' || state.timer.phase === 'focus' || !state.session) return
        void reportFocusEnd(state.timer, state.session.id, queryClient)
      }),
    [queryClient],
  )

  const start = useCallback(async () => {
    if (!canStart(useFocusStore.getState().timer, performance.now())) return
    primeChime() // o clique libera o áudio pro sininho do fim
    askNotifyPermission()
    setBusy(true)
    setError(null)
    try {
      const started = await startSession(garden.id)
      const store = useFocusStore.getState()
      store.setSession(started)
      store.setResult(null)
      store.setSyncError(null)
      // a duração vem do servidor (planned_minutes), não do formulário
      store.dispatch({
        type: 'START',
        now: performance.now(),
        wallNow: Date.now(),
        focusMs: started.planned_minutes * 60_000,
        breakMs: garden.break_minutes * 60_000,
      })
      void queryClient.invalidateQueries({ queryKey: ['plants'] }) // pode ter nascido uma semente
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }, [garden.id, garden.break_minutes, queryClient])

  const rate = useCallback(
    async (rating: FocusRating, distraction: DistractionTag | null) => {
      const current = useFocusStore.getState().session
      if (!current || current.status !== 'completed') return
      setBusy(true)
      setError(null)
      try {
        const outcome = await rateSession(current.id, rating, distraction)
        const store = useFocusStore.getState()
        store.setResult(outcome)
        store.setSession({ ...current, focus_rating: rating, growth_points: outcome.points })
        store.dispatch({ type: 'RATED', now: performance.now(), wallNow: Date.now() })
        await queryClient.invalidateQueries({ queryKey: ['plants'] })
        await queryClient.invalidateQueries({ queryKey: ['sessions'] })
        await queryClient.invalidateQueries({ queryKey: ['stats'] })
      } catch (e) {
        setError(toApiError(e))
      } finally {
        setBusy(false)
      }
    },
    [queryClient],
  )

  /**
   * Retoma um foco que já estava rodando no servidor: a aba recarregou (o iPhone faz isso com o
   * Safari no fundo) ou a pessoa pediu pra continuar aqui. O tempo vem do started_at do servidor.
   */
  const resume = useCallback(
    async (row: FocusSession) => {
      if (useFocusStore.getState().timer.phase !== 'idle') return
      primeChime()
      // confere no servidor: a sessão guardada pode já ter acabado
      setBusy(true)
      const fresh = await getActiveSession().catch(() => null)
      setBusy(false)
      const store = useFocusStore.getState()
      if (!fresh || fresh.id !== row.id) {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.active })
        return
      }
      if (store.timer.phase !== 'idle') return
      row = fresh
      store.setSession(row)
      store.setResult(null)
      store.setSyncError(null)
      store.dispatch({
        type: 'RESUME',
        now: performance.now(),
        wallNow: Date.now(),
        elapsedMs: Math.max(0, Date.now() - Date.parse(row.started_at) - RESUME_MARGIN_MS),
        focusMs: row.planned_minutes * 60_000,
        breakMs: garden.break_minutes * 60_000,
      })
    },
    [garden.break_minutes, queryClient],
  )

  /** O servidor não respondeu ao concluir: tenta de novo (o servidor aceita até 2 h depois do fim). */
  const retryFinish = useCallback(() => {
    const store = useFocusStore.getState()
    if (store.session?.status !== 'active') return
    store.setSyncError(null)
    void finishWithRetry(store.session.id)
  }, [])

  /** Encerra uma sessão ativa em outra aba ou dispositivo (a planta dela morre). */
  const endOtherSession = useCallback(async () => {
    setBusy(true)
    try {
      const other = await getActiveSession()
      if (other) await failSession(other.id, 'gave_up')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: sessionKeys.active })
      await queryClient.invalidateQueries({ queryKey: ['plants'] })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }, [queryClient])

  const giveUp = useCallback(() => dispatch({ type: 'GIVE_UP' }), [dispatch])
  const skipBreak = useCallback(() => dispatch({ type: 'SKIP_BREAK' }), [dispatch])
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    setError(null)
  }, [dispatch])

  /** Navegação bloqueada durante o foco: a pessoa confirmou que quer sair (e desistir). */
  const leaveAndGiveUp = useCallback(() => {
    dispatch({ type: 'GIVE_UP' })
    blocker.proceed?.()
  }, [dispatch, blocker])

  return {
    timer,
    session,
    result,
    syncError,
    busy,
    error,
    blocker,
    start,
    resume,
    rate,
    retryFinish,
    endOtherSession,
    giveUp,
    skipBreak,
    reset,
    leaveAndGiveUp,
  }
}

function useTicker(active: boolean) {
  const dispatch = useFocusStore((s) => s.dispatch)
  // a máquina mede pelo horário, não pela contagem de TICKs: um atraso não muda o tempo
  useEffect(() => {
    if (!active) return
    // a página ficou escondida desde o último TICK? (no celular ela congela no fundo e o
    // relógio monotônico pode parar: a máquina então se acerta pelo relógio do sistema)
    let hidden = document.visibilityState === 'hidden'
    const onHide = () => {
      if (document.visibilityState === 'hidden') hidden = true
    }
    const onFreeze = () => (hidden = true)
    document.addEventListener('visibilitychange', onHide)
    document.addEventListener('freeze', onFreeze)
    window.addEventListener('pagehide', onFreeze)
    const stop = setBackgroundInterval(() => {
      dispatch({ type: 'TICK', now: performance.now(), wallNow: Date.now(), resumed: hidden })
      if (document.visibilityState === 'visible') hidden = false
    }, TICK_MS)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onHide)
      document.removeEventListener('freeze', onFreeze)
      window.removeEventListener('pagehide', onFreeze)
    }
  }, [active, dispatch])
}

async function reportFocusEnd(timer: TimerState, sessionId: string, queryClient: QueryClient) {
  try {
    if (timer.phase === 'review') {
      await finishWithRetry(sessionId)
    } else if (timer.phase === 'failed' && isReportable(timer.endReason)) {
      await failSession(sessionId, timer.endReason)
    } else if (timer.phase === 'invalid') {
      await invalidateSession(sessionId)
    }
  } catch {
    // se nem isso chegar, o servidor abandona a sessão sozinho (passou do prazo sem heartbeat)
  } finally {
    void queryClient.invalidateQueries({ queryKey: ['plants'] })
    void queryClient.invalidateQueries({ queryKey: ['stats'] })
    // a "sessão ativa" guardada ficou velha: sem isto a tela poderia tentar retomar ela
    void queryClient.invalidateQueries({ queryKey: sessionKeys.active })
  }
}

/** Motivos que a máquina produz e o servidor aceita ("ended_elsewhere" o servidor já sabe). */
function isReportable(reason: TimerState['endReason']): reason is Extract<FailReason, ReportedFailReason> {
  return reason === 'gave_up'
}

/** Pede pro servidor concluir a sessão e acata o veredito: concluída ou inválida. */
async function finishWithRetry(sessionId: string) {
  const store = useFocusStore.getState()
  for (let attempt = 1; ; attempt++) {
    try {
      const done = await finishSession(sessionId)
      store.setSession(done)
      if (done.status === 'invalid') {
        store.dispatch({ type: 'INVALIDATE', reason: (done.fail_reason ?? 'bad_timing') as InvalidReason })
      }
      return
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SP003') {
        store.dispatch({ type: 'FAIL', reason: 'ended_elsewhere' })
        return
      }
      if (attempt >= FINISH_ATTEMPTS) {
        store.setSyncError('Não deu pra confirmar a sessão com o servidor.')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    }
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  return new ApiError(e instanceof Error ? e.message : 'Erro desconhecido')
}

/** Título da aba: o tempo restante (dá pra ver de relance na barra de abas). */
function useDocumentTitle(timer: TimerState) {
  let title = 'Sprout'
  if (timer.phase === 'focus') title = `${formatClock(remainingMs(timer))} · Foco · Sprout`
  else if (timer.phase === 'review') title = 'Foco concluído · Sprout'
  else if (timer.phase === 'break') title = `${formatClock(remainingMs(timer))} · Pausa · Sprout`

  useEffect(() => {
    document.title = title
  }, [title])
  useEffect(() => () => void (document.title = 'Sprout'), [])
}
