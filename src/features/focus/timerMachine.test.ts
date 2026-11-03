import { describe, expect, it } from 'vitest'
import {
  LONG_BREAK_MS,
  MIN_GAP_MS,
  canStart,
  initialTimerState,
  remainingMs,
  timerReducer,
  type TimerEvent,
  type TimerState,
} from './timerMachine'

const MIN = 60_000
const FOCUS = 25 * MIN
const BREAK = 5 * MIN
// relógios "de mentira": o monotônico começa em 1000 e o do sistema numa data qualquer
const T0 = 1_000
const WALL0 = Date.UTC(2026, 9, 22, 12, 0, 0)

function run(state: TimerState, ...events: TimerEvent[]): TimerState {
  return events.reduce(timerReducer, state)
}

/** Foco recém-começado em T0. */
function focusing(): TimerState {
  return run(initialTimerState(), { type: 'START', now: T0, wallNow: WALL0, focusMs: FOCUS, breakMs: BREAK })
}

/** TICK com os dois relógios andando juntos (ninguém mexeu em nada). */
function tick(ms: number): TimerEvent {
  return { type: 'TICK', now: T0 + ms, wallNow: WALL0 + ms }
}

describe('foco em segundo plano (VS Code, outra página)', () => {
  it('aba congelada por minutos (sem TICK) continua no foco', () => {
    const s = run(focusing(), tick(1_000), tick(12 * MIN))
    expect(s.phase).toBe('focus')
    expect(remainingMs(s)).toBe(FOCUS - 12 * MIN)
  })

  it('o primeiro TICK depois do fim, mesmo atrasado, leva pra revisão', () => {
    const s = run(focusing(), tick(2 * MIN), tick(FOCUS + 50_000))
    expect(s.phase).toBe('review')
    expect(s.elapsedMs).toBe(FOCUS)
  })
})

describe('celular: navegador no fundo congela a página', () => {
  // no iPhone o relógio monotônico pode parar enquanto a página está congelada
  const resumed = (mono: number, wall: number): TimerEvent => ({ type: 'TICK', now: T0 + mono, wallNow: WALL0 + wall, resumed: true })

  it('voltar depois de 10 min (monotônico parado) não invalida e o timer se acerta pelo relógio do sistema', () => {
    const s = run(focusing(), tick(1_000), resumed(1_250, 10 * MIN))
    expect(s.phase).toBe('focus')
    expect(remainingMs(s)).toBe(FOCUS - 10 * MIN)
    // e os TICKs seguintes, com a página à vista, continuam batendo
    const next = run(s, { type: 'TICK', now: T0 + 1_500, wallNow: WALL0 + 10 * MIN + 250 })
    expect(next.phase).toBe('focus')
  })

  it('voltar depois do fim leva pra revisão', () => {
    const s = run(focusing(), tick(1_000), resumed(1_250, FOCUS + 4 * MIN))
    expect(s.phase).toBe('review')
  })

  it('relógio do sistema que voltou pra trás enquanto escondida continua invalidando', () => {
    const s = run(focusing(), tick(5 * MIN), resumed(6 * MIN, 1 * MIN))
    expect(s.phase).toBe('invalid')
    expect(s.endReason).toBe('clock_changed')
  })

  it('a pausa também anda pelo relógio do sistema na volta', () => {
    const rated = run(focusing(), tick(FOCUS), { type: 'RATED', now: T0 + FOCUS, wallNow: WALL0 + FOCUS })
    const s = run(rated, { type: 'TICK', now: T0 + FOCUS + 1_000, wallNow: WALL0 + FOCUS + BREAK + 1_000, resumed: true })
    expect(s.phase).toBe('idle')
  })
})

describe('retomar um foco que já rodava no servidor (aba recarregada)', () => {
  const resume = (elapsedMs: number): TimerEvent => ({ type: 'RESUME', now: T0, wallNow: WALL0, elapsedMs, focusMs: FOCUS, breakMs: BREAK })

  it('volta pro foco com o tempo que já passou', () => {
    const s = run(initialTimerState(), resume(10 * MIN))
    expect(s.phase).toBe('focus')
    expect(remainingMs(s)).toBe(FOCUS - 10 * MIN)
  })

  it('se o tempo já acabou, o primeiro TICK leva pra revisão', () => {
    const s = run(initialTimerState(), resume(FOCUS + 20 * MIN), { type: 'TICK', now: T0 + 250, wallNow: WALL0 + 250 })
    expect(s.phase).toBe('review')
  })
})

describe('Fase 1 · mexer no relógio invalida', () => {
  it('relógio adiantado 1 min no meio do foco invalida a sessão', () => {
    const s = run(focusing(), tick(60_000), { type: 'TICK', now: T0 + 61_000, wallNow: WALL0 + 61_000 + MIN })
    expect(s.phase).toBe('invalid')
    expect(s.endReason).toBe('clock_changed')
  })

  it('relógio atrasado também invalida', () => {
    const s = timerReducer(focusing(), { type: 'TICK', now: T0 + 30_000, wallNow: WALL0 + 30_000 - 5_000 })
    expect(s.phase).toBe('invalid')
  })

  it('diferença de até 2 s é tolerada (sincronização normal do relógio)', () => {
    const s = timerReducer(focusing(), { type: 'TICK', now: T0 + 30_000, wallNow: WALL0 + 31_900 })
    expect(s.phase).toBe('focus')
  })

  it('relógio invalidado não mata a planta: é "invalid", não "failed"', () => {
    const s = timerReducer(focusing(), { type: 'TICK', now: T0 + 1_000, wallNow: WALL0 + 3 * MIN })
    expect(s.phase).not.toBe('failed')
  })
})

describe('ciclo do pomodoro', () => {
  it('começa no idle e conta o tempo pelo relógio monotônico', () => {
    const s = timerReducer(focusing(), tick(10 * MIN))
    expect(s.phase).toBe('focus')
    expect(remainingMs(s)).toBe(15 * MIN)
  })

  it('quando o tempo acaba vai pra revisão', () => {
    expect(timerReducer(focusing(), tick(FOCUS)).phase).toBe('review')
  })

  it('não existe pausa: só desistir, que falha a sessão', () => {
    const s = timerReducer(focusing(), { type: 'GIVE_UP' })
    expect(s.phase).toBe('failed')
    expect(s.endReason).toBe('gave_up')
  })

  it('servidor pode invalidar na revisão (tempo fora do esperado)', () => {
    const s = run(focusing(), tick(FOCUS), { type: 'INVALIDATE', reason: 'bad_timing' })
    expect(s.phase).toBe('invalid')
    expect(s.endReason).toBe('bad_timing')
  })

  it('depois da revisão vem a pausa curta; a cada 4 focos, a longa', () => {
    let s = initialTimerState()
    const breaks: number[] = []
    let t = T0
    for (let i = 0; i < 4; i++) {
      s = run(
        s,
        { type: 'START', now: t, wallNow: WALL0 + t, focusMs: FOCUS, breakMs: BREAK },
        { type: 'TICK', now: t + FOCUS, wallNow: WALL0 + t + FOCUS },
        { type: 'RATED', now: t + FOCUS + 5_000 },
      )
      breaks.push(s.breakTotalMs)
      t += FOCUS + 5_000
      s = run(s, { type: 'TICK', now: t + s.breakTotalMs, wallNow: WALL0 + t + s.breakTotalMs })
      t += s.breakTotalMs + LONG_BREAK_MS
    }
    expect(breaks).toEqual([BREAK, BREAK, BREAK, LONG_BREAK_MS])
    expect(s.phase).toBe('idle')
  })

  it('pular a pausa é permitido, mas o próximo foco espera 1 min', () => {
    const rated = run(focusing(), tick(FOCUS), { type: 'RATED', now: T0 + FOCUS + 2_000 })
    const skipped = timerReducer(rated, { type: 'SKIP_BREAK' })
    expect(skipped.phase).toBe('idle')

    const tooSoon = T0 + FOCUS + 2_000 + MIN_GAP_MS - 1
    expect(canStart(skipped, tooSoon)).toBe(false)
    const ignored = timerReducer(skipped, { type: 'START', now: tooSoon, wallNow: WALL0 + tooSoon, focusMs: FOCUS, breakMs: BREAK })
    expect(ignored.phase).toBe('idle')

    const onTime = tooSoon + 1
    const started = timerReducer(skipped, { type: 'START', now: onTime, wallNow: WALL0 + onTime, focusMs: FOCUS, breakMs: BREAK })
    expect(started.phase).toBe('focus')
    expect(started.endReason).toBeNull()
  })

  it('pausa que termina sozinha volta pro idle', () => {
    const s = run(focusing(), tick(FOCUS), { type: 'RATED', now: T0 + FOCUS }, tick(FOCUS + BREAK))
    expect(s.phase).toBe('idle')
  })

  it('depois de falhar, RESET volta pro idle limpo', () => {
    const s = run(focusing(), { type: 'GIVE_UP' }, { type: 'RESET' })
    expect(s.phase).toBe('idle')
    expect(s.endReason).toBeNull()
  })

  it('eventos fora de hora são ignorados', () => {
    const idle = initialTimerState()
    expect(timerReducer(idle, { type: 'SKIP_BREAK' })).toBe(idle)
    expect(timerReducer(idle, { type: 'GIVE_UP' })).toBe(idle)
    const failed = timerReducer(focusing(), { type: 'GIVE_UP' })
    expect(timerReducer(failed, tick(5_000))).toBe(failed)
  })

  it('é pura: nunca altera o estado recebido', () => {
    const s = Object.freeze(focusing())
    expect(() => run(s, tick(2), { type: 'GIVE_UP' })).not.toThrow()
    expect(s.phase).toBe('focus')
  })
})
