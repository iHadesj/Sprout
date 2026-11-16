import { describe, expect, it } from 'vitest'
import { daylightAt, hourOf, mixHex, overcast, shadowReach } from './daylight'

const HEX = /^#[0-9a-f]{6}$/

describe('daylightAt', () => {
  it('o sol fica mais alto ao meio-dia que de manhã ou de tarde', () => {
    expect(daylightAt(12).elevation).toBeGreaterThan(daylightAt(7).elevation)
    expect(daylightAt(12).elevation).toBeGreaterThan(daylightAt(18).elevation)
  })

  it('o meio-dia é mais forte que a madrugada', () => {
    expect(daylightAt(12).sunIntensity).toBeGreaterThan(daylightAt(3).sunIntensity * 2)
  })

  it('de madrugada é noite fechada, ao meio-dia não é noite nenhuma', () => {
    expect(daylightAt(2).night).toBe(1)
    expect(daylightAt(12).night).toBe(0)
    expect(daylightAt(19.5).night).toBeGreaterThan(0)
  })

  it('a noite continua clara o bastante pra ilha ser vista (não é modo escuro)', () => {
    for (const hour of [0, 2, 22, 23.9]) expect(daylightAt(hour).hemisphere).toBeGreaterThan(0.45)
  })

  it('o sol anda da direita (manhã) pra esquerda (tarde)', () => {
    expect(daylightAt(7).direction.x).toBeGreaterThan(0)
    expect(daylightAt(18).direction.x).toBeLessThan(0)
  })

  it('a luz sempre vem de cima, nunca de dentro da ilha', () => {
    for (let hour = 0; hour < 24; hour += 0.25) expect(daylightAt(hour).direction.y).toBeGreaterThan(0.15)
  })

  it('hora fora de 0–24 dá a volta', () => {
    expect(daylightAt(25)).toEqual(daylightAt(1))
    expect(daylightAt(-1)).toEqual(daylightAt(23))
  })

  it('a volta da meia-noite não pula: 23:59 e 00:01 são quase iguais', () => {
    const before = daylightAt(23.98)
    const after = daylightAt(0.02)
    expect(Math.abs(before.sunIntensity - after.sunIntensity)).toBeLessThan(0.02)
    expect(Math.abs(before.elevation - after.elevation)).toBeLessThan(0.01)
  })

  it('todas as cores saem como hex válido', () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const light = daylightAt(hour, 'neve')
      for (const color of [light.sun, light.sky, light.ground, light.rim]) expect(color).toMatch(HEX)
    }
  })

  it('na neve a luz é mais fria e mais fraca que no campo', () => {
    const campo = daylightAt(12, 'campo')
    const neve = daylightAt(12, 'neve')
    expect(neve.sunIntensity).toBeLessThan(campo.sunIntensity)
    expect(blue(neve.sky) - red(neve.sky)).toBeGreaterThan(blue(campo.sky) - red(campo.sky))
  })
})

describe('shadowReach', () => {
  it('sol baixo estica a sombra, sol alto encurta', () => {
    const radius = 6
    expect(shadowReach(0.2, radius)).toBeGreaterThan(shadowReach(0.95, radius))
  })

  it('nunca passa do raio da ilha (senão a sombra fica borrada)', () => {
    expect(shadowReach(0.05, 6)).toBe(6)
  })
})

describe('mixHex', () => {
  it('nas pontas devolve as cores de entrada', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('no meio fica no meio', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('hourOf', () => {
  it('conta os minutos como fração da hora', () => {
    expect(hourOf(new Date(2026, 10, 16, 14, 30))).toBe(14.5)
    expect(hourOf(new Date(2026, 10, 16, 0, 0))).toBe(0)
  })
})

const red = (hex: string) => Number.parseInt(hex.slice(1, 3), 16)
const blue = (hex: string) => Number.parseInt(hex.slice(5, 7), 16)

describe('overcast (dia de chuva)', () => {
  it('o sol enfraquece mas o céu continua clareando a ilha', () => {
    const day = daylightAt(12)
    const rain = overcast(day)
    expect(rain.sunIntensity).toBeLessThan(day.sunIntensity * 0.6)
    expect(rain.hemisphere).toBe(day.hemisphere)
  })

  it('as cores perdem o quente', () => {
    const day = daylightAt(12)
    const rain = overcast(day)
    expect(warmth(rain.sun)).toBeLessThan(warmth(day.sun))
    expect(warmth(rain.sky)).toBeLessThan(warmth(day.sky))
  })

  it('amount 0 não muda nada', () => {
    const day = daylightAt(9)
    expect(overcast(day, 0)).toEqual(day)
  })

  it('chuva de noite continua sendo noite', () => {
    expect(overcast(daylightAt(2)).night).toBe(1)
  })
})

/** quanto a cor puxa pro quente: vermelho menos azul */
const warmth = (hex: string) => red(hex) - blue(hex)
