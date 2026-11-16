import { beforeEach, describe, expect, it } from 'vitest'
import { AMBIENCE_OPTIONS, ambiencePreference, isAmbienceKind, rememberAmbience, startAmbience, stopAmbience } from './ambience'

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
