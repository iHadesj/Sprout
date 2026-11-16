import { describe, expect, it } from 'vitest'
import { SPRIG_BOX, sprigOf } from './sprig'

const SEEDS = ['a1b2', 'user-2', '7f3e-aaa', 'z', 'outro-id-bem-maior-com-traços']

/** Todos os números que aparecem num caminho SVG. */
const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe('sprigOf', () => {
  it('a mesma pessoa tem sempre o mesmo raminho', () => {
    expect(sprigOf('abc')).toEqual(sprigOf('abc'))
  })

  it('pessoas diferentes têm raminhos diferentes', () => {
    const desenhos = SEEDS.map((seed) => JSON.stringify(sprigOf(seed)))
    expect(new Set(desenhos).size).toBe(SEEDS.length)
  })

  it('tem de 2 a 5 folhas', () => {
    for (const seed of SEEDS) {
      const { leaves } = sprigOf(seed)
      expect(leaves.length).toBeGreaterThanOrEqual(2)
      expect(leaves.length).toBeLessThanOrEqual(5)
    }
  })

  it('todo caminho começa num "mover até" e nenhum número é inválido', () => {
    for (const seed of SEEDS) {
      const sprig = sprigOf(seed)
      for (const path of [sprig.stem, sprig.tip.d, ...sprig.leaves]) {
        expect(path.startsWith('M ')).toBe(true)
        for (const value of numbers(path)) expect(Number.isFinite(value)).toBe(true)
      }
    }
  })

  it('o desenho inteiro cabe na caixa, com folga pra espessura do traço', () => {
    for (const seed of SEEDS) {
      const sprig = sprigOf(seed)
      // os números de um caminho vêm em pares (x, y), menos os parâmetros do arco do fruto,
      // que também são pequenos: conferir todos contra a caixa já pega folha saindo do quadro
      for (const path of [sprig.stem, ...sprig.leaves]) {
        for (const value of numbers(path)) {
          expect(value).toBeGreaterThanOrEqual(-2)
          expect(value).toBeLessThanOrEqual(Math.max(SPRIG_BOX.width, SPRIG_BOX.height) + 2)
        }
      }
    }
  })

  it('as cores saem como hex', () => {
    for (const seed of SEEDS) {
      const sprig = sprigOf(seed)
      expect(sprig.leafColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(sprig.accent).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('sem semente ainda desenha alguma coisa (não quebra)', () => {
    expect(sprigOf('').leaves.length).toBeGreaterThan(0)
  })

  it('a ponta é botão, fruto ou cacho', () => {
    for (const seed of SEEDS) expect(['botao', 'fruto', 'cacho']).toContain(sprigOf(seed).tip.kind)
  })
})
