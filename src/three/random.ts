// Números "aleatórios" com semente: a mesma semente sempre gera a mesma sequência.
// Assim a mesma planta (ou ilha) sai igual toda vez que a cena é montada.

/** mulberry32: gerador pequeno e rápido (o mesmo da rosa do buquê). */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Texto (ex.: id de uma planta) -> número pra usar como semente. */
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
