import { describe, expect, it } from 'vitest'
import { sproutLeaves } from './sproutLeaves'

describe('sproutLeaves', () => {
  it('ganha uma folha em cada limite de minutos', () => {
    expect(sproutLeaves(0)).toBe(0)
    expect(sproutLeaves(1)).toBe(1)
    expect(sproutLeaves(49)).toBe(1)
    expect(sproutLeaves(50)).toBe(2)
    expect(sproutLeaves(99)).toBe(2)
    expect(sproutLeaves(100)).toBe(3)
    expect(sproutLeaves(600)).toBe(3)
  })

  it('valor estranho vira só a haste', () => {
    expect(sproutLeaves(-5)).toBe(0)
    expect(sproutLeaves(Number.NaN)).toBe(0)
    expect(sproutLeaves(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
