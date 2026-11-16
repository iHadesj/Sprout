import { describe, expect, it } from 'vitest'
import { SEASONS, seasonLook, seasonOf } from './season'

/** Mês aqui é 1–12, como gente escreve. */
const day = (month: number, d: number) => new Date(2026, month - 1, d, 12)

describe('seasonOf (hemisfério sul)', () => {
  it('dezembro a março é verão', () => {
    expect(seasonOf(day(12, 21))).toBe('verao')
    expect(seasonOf(day(1, 15))).toBe('verao')
    expect(seasonOf(day(3, 20))).toBe('verao')
  })

  it('março a junho é outono', () => {
    expect(seasonOf(day(3, 21))).toBe('outono')
    expect(seasonOf(day(5, 10))).toBe('outono')
    expect(seasonOf(day(6, 20))).toBe('outono')
  })

  it('junho a setembro é inverno', () => {
    expect(seasonOf(day(6, 21))).toBe('inverno')
    expect(seasonOf(day(8, 1))).toBe('inverno')
    expect(seasonOf(day(9, 22))).toBe('inverno')
  })

  it('setembro a dezembro é primavera', () => {
    expect(seasonOf(day(9, 23))).toBe('primavera')
    expect(seasonOf(day(11, 16))).toBe('primavera')
    expect(seasonOf(day(12, 20))).toBe('primavera')
  })

  it('todo dia do ano cai em alguma estação', () => {
    for (let month = 1; month <= 12; month++) {
      for (let d = 1; d <= 28; d++) expect(SEASONS).toContain(seasonOf(day(month, d)))
    }
  })
})

describe('seasonLook', () => {
  it('outono puxa a copa pro quente e o inverno pro frio', () => {
    const outono = seasonLook('outono').tint
    const inverno = seasonLook('inverno').tint
    expect(outono[0]).toBeGreaterThan(outono[2]) // mais vermelho que azul
    expect(inverno[2]).toBeGreaterThan(inverno[0]) // mais azul que vermelho
  })

  it('cai mais folha no outono que no inverno', () => {
    expect(seasonLook('outono').leafCount).toBeGreaterThan(seasonLook('inverno').leafCount)
  })

  it('toda estação tem cor de folha e tingimento entre 0 e 1', () => {
    for (const season of SEASONS) {
      const look = seasonLook(season)
      expect(look.leafColors.length).toBeGreaterThan(2)
      expect(look.tintAmount).toBeGreaterThanOrEqual(0)
      expect(look.tintAmount).toBeLessThanOrEqual(1)
      expect(look.grassAmount).toBeLessThanOrEqual(look.tintAmount)
    }
  })
})
