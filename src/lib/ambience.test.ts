import { beforeEach, describe, expect, it } from 'vitest'
import { AMBIENCE_OPTIONS, ambiencePreference, isAmbienceKind, rememberAmbience, seamlessLoop, startAmbience, stopAmbience } from './ambience'

/** localStorage de mentira: o teste roda no node, que não tem o do navegador. */
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  } as Storage
}

describe('escolha do som ambiente', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage()
  })

  it('vem desligado: ninguém é surpreendido com som', () => {
    expect(ambiencePreference()).toBe('nenhum')
  })

  it('lembra a escolha neste navegador', () => {
    rememberAmbience('chuva')
    expect(ambiencePreference()).toBe('chuva')
  })

  it('valor estragado no armazenamento volta pro silêncio', () => {
    localStorage.setItem('sprout:ambiente', 'trovoada')
    expect(ambiencePreference()).toBe('nenhum')
  })

  it('sem armazenamento nenhum, continua no silêncio em vez de quebrar', () => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    expect(ambiencePreference()).toBe('nenhum')
    expect(() => rememberAmbience('vento')).not.toThrow()
  })

  it('só aceita os tipos que existem', () => {
    expect(isAmbienceKind('vento')).toBe(true)
    expect(isAmbienceKind('nada disso')).toBe(false)
    expect(AMBIENCE_OPTIONS.map((o) => o.value)).toContain('nenhum')
  })

  it('sem áudio liberado, ligar e desligar não quebra', () => {
    expect(() => {
      startAmbience('chuva')
      stopAmbience()
    }).not.toThrow()
  })
})

describe('recorte em looping das gravações', () => {
  // "gravação" de mentira: a amostra i vale i, fácil de ver de onde cada valor veio
  const ramp = Float32Array.from({ length: 100 }, (_, i) => i)

  it('recorta exatamente o trecho pedido, em todos os canais', () => {
    const [left, right] = seamlessLoop([ramp, ramp], 40, 80, 0)
    expect(left.length).toBe(40)
    expect(right.length).toBe(40)
    expect(left[0]).toBe(40)
    expect(left[39]).toBe(79)
  })

  it('o meio do trecho fica intacto; só o fim é misturado', () => {
    const [out] = seamlessLoop([ramp], 40, 80, 10)
    expect(Array.from(out.slice(0, 30))).toEqual(Array.from(ramp.slice(40, 70)))
  })

  it('o fim chega no som de logo antes do começo, então a volta do loop não pula', () => {
    const [out] = seamlessLoop([ramp], 40, 80, 10)
    // última amostra = 100% do que vinha antes do início (39); depois dela o loop toca o 40
    expect(out[39]).toBeCloseTo(39, 4)
  })

  it('não lê antes do começo do arquivo quando o trecho começa cedo demais', () => {
    const [out] = seamlessLoop([ramp], 3, 50, 10)
    expect(out.length).toBe(47)
    expect(out.every((v) => Number.isFinite(v))).toBe(true)
    expect(out[46]).toBeCloseTo(2, 4)
  })
})
