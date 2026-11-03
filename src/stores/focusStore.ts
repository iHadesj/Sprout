// Estado global do foco (Zustand): o timerMachine, a sessão no servidor e o resultado da revisão.
// Fica fora dos componentes pra que outras partes (como a planta na cena 3D) leiam
// "há quanto tempo ele saiu" sem precisar receber isso por props.
import { create } from 'zustand'
import { initialTimerState, timerReducer, type TimerEvent, type TimerState } from '../features/focus/timerMachine'
import type { FocusSession, RatingResult } from '../lib/api'

interface FocusStore {
  timer: TimerState
  /** Linha de sessions no servidor: a sessão em andamento ou a última encerrada. */
  session: FocusSession | null
  /** O que o servidor decidiu na revisão (quanto a planta cresceu). */
  result: RatingResult | null
  /** Falha ao falar com o servidor num momento que importa (ex.: ao concluir). */
  syncError: string | null
  dispatch: (event: TimerEvent) => void
  setSession: (session: FocusSession | null) => void
  setResult: (result: RatingResult | null) => void
  setSyncError: (message: string | null) => void
  reset: () => void
}

export const useFocusStore = create<FocusStore>()((set) => ({
  timer: initialTimerState(),
  session: null,
  result: null,
  syncError: null,
  dispatch: (event) => set((s) => ({ timer: timerReducer(s.timer, event) })),
  setSession: (session) => set({ session }),
  setResult: (result) => set({ result }),
  setSyncError: (syncError) => set({ syncError }),
  reset: () => set({ timer: initialTimerState(), session: null, result: null, syncError: null }),
}))

// Só em desenvolvimento: o teste E2E "envelhece" a sessão aqui (como faz com started_at no banco)
// em vez de adiantar os relógios do navegador, que quebraria as animações.
if (import.meta.env.DEV) window.__sproutFocus = useFocusStore
