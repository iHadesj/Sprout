import { describe, expect, it } from 'vitest'
import {
  fawnMoment,
  fleePath,
  footY,
  HIDDEN_PAST,
  HOP_SECONDS,
  hopPose,
  lerpAngle,
  LOOK_SECONDS,
  planFawn,
  RIG,
  settle,
  STARTLE_SECONDS,
  WAIT_SECONDS,
  wrapAngle,
  type FawnPhase,
} from './fawnMotion'

const steps = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)

describe('esqueleto', () => {
  it('parado, os quatro cascos tocam o chão', () => {
    expect(footY('front', { upper: 0, lower: 0 }, 0)).toBeCloseTo(0, 3)
    expect(footY('hind', RIG.hindRest, 0)).toBeCloseTo(0, 2)
  })

  it('agachado, o corpo inclina até as patas da frente e de trás tocarem juntas', () => {
    const pose = hopPose(0, 0.2)
    const { pitch, y } = settle(pose)
    const front = footY('front', pose.front[0], pitch) + y
    const hind = footY('hind', pose.hind[0], pitch) + y
    expect(front).toBeCloseTo(0, 3)
    expect(hind).toBeCloseTo(0, 3)
    expect(y).toBeLessThan(0) // agachar abaixa o corpo
  })
})

describe('pulo', () => {
  it('nenhum casco afunda no chão em nenhum momento', () => {
    for (const u of steps(0, 1, 0.02)) {
      const pose = hopPose(u, 0.2)
      const { pitch, y } = settle(pose)
      const feet = [footY('front', pose.front[0], pitch), footY('front', pose.front[1], pitch), footY('hind', pose.hind[0], pitch), footY('hind', pose.hind[1], pitch)]
      expect(Math.min(...feet) + y).toBeGreaterThanOrEqual(-1e-6)
    }
  })

  it('sai do chão, chega na altura pedida e volta', () => {
    expect(hopPose(0, 0.2).lift).toBe(0)
    expect(hopPose(1, 0.2).lift).toBe(0)
    expect(Math.max(...steps(0, 1, 0.01).map((u) => hopPose(u, 0.2).lift))).toBeCloseTo(0.2, 2)
  })

  it('termina na mesma pose em que começa (os pulos emendam sem tranco)', () => {
    expect(hopPose(1, 0.2)).toEqual(hopPose(0, 0.2))
  })
})

describe('linha do tempo', () => {
  const hops = 4
  const total = WAIT_SECONDS + hops * HOP_SECONDS + LOOK_SECONDS + STARTLE_SECONDS

  it('passa pelas fases na ordem: espera, entra, olha, susto, foge', () => {
    const seen: FawnPhase[] = []
    for (const t of steps(0, total + 1, 0.05)) {
      const { phase } = fawnMoment(t, hops)
      if (seen[seen.length - 1] !== phase) seen.push(phase)
    }
    expect(seen).toEqual(['wait', 'enter', 'look', 'startle', 'flee'])
  })

  it('na entrada só anda pra frente e chega exatamente onde para', () => {
    let previous = 0
    for (const t of steps(WAIT_SECONDS, WAIT_SECONDS + hops * HOP_SECONDS - 0.001, 0.01)) {
      const { travel } = fawnMoment(t, hops)
      expect(travel).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = travel
    }
    expect(previous).toBeGreaterThan(0.98)
    expect(fawnMoment(WAIT_SECONDS + hops * HOP_SECONDS + 0.1, hops).travel).toBe(1)
  })

  it('olha pra câmera enquanto está parado e para de olhar no susto', () => {
    const looking = fawnMoment(WAIT_SECONDS + hops * HOP_SECONDS + 1.5, hops)
    expect(looking.phase).toBe('look')
    expect(looking.pose.look).toBe(1)
    expect(fawnMoment(total - 0.001, hops).pose.look).toBeLessThan(0.05)
  })

  it('na fuga a distância só cresce, com o rabo branco em pé', () => {
    let previous = 0
    for (const t of steps(total, total + 1, 0.02)) {
      const now = fawnMoment(t, hops)
      expect(now.fled).toBeGreaterThanOrEqual(previous)
      previous = now.fled
    }
    expect(previous).toBeGreaterThan(1.8)
    expect(fawnMoment(total + 0.5, hops).pose.tail).toBe(1)
  })
})

describe('palco', () => {
  const tree = { x: -0.8, z: 1.3 }
  const toCamera = { x: 0, z: 1 }

  it('para ao lado da árvore, dentro da ilha, e vem de mais longe pelo mesmo lado', () => {
    const plan = planFawn(tree, toCamera, 3, [])
    const fromTree = Math.hypot(plan.stop.x - tree.x, plan.stop.z - tree.z)
    expect(fromTree).toBeGreaterThan(0.7)
    expect(fromTree).toBeLessThan(1.6)
    expect(Math.hypot(plan.stop.x, plan.stop.z)).toBeLessThanOrEqual(3 * 0.8)
    expect(Math.hypot(plan.start.x, plan.start.z)).toBeLessThanOrEqual(3 * 0.9)
    // o começo fica mais longe da árvore que a parada, do mesmo lado
    expect(Math.sign(plan.start.x - tree.x)).toBe(Math.sign(plan.stop.x - tree.x))
    expect(Math.abs(plan.start.x - tree.x)).toBeGreaterThan(Math.abs(plan.stop.x - tree.x))
    expect(plan.hops).toBeGreaterThanOrEqual(2)
    expect(plan.hops).toBeLessThanOrEqual(5)
  })

  it('escolhe o lado sem planta no caminho nem tapando a visão', () => {
    const center = { x: 0, z: 0 }
    const right = planFawn(center, toCamera, 5, [{ x: -1, z: 0.4 }, { x: -1.1, z: 1.5 }])
    expect(right.stop.x).toBeGreaterThan(0)
    const left = planFawn(center, toCamera, 5, [{ x: 1, z: 0.4 }, { x: 1.1, z: 1.5 }])
    expect(left.stop.x).toBeLessThan(0)
  })

  it('para de lado, um pouco virado pra câmera', () => {
    const plan = planFawn(tree, toCamera, 3, [])
    const turned = Math.abs(wrapAngle(plan.stopHeading - plan.enterHeading))
    expect(turned).toBeGreaterThan(0.1)
    expect(turned).toBeLessThanOrEqual(0.4 + 1e-9)
  })
})

describe('fuga por trás da árvore', () => {
  for (const [a0, b0] of [
    [0.95, 0.45],
    [-1.1, 0.25],
    [0.6, 0.9],
    [0.1, 0.7],
  ]) {
    it(`saindo de (${a0}, ${b0}) passa por trás do tronco e some do outro lado`, () => {
      const path = fleePath(a0, b0)
      const start = path.at(0)
      expect(start.a).toBeCloseTo(a0)
      expect(start.b).toBeCloseTo(b0)
      // onde ele cruza a linha do tronco (a = 0), tem que estar atrás dele (b bem negativo)
      const crossing = steps(0, path.length, 0.01)
        .map((d) => path.at(d))
        .find((p) => p.a * path.side <= 0)
      expect(crossing).toBeDefined()
      expect(crossing!.b).toBeLessThan(-0.33)
      // e termina fundo o bastante do outro lado pra caber escondido, mesmo no tamanho maior
      expect(path.at(path.length).a * path.side).toBeLessThan(-HIDDEN_PAST * 1.6)
      expect(path.at(path.length + 1).done).toBe(true)
    })
  }

  it('anda no caminho na velocidade pedida (a tabela de comprimento compensa a curva)', () => {
    const path = fleePath(0.95, 0.45)
    const a = path.at(0.8)
    const b = path.at(1.0)
    expect(Math.hypot(b.a - a.a, b.b - a.b)).toBeCloseTo(0.2, 1)
  })
})

describe('ângulos', () => {
  it('vai pelo caminho mais curto', () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2)
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1)
  })
})
