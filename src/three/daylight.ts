// A luz do jardim segue o relógio de quem está olhando: manhã baixa e quente, meio-dia alto e
// claro, fim de tarde dourado com sombra comprida, noite azulada com vaga-lumes.
//
// Não é modo escuro: o papel continua claro e a ilha continua legível à noite (a luz do céu
// nunca desce de ~0.75). O que muda é a cor e a altura do sol — e a sombra, que estica quando
// ele desce. É só aparência: nada aqui mexe em sessão, crescimento ou regra.
//
// Função pura (hora -> luz) pra dar pra testar sem abrir o navegador, igual ao timerMachine.
import type { Biome } from '../features/gardens/gardenOptions'
import { clamp, lerp } from './random'

export interface Daylight {
  /** de onde a luz vem, normalizado. A câmera fica no +z, então o sol anda do +x pro -x. */
  direction: { x: number; y: number; z: number }
  /** altura do sol em radianos: quanto menor, mais comprida a sombra */
  elevation: number
  sun: string
  sunIntensity: number
  /** cor do céu (luz de cima) e do chão (o que ricocheteia de baixo) */
  sky: string
  ground: string
  hemisphere: number
  /** contraluz que acende a borda das copas e separa a árvore do papel */
  rim: string
  rimIntensity: number
  /** 0 de dia, 1 na noite fechada: liga os vaga-lumes e esfria o contorno */
  night: number
}

interface Key extends Omit<Daylight, 'direction'> {
  hour: number
  /** ângulo no plano do chão: positivo = direita de quem olha, negativo = esquerda */
  azimuth: number
}

/**
 * Os momentos do dia. Entre dois, a luz é interpolada; por isso o dia vira noite devagar
 * em vez de piscar. O primeiro (0h) e o último (24h) são iguais: assim a volta da meia-noite
 * não precisa de conta especial.
 *
 * `elevation` nunca fica rente ao horizonte (mínimo ~0.2 rad, uns 11°): no 0 a sombra seria
 * infinita e a luz entraria por dentro da ilha.
 */
const KEYS: Key[] = [
  { hour: 0, elevation: 0.55, azimuth: -0.55, sun: '#aec1f0', sunIntensity: 0.75, sky: '#c3cfe8', ground: '#59627d', hemisphere: 0.52, rim: '#dfe8ff', rimIntensity: 0.7, night: 1 },
  { hour: 4, elevation: 0.5, azimuth: -0.2, sun: '#aec1f0', sunIntensity: 0.75, sky: '#c3cfe8', ground: '#59627d', hemisphere: 0.52, rim: '#dfe8ff', rimIntensity: 0.7, night: 1 },
  { hour: 5, elevation: 0.2, azimuth: 1.2, sun: '#ffc3a2', sunIntensity: 1.3, sky: '#f0d6cc', ground: '#6f7186', hemisphere: 0.68, rim: '#ffd6c0', rimIntensity: 0.85, night: 0.5 },
  { hour: 7, elevation: 0.33, azimuth: 1, sun: '#ffd6a8', sunIntensity: 2.2, sky: '#fff0dd', ground: '#74839c', hemisphere: 0.85, rim: '#dbe7ff', rimIntensity: 1, night: 0 },
  { hour: 12, elevation: 0.95, azimuth: 0.35, sun: '#ffe6bd', sunIntensity: 2.9, sky: '#fff1d6', ground: '#6f7f99', hemisphere: 0.85, rim: '#cfe0ff', rimIntensity: 1.1, night: 0 },
  { hour: 16, elevation: 0.45, azimuth: -0.45, sun: '#ffd9a0', sunIntensity: 2.6, sky: '#ffeccc', ground: '#79809a', hemisphere: 0.84, rim: '#d7e2ff', rimIntensity: 1.05, night: 0 },
  { hour: 18, elevation: 0.26, azimuth: -0.95, sun: '#ffb27f', sunIntensity: 1.9, sky: '#ffe2c6', ground: '#7c7891', hemisphere: 0.82, rim: '#ffcdae', rimIntensity: 0.95, night: 0 },
  { hour: 19.5, elevation: 0.2, azimuth: -1.15, sun: '#ff9c82', sunIntensity: 1.35, sky: '#e8cbd0', ground: '#6e6a85', hemisphere: 0.66, rim: '#cbb8ff', rimIntensity: 0.9, night: 0.45 },
  { hour: 21.5, elevation: 0.45, azimuth: -0.7, sun: '#aec1f0', sunIntensity: 0.8, sky: '#c3cfe8', ground: '#59627d', hemisphere: 0.54, rim: '#dfe8ff', rimIntensity: 0.72, night: 1 },
  { hour: 24, elevation: 0.55, azimuth: -0.55, sun: '#aec1f0', sunIntensity: 0.75, sky: '#c3cfe8', ground: '#59627d', hemisphere: 0.52, rim: '#dfe8ff', rimIntensity: 0.7, night: 1 },
]

/** Neve: a luz quente deixava o branco bege, então tudo puxa pro frio (como já era antes). */
const SNOW = { sun: '#fff6ea', sky: '#f4f8ff', ground: '#7d90b0', rim: '#d8e6ff', mix: 0.55, intensity: 0.9 }

/** "14:30" -> 14.5. A hora é a do relógio de quem está olhando. */
export function hourOf(date: Date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60
}

/** A luz naquela hora, naquele bioma. `hour` fora de 0–24 dá a volta (25 = 1h). */
export function daylightAt(hour: number, biome: Biome = 'campo'): Daylight {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= h) i++
  const from = KEYS[i]
  const to = KEYS[i + 1]
  const t = (h - from.hour) / (to.hour - from.hour)

  const elevation = lerp(from.elevation, to.elevation, t)
  const azimuth = lerp(from.azimuth, to.azimuth, t)
  const flat = Math.cos(elevation)
  const light: Daylight = {
    direction: { x: Math.sin(azimuth) * flat, y: Math.sin(elevation), z: Math.cos(azimuth) * flat },
    elevation,
    sun: mixHex(from.sun, to.sun, t),
    sunIntensity: lerp(from.sunIntensity, to.sunIntensity, t),
    sky: mixHex(from.sky, to.sky, t),
    ground: mixHex(from.ground, to.ground, t),
    hemisphere: lerp(from.hemisphere, to.hemisphere, t),
    rim: mixHex(from.rim, to.rim, t),
    rimIntensity: lerp(from.rimIntensity, to.rimIntensity, t),
    night: lerp(from.night, to.night, t),
  }

  if (biome !== 'neve') return light
  return {
    ...light,
    sun: mixHex(light.sun, SNOW.sun, SNOW.mix),
    sky: mixHex(light.sky, SNOW.sky, SNOW.mix),
    ground: mixHex(light.ground, SNOW.ground, SNOW.mix),
    rim: mixHex(light.rim, SNOW.rim, SNOW.mix),
    sunIntensity: light.sunIntensity * SNOW.intensity,
  }
}

const WARM = '#ffcf8f'
const COOL = '#dbe6f7'

/**
 * Empurrãozinho da estação na luz: `warmth` acima de 0 esquenta (a luz baixa do outono),
 * abaixo de 0 esfria (o dia pálido do inverno). Não mexe na força da luz, só na cor.
 */
export function seasonalLight(light: Daylight, warmth: number): Daylight {
  const t = clamp(Math.abs(warmth), 0, 1)
  if (t === 0) return light
  const target = warmth > 0 ? WARM : COOL
  return { ...light, sun: mixHex(light.sun, target, t), sky: mixHex(light.sky, target, t * 0.6) }
}

/** Céu fechado: o sol some atrás da nuvem. Cores de dia de chuva. */
const CLOUD = { sun: '#cfd4dc', sky: '#dde2ea', ground: '#767c88', rim: '#c6cedb' }

/**
 * Dia de chuva no jardim: a luz fica cinza e fraca, mas o céu continua clareando a ilha —
 * chuva não é noite. `amount` vai de 0 (sem chuva) a 1 (fechado).
 */
export function overcast(light: Daylight, amount = 1): Daylight {
  const t = clamp(amount, 0, 1)
  return {
    ...light,
    sun: mixHex(light.sun, CLOUD.sun, t * 0.8),
    sky: mixHex(light.sky, CLOUD.sky, t * 0.75),
    ground: mixHex(light.ground, CLOUD.ground, t * 0.6),
    rim: mixHex(light.rim, CLOUD.rim, t * 0.7),
    sunIntensity: light.sunIntensity * lerp(1, 0.45, t),
    rimIntensity: light.rimIntensity * lerp(1, 0.75, t),
  }
}

/**
 * Quanto a caixa de sombra precisa crescer: com o sol baixo a sombra estica, e o que sai da
 * caixa simplesmente não é desenhado. Limitado ao raio da ilha pra sombra não ficar borrada
 * (o mapa de sombra tem tamanho fixo: caixa maior = menos pixels por metro).
 */
export function shadowReach(elevation: number, radius: number): number {
  return clamp(2 / Math.tan(elevation), 0, radius)
}

/** Mistura duas cores "#rrggbb". t = 0 dá a primeira, 1 dá a segunda. */
export function mixHex(a: string, b: string, t: number): string {
  const x = channels(a)
  const y = channels(b)
  const out = x.map((v, i) => Math.round(clamp(lerp(v, y[i], clamp(t, 0, 1)), 0, 255)))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function channels(hex: string): number[] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
