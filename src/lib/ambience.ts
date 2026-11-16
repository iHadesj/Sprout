// Som ambiente do foco: chuva, vento ou folhas, gerados no Web Audio, sem arquivo nenhum.
// A ideia é a mesma do sininho — ruído filtrado já soa como chuva, e um filtro que abre e
// fecha devagar já soa como vento. Zero download, zero licença de áudio.
//
// Desligado por padrão: ninguém é surpreendido com som. A escolha fica só neste navegador
// (localStorage), como o último jardim aberto.
import { audio } from './audio'

export type AmbienceKind = 'nenhum' | 'chuva' | 'vento' | 'folhas'

export const AMBIENCE_OPTIONS: { value: AmbienceKind; label: string }[] = [
  { value: 'nenhum', label: 'Silêncio' },
  { value: 'chuva', label: 'Chuva' },
  { value: 'vento', label: 'Vento' },
  { value: 'folhas', label: 'Folhas' },
]

const KEY = 'sprout:ambiente'
const FADE = 1.2

export function isAmbienceKind(value: unknown): value is AmbienceKind {
  return AMBIENCE_OPTIONS.some((o) => o.value === value)
}

/** O que a pessoa escolheu neste navegador (padrão: silêncio). */
export function ambiencePreference(): AmbienceKind {
  try {
    const saved = localStorage.getItem(KEY)
    return isAmbienceKind(saved) ? saved : 'nenhum'
  } catch {
    return 'nenhum'
  }
}

export function rememberAmbience(kind: AmbienceKind) {
  try {
    localStorage.setItem(KEY, kind)
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

interface Playing {
  kind: AmbienceKind
  master: GainNode
  sources: AudioScheduledSourceNode[]
}

let playing: Playing | null = null

/** Começa (ou troca) o som ambiente. 'nenhum' desliga. */
export function startAmbience(kind: AmbienceKind) {
  if (playing?.kind === kind) return
  stopAmbience()
  if (kind === 'nenhum') return
  const ctx = audio()
  if (!ctx) return

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.connect(ctx.destination)
  const sources = build(ctx, kind, master)
  for (const source of sources) source.start()
  // entra devagar: som que aparece de uma vez assusta mais do que acompanha
  master.gain.linearRampToValueAtTime(VOLUME[kind], ctx.currentTime + FADE)
  playing = { kind, master, sources }
}

export function stopAmbience() {
  const current = playing
  playing = null
  if (!current) return
  const ctx = audio()
  if (!ctx) {
    for (const source of current.sources) stopSource(source)
    return
  }
  const end = ctx.currentTime + FADE * 0.5
  current.master.gain.cancelScheduledValues(ctx.currentTime)
  current.master.gain.setValueAtTime(current.master.gain.value, ctx.currentTime)
  current.master.gain.linearRampToValueAtTime(0, end)
  for (const source of current.sources) {
    try {
      source.stop(end + 0.05)
    } catch {
      stopSource(source)
    }
  }
}

const VOLUME: Record<Exclude<AmbienceKind, 'nenhum'>, number> = { chuva: 0.17, vento: 0.2, folhas: 0.12 }

/** Monta o caminho do som de cada tipo e devolve o que precisa ser ligado. */
function build(ctx: AudioContext, kind: Exclude<AmbienceKind, 'nenhum'>, master: GainNode): AudioScheduledSourceNode[] {
  if (kind === 'vento') {
    // ruído grave + filtro que abre e fecha bem devagar = rajada
    const noise = looping(ctx, noiseBuffer(ctx, true))
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 2.2
    const gust = lfo(ctx, 0.05, 260, filter.frequency)
    noise.connect(filter).connect(master)
    return [noise, gust]
  }

  if (kind === 'folhas') {
    const noise = looping(ctx, noiseBuffer(ctx, false))
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2600
    filter.Q.value = 0.9
    const swell = ctx.createGain()
    swell.gain.value = 0.75
    const breeze = lfo(ctx, 0.22, 0.45, swell.gain)
    noise.connect(filter).connect(swell).connect(master)
    return [noise, breeze]
  }

  // chuva: ruído com os graves cortados (chuva não tem trovão) e um chiado que respira
  const noise = looping(ctx, noiseBuffer(ctx, false))
  const high = ctx.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 430
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 5200
  const swell = ctx.createGain()
  swell.gain.value = 0.85
  const breathing = lfo(ctx, 0.07, 0.15, swell.gain)
  noise.connect(high).connect(low).connect(swell).connect(master)
  return [noise, breathing]
}

/** Oscilador lento somando `depth` ao parâmetro (não substitui: soma ao valor que já está lá). */
function lfo(ctx: AudioContext, hz: number, depth: number, target: AudioParam): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  const amount = ctx.createGain()
  amount.gain.value = depth
  osc.connect(amount).connect(target)
  return osc
}

function looping(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

/**
 * Alguns segundos de ruído, em looping. `brown` dá o ruído grave (vento); o branco é o chiado
 * da chuva. O fim do trecho é misturado com o começo, senão o emendar do loop daria um clique.
 */
function noiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 3)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    if (!brown) {
      data[i] = white
      continue
    }
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.4
  }
  const fade = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    data[length - fade + i] = data[length - fade + i] * (1 - k) + data[i] * k
  }
  return buffer
}

function stopSource(source: AudioScheduledSourceNode) {
  try {
    source.stop()
  } catch {
    // já parado
  }
}
