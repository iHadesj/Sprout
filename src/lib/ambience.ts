// Som ambiente do foco: chuva, vento ou folhas.
// - Chuva e folhas são gravações de verdade (`public/sounds/`). Só um trecho de cada uma toca,
//   em looping até o foco acabar, seja ele de 15 min ou de 1 h — o arquivo não precisa ter a
//   duração do foco. O recorte é feito aqui, na memória, então o arquivo original fica intacto.
// - Vento continua gerado no Web Audio: ruído grave com um filtro que abre e fecha devagar.
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

type Recorded = 'chuva' | 'folhas'

/**
 * Qual trecho de cada gravação vira o loop, em segundos, a partir da duração do arquivo, e
 * quantos segundos de mistura na emenda (`blend`). Quanto mais longa a mistura, menos dá pra
 * perceber onde o loop recomeça — o som vai virando o começo aos poucos, não de uma vez.
 * - chuva (arquivo de ~5 min): 2 min a partir da metade, 4 s de mistura. O fim do arquivo fica
 *   de fora porque gravação costuma terminar com fade.
 * - folhas (arquivo de ~17 s): ~15 s a partir do 2º segundo, 2 s de mistura. Começa no 2º
 *   segundo porque a mistura usa o som de antes do começo do trecho (ver `seamlessLoop`).
 */
const CLIPS: Record<Recorded, { file: string; blend: number; region: (duration: number) => [number, number] }> = {
  chuva: {
    file: 'sounds/chuva.mp3',
    blend: 4,
    region: (d) => [d / 2, Math.min(d - 1, d / 2 + 120)],
  },
  folhas: {
    file: 'sounds/folhas.mp3',
    blend: 2,
    region: (d) => [Math.min(2, d / 4), Math.min(d - 0.3, Math.min(2, d / 4) + 15)],
  },
}

// Volume de cada som (1 = como veio). Tudo pela metade do que era: o som acompanha, não manda.
const VOLUME: Record<Exclude<AmbienceKind, 'nenhum'>, number> = { chuva: 0.5, vento: 0.1, folhas: 0.5 }

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
  const current: Playing = { kind, master, sources: [] }
  playing = current

  if (kind === 'vento') {
    play(ctx, current, wind(ctx, master))
    return
  }

  // A gravação chega depois (download + decodificação). Se nesse meio-tempo a pessoa trocou de
  // som ou o foco acabou, `playing` já é outro e o que chegou é ignorado.
  loopOf(ctx, kind)
    .then((buffer) => {
      if (playing !== current) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(master)
      play(ctx, current, [source])
    })
    .catch(() => {
      // arquivo não veio ou não decodificou: o foco segue em silêncio
    })
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

/** Liga as fontes e sobe o volume devagar: som que aparece de uma vez assusta mais do que acompanha. */
function play(ctx: AudioContext, current: Playing, sources: AudioScheduledSourceNode[]) {
  for (const source of sources) source.start()
  current.sources = sources
  current.master.gain.setValueAtTime(0, ctx.currentTime)
  current.master.gain.linearRampToValueAtTime(VOLUME[current.kind as Exclude<AmbienceKind, 'nenhum'>], ctx.currentTime + FADE)
}

// Cada gravação é baixada e recortada uma vez só por aba; os próximos focos reaproveitam.
const loops = new Map<Recorded, Promise<AudioBuffer>>()

function loopOf(ctx: AudioContext, kind: Recorded): Promise<AudioBuffer> {
  let pending = loops.get(kind)
  if (!pending) {
    pending = loadLoop(ctx, kind)
    pending.catch(() => loops.delete(kind)) // deu errado: tenta de novo no próximo foco
    loops.set(kind, pending)
  }
  return pending
}

async function loadLoop(ctx: AudioContext, kind: Recorded): Promise<AudioBuffer> {
  const clip = CLIPS[kind]
  const response = await fetch(`${import.meta.env.BASE_URL}${clip.file}`)
  if (!response.ok) throw new Error(`som ${kind}: ${response.status}`)
  const whole = await ctx.decodeAudioData(await response.arrayBuffer())

  const [from, to] = clip.region(whole.duration)
  const start = Math.floor(from * whole.sampleRate)
  const end = Math.floor(to * whole.sampleRate)
  const fade = Math.floor(Math.min(clip.blend, from, (to - from) / 4) * whole.sampleRate)

  const channels: Float32Array[] = []
  for (let c = 0; c < whole.numberOfChannels; c++) channels.push(whole.getChannelData(c))
  const cut = seamlessLoop(channels, start, end, fade)

  const buffer = ctx.createBuffer(cut.length, end - start, whole.sampleRate)
  cut.forEach((data, c) => buffer.copyToChannel(data, c))
  return buffer
}

/**
 * Recorta [start, end) de cada canal pra tocar em looping sem emenda audível.
 *
 * Cortar seco e voltar pro começo dá um "tec" (a onda pula de um valor pra outro). Então o último
 * `fade` de amostras do trecho vai se misturando com o que vinha logo **antes** de `start` no
 * arquivo: quando o loop volta pro início, o som já estava chegando nele, como se o arquivo
 * continuasse. A mistura é de potência constante (seno/cosseno), que não dá aquela "afundada" no
 * meio da troca que a mistura linear dá em som de ruído como chuva.
 *
 * Precisa de `start >= fade` (tem que existir som antes do começo do trecho).
 */
export function seamlessLoop(channels: Float32Array[], start: number, end: number, fade: number): Float32Array<ArrayBuffer>[] {
  const length = end - start
  const blend = Math.max(0, Math.min(fade, start, length))
  return channels.map((source) => {
    const out = new Float32Array(length)
    out.set(source.subarray(start, end))
    for (let i = 0; i < blend; i++) {
      const k = (i + 1) / blend
      const leaving = Math.cos((k * Math.PI) / 2)
      const arriving = Math.sin((k * Math.PI) / 2)
      out[length - blend + i] = source[end - blend + i] * leaving + source[start - blend + i] * arriving
    }
    return out
  })
}

/** Vento: ruído grave + filtro que abre e fecha bem devagar = rajada. */
function wind(ctx: AudioContext, master: GainNode): AudioScheduledSourceNode[] {
  const noise = ctx.createBufferSource()
  noise.buffer = brownNoise(ctx)
  noise.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.Q.value = 2.2
  // oscilador lento somando ao corte do filtro (não substitui: soma ao valor que já está lá)
  const gust = ctx.createOscillator()
  gust.type = 'sine'
  gust.frequency.value = 0.05
  const amount = ctx.createGain()
  amount.gain.value = 260
  gust.connect(amount).connect(filter.frequency)
  noise.connect(filter).connect(master)
  return [noise, gust]
}

/** 3 s de ruído grave em looping, com o fim misturado ao começo pra emenda não dar clique. */
function brownNoise(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 3)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
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
