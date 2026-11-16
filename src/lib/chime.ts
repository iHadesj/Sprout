// Sininho curto (Web Audio, sem arquivo de som) pro fim do foco e da pausa:
// quem estuda num livro não está olhando pra tela quando o tempo acaba.
// O contexto de áudio é o de `audio.ts`, compartilhado com o som ambiente.
import { audio } from './audio'

/** Duas notas suaves (um "ding-dong" de sino). */
export function playChime() {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  for (const [i, freq] of [880, 1318.5].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.18
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 1.25)
  }
}
