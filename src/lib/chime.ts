// Sininho curto (Web Audio, sem arquivo de som) pro fim do foco e da pausa:
// quem estuda num livro não está olhando pra tela quando o tempo acaba.
// O navegador só libera áudio depois de um clique, por isso `primeChime` roda no "Começar foco".

let audio: AudioContext | null = null

export function primeChime() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // sem Web Audio: segue em silêncio
  }
}

/** Duas notas suaves (um "ding-dong" de sino). */
export function playChime() {
  if (!audio || audio.state !== 'running') return
  const now = audio.currentTime
  for (const [i, freq] of [880, 1318.5].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.18
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 1.25)
  }
}
