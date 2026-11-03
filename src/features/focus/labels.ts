// Textos e opções da revisão e dos motivos de fim de sessão, num lugar só.
import type { FailReason, InvalidReason } from './timerMachine'

export type FocusRating = 'sim' | 'medio' | 'nao'
export type DistractionTag = 'celular' | 'cansaco' | 'barulho' | 'fome' | 'outro'

export const RATING_OPTIONS: { value: FocusRating; label: string; hint: string }[] = [
  { value: 'sim', label: 'Sim, focado', hint: '+2 pra árvore' },
  { value: 'medio', label: 'Mais ou menos', hint: '+1 pra árvore' },
  { value: 'nao', label: 'Não focou', hint: 'não cresce, não morre' },
]

export const DISTRACTION_OPTIONS: { value: DistractionTag; label: string }[] = [
  { value: 'celular', label: 'Celular' },
  { value: 'cansaco', label: 'Cansaço' },
  { value: 'barulho', label: 'Barulho' },
  { value: 'fome', label: 'Fome' },
  { value: 'outro', label: 'Outra coisa' },
]

export const END_REASON_TEXT: Record<FailReason | InvalidReason, string> = {
  gave_up: 'Você desistiu no meio do foco.',
  ended_elsewhere: 'A sessão foi encerrada no servidor.',
  clock_changed: 'O relógio do sistema mudou durante o foco.',
  bad_timing: 'O servidor não confirmou o tempo da sessão.',
  no_heartbeat: 'O servidor ficou sem notícias da sessão por tempo demais.',
}
