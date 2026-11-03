import { describe, expect, it } from 'vitest'
import { Spring } from './spring'

function run(spring: Spring, target: number, seconds: number) {
  let peak = spring.value
  for (let t = 0; t < seconds; t += 1 / 60) peak = Math.max(peak, spring.step(target, 1 / 60))
  return peak
}

describe('Spring', () => {
  it('com pouco amortecimento passa do alvo e depois assenta nele', () => {
    const spring = new Spring(0, { stiffness: 170, damping: 13 })
    const peak = run(spring, 1, 3)
    expect(peak).toBeGreaterThan(1.05)
    expect(spring.value).toBeCloseTo(1, 3)
  })

  it('com amortecimento crítico chega sem passar', () => {
    const spring = new Spring(0, { stiffness: 300, damping: 2 * Math.sqrt(300) })
    expect(run(spring, 1, 2)).toBeLessThanOrEqual(1.0001)
  })

  it('um quadro muito longo não faz o valor explodir', () => {
    const spring = new Spring(0, { stiffness: 170, damping: 13 })
    spring.step(1, 5)
    expect(Math.abs(spring.value)).toBeLessThan(2)
  })
})
