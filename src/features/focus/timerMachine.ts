// Máquina de estados do pomodoro como função pura: (estado, evento) => próximo estado.
// Não conhece React, servidor nem relógio do sistema: todo horário chega dentro do evento.
// `now` é performance.now() (monotônico, não muda se mexerem no relógio do PC) e
// `wallNow` é Date.now() (relógio do sistema). Comparar os dois é o que pega trapaça.
//
// Sair da aba não conta: dá pra focar em outro app (VS Code, PDF, outra página). O que vale
// é o tempo medido pelo servidor e a resposta honesta no fim.
/** Divergência máxima aceita entre Date.now() e performance.now(). */
export const CLOCK_TOLERANCE_MS = 2_000
/** Depois de uma pausa pulada, o próximo foco só começa 1 min após o fim do anterior. */
export const MIN_GAP_MS = 60_000
export const LONG_BREAK_EVERY = 4
export const LONG_BREAK_MS = 15 * 60_000

export type Phase = 'idle' | 'focus' | 'review' | 'break' | 'failed' | 'invalid'

/** A sessão falhou: a planta morre. */
export type FailReason = 'gave_up' | 'ended_elsewhere'
/** A sessão foi invalidada: não cresce nem morre. */
export type InvalidReason = 'clock_changed' | 'bad_timing' | 'no_heartbeat'

export interface TimerState {
  phase: Phase
  /** Duração do foco e da pausa curta desta sessão. */
  focusMs: number
  breakMs: number
  /** Início da fase atual (performance.now()). */
  phaseStartedAt: number
  /** Date.now() no início do foco, pra comparar com o relógio monotônico. */
  wallStartedAt: number
  /** Tempo decorrido na fase atual, atualizado a cada TICK. */
  elapsedMs: number
  /** Duração da pausa em andamento (curta ou longa). */
  breakTotalMs: number
  /** Focos concluídos desde que o app abriu; a cada 4, pausa longa. */
  completedFocuses: number
  /** O próximo foco só pode começar a partir deste instante (performance.now()). */
  nextFocusAt: number
  endReason: FailReason | InvalidReason | null
}

export type TimerEvent =
  | { type: 'START'; now: number; wallNow: number; focusMs: number; breakMs: number }
  | { type: 'TICK'; now: number; wallNow: number }
  | { type: 'GIVE_UP' }
  | { type: 'FAIL'; reason: FailReason }
  | { type: 'INVALIDATE'; reason: InvalidReason }
  | { type: 'RATED'; now: number }
  | { type: 'SKIP_BREAK' }
  | { type: 'RESET' }

export function initialTimerState(): TimerState {
  return {
    phase: 'idle',
    focusMs: 25 * 60_000,
    breakMs: 5 * 60_000,
    phaseStartedAt: 0,
    wallStartedAt: 0,
    elapsedMs: 0,
    breakTotalMs: 0,
    completedFocuses: 0,
    nextFocusAt: 0,
    endReason: null,
  }
}

export function timerReducer(state: TimerState, event: TimerEvent): TimerState {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'START' && canStart(state, event.now)) {
        return {
          ...state,
          phase: 'focus',
          focusMs: event.focusMs,
          breakMs: event.breakMs,
          phaseStartedAt: event.now,
          wallStartedAt: event.wallNow,
          elapsedMs: 0,
          endReason: null,
        }
      }
      return state

    case 'focus':
      return focusReducer(state, event)

    case 'review':
      // o foco acabou; aqui só falta a resposta (ou o servidor recusar o tempo)
      if (event.type === 'RATED') return startBreak(state, event.now)
      if (event.type === 'INVALIDATE') return end(state, 'invalid', event.reason)
      if (event.type === 'FAIL') return end(state, 'failed', event.reason)
      return state

    case 'break':
      if (event.type === 'TICK') {
        const elapsedMs = event.now - state.phaseStartedAt
        return elapsedMs >= state.breakTotalMs ? toIdle(state) : { ...state, elapsedMs }
      }
      if (event.type === 'SKIP_BREAK') return toIdle(state)
      return state

    case 'failed':
    case 'invalid':
      return event.type === 'RESET' ? toIdle(state) : state
  }
}

function focusReducer(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'TICK': {
      // os dois relógios andam juntos; se divergirem, mexeram no relógio do sistema
      const wallElapsed = event.wallNow - state.wallStartedAt
      const monoElapsed = event.now - state.phaseStartedAt
      if (Math.abs(wallElapsed - monoElapsed) > CLOCK_TOLERANCE_MS) {
        return end(state, 'invalid', 'clock_changed')
      }
      return advance(state, event.now)
    }
    case 'GIVE_UP':
      return end(state, 'failed', 'gave_up')
    case 'FAIL':
      return end(state, 'failed', event.reason)
    case 'INVALIDATE':
      return end(state, 'invalid', event.reason)
    default:
      return state
  }
}

/** Avança o foco até `now`: vai pra revisão se o tempo acabou. */
function advance(state: TimerState, now: number): TimerState {
  if (now >= state.phaseStartedAt + state.focusMs) {
    return { ...state, phase: 'review', elapsedMs: state.focusMs }
  }
  return { ...state, elapsedMs: now - state.phaseStartedAt }
}

function startBreak(state: TimerState, now: number): TimerState {
  const completedFocuses = state.completedFocuses + 1
  const isLong = completedFocuses % LONG_BREAK_EVERY === 0
  return {
    ...state,
    phase: 'break',
    completedFocuses,
    phaseStartedAt: now,
    elapsedMs: 0,
    breakTotalMs: isLong ? Math.max(LONG_BREAK_MS, state.breakMs) : state.breakMs,
    nextFocusAt: now + MIN_GAP_MS,
  }
}

function end(state: TimerState, phase: 'failed' | 'invalid', reason: FailReason | InvalidReason): TimerState {
  return { ...state, phase, endReason: reason }
}

function toIdle(state: TimerState): TimerState {
  return { ...state, phase: 'idle', elapsedMs: 0, endReason: null }
}

export function canStart(state: TimerState, now: number): boolean {
  return state.phase === 'idle' && now >= state.nextFocusAt
}

/** Quanto falta pra acabar a fase atual (foco ou pausa). */
export function remainingMs(state: TimerState): number {
  if (state.phase === 'focus') return Math.max(0, state.focusMs - state.elapsedMs)
  if (state.phase === 'break') return Math.max(0, state.breakTotalMs - state.elapsedMs)
  return 0
}
