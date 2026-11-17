import { describe, expect, it } from 'vitest'
import {
  actPose,
  actSeconds,
  enterSeconds,
  FAWN_ACTS,
  fawnMoment,
  fleePath,
  footY,
  grazePose,
  HIDDEN_PAST,
  hopPose,
  hopShapes,
  lerpAngle,
  lookSeconds,
  nextShow,
  planFawn,
  pronkPose,
  shakePose,
  RIG,
  settle,
  STARTLE_SECONDS,
  WAIT_SECONDS,
  wrapAngle,
  type FawnPhase,
  type FawnPose,
} from './fawnMotion'

const steps = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)

/** Altura de cada casco acima do chão [frente esq., frente dir., trás esq., trás dir.], com o corpo assentado. */
function hooves(pose: FawnPose): number[] {
  const { pitch, y } = settle(pose)
  return [
    footY('front', pose.front[0], pitch, pose.roll, 1),
    footY('front', pose.front[1], pitch, pose.roll, -1),
    footY('hind', pose.hind[0], pitch, pose.roll, 1),
    footY('hind', pose.hind[1], pitch, pose.roll, -1),
  ].map((h) => h + y)
}

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
    for (const u of steps(0, 1, 0.02)) expect(Math.min(...hooves(hopPose(u, 0.12)))).toBeGreaterThanOrEqual(-1e-6)
  })

  it('as patas de trás empurram plantadas no chão: o corpo sobe com elas apoiadas', () => {
    // era o bug: o corpo inteiro levitava junto, como se só dobrasse a perna e subisse
    let previous = -Infinity
    for (const u of steps(0.06, 0.13, 0.01)) {
      const [fl, fr, hl, hr] = hooves(hopPose(u, 0.12))
      expect(Math.min(hl, hr)).toBeLessThan(0.002)
      expect(Math.min(fl, fr)).toBeGreaterThan(0.02)
      const { y } = settle(hopPose(u, 0.12))
      expect(y).toBeGreaterThan(previous)
      previous = y
    }
  })

  it('pousa com as patas da frente primeiro', () => {
    const [fl, fr, hl, hr] = hooves(hopPose(0.65, 0.12))
    expect(Math.min(fl, fr)).toBeLessThan(0.002)
    expect(Math.min(hl, hr)).toBeGreaterThan(0.03)
  })

  it('o corpo sobe a altura pedida acima da decolagem e do pouso', () => {
    const body = (u: number) => settle(hopPose(u, 0.12)).y
    const top = Math.max(...steps(0.2, 0.6, 0.005).map(body))
    expect(top - Math.max(body(0.2), body(0.6))).toBeGreaterThan(0.08)
    expect(top - Math.max(body(0.2), body(0.6))).toBeLessThan(0.13)
    expect(hopPose(0, 0.12).lift).toBe(0)
    expect(hopPose(1, 0.12).lift).toBe(0)
  })

  it('a altura do corpo muda sem tranco (nem na decolagem, nem no pouso)', () => {
    // segunda diferença pequena = a velocidade não muda de uma vez. A parábola de antes
    // arrancava do nada na decolagem e passava disso.
    const h = 0.004
    const body = (u: number) => settle(hopPose(u, 0.12)).y
    for (const u of steps(h, 1 - h, h)) expect(Math.abs(body(u + h) - 2 * body(u) + body(u - h))).toBeLessThan(0.0045)
  })

  it('as pernas passam pelos quadros-chave sem frear (curva cúbica, não smoothstep)', () => {
    // 0.33 é um quadro-chave: com o smoothstep de antes, a perna parava ali
    const angle = (u: number) => hopPose(u, 0.12).front[0].upper
    expect(Math.abs(angle(0.335) - angle(0.325))).toBeGreaterThan(0.004)
  })

  it('termina na mesma pose em que começa (os pulos emendam sem tranco)', () => {
    expect(hopPose(1, 0.12)).toEqual(hopPose(0, 0.12))
  })
})

describe('entrada pulando', () => {
  it('nenhum pulo sai igual ao outro: duração, altura e tombo mudam', () => {
    const shapes = hopShapes(4, 7)
    expect(new Set(shapes.map((h) => h.seconds)).size).toBeGreaterThan(1)
    expect(new Set(shapes.map((h) => h.height)).size).toBeGreaterThan(1)
    // o tombo alterna de lado, como quem troca a perna de apoio
    expect(Math.sign(shapes[0].roll)).toBe(-Math.sign(shapes[1].roll))
  })

  it('a mesma semente dá sempre a mesma entrada', () => {
    expect(hopShapes(4, 7)).toEqual(hopShapes(4, 7))
    expect(hopShapes(4, 7)).not.toEqual(hopShapes(4, 8))
  })

  it('o último pulo é mais baixo: ele está chegando, não arrancando', () => {
    for (const seed of [1, 2, 3, 9]) {
      const shapes = hopShapes(4, seed)
      expect(shapes[3].height).toBeLessThan(Math.min(...shapes.slice(0, 3).map((h) => h.height)))
    }
  })

  it('um pulo emenda no outro sem tranco, inclusive a absorção do pouso', () => {
    expect(hopPose(1, 0.2, 0.08)).toEqual(hopPose(0, 0.2, 0.08))
    expect(hopPose(1, 0.2, 0.08).squash).toBeLessThan(hopPose(0.47, 0.2, 0.08).squash)
  })

  it('o corpo tomba pro lado no ar e volta ao certo no chão', () => {
    expect(hopPose(0, 0.2, 0.1).roll).toBeCloseTo(0, 5)
    expect(hopPose(1, 0.2, 0.1).roll).toBeCloseTo(0, 5)
    expect(Math.abs(hopPose(0.5, 0.2, 0.1).roll)).toBeGreaterThan(0.05)
  })
})

describe('linha do tempo', () => {
  const hops = 4
  const show = { act: 'chegada' as const, seed: 7 }
  const enter = enterSeconds(hops, show.seed)
  const total = WAIT_SECONDS + enter + actSeconds(show.act) + lookSeconds(show.act) + STARTLE_SECONDS

  it('passa pelas fases na ordem: espera, entra, olha, susto, foge', () => {
    const seen: FawnPhase[] = []
    for (const t of steps(0, total + 1, 0.05)) {
      const { phase } = fawnMoment(t, hops, show)
      if (seen[seen.length - 1] !== phase) seen.push(phase)
    }
    expect(seen).toEqual(['wait', 'enter', 'look', 'startle', 'flee'])
  })

  it('na entrada só anda pra frente e chega exatamente onde para', () => {
    let previous = 0
    for (const t of steps(WAIT_SECONDS, WAIT_SECONDS + enter - 0.001, 0.01)) {
      const { travel } = fawnMoment(t, hops, show)
      expect(travel).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = travel
    }
    expect(previous).toBeGreaterThan(0.98)
    expect(fawnMoment(WAIT_SECONDS + enter + 0.1, hops, show).travel).toBe(1)
  })

  it('olha pra câmera enquanto está parado e para de olhar no susto', () => {
    const looking = fawnMoment(WAIT_SECONDS + enter + 1.5, hops, show)
    expect(looking.phase).toBe('look')
    expect(looking.pose.look).toBe(1)
    expect(fawnMoment(total - 0.001, hops, show).pose.look).toBeLessThan(0.05)
  })

  it('na fuga a distância só cresce, com o rabo branco em pé', () => {
    let previous = 0
    for (const t of steps(total, total + 1, 0.02)) {
      const now = fawnMoment(t, hops, show)
      expect(now.fled).toBeGreaterThanOrEqual(previous)
      previous = now.fled
    }
    expect(previous).toBeGreaterThan(1.8)
    expect(fawnMoment(total + 0.5, hops, show).pose.tail).toBe(1)
  })
})

describe('os quatro números', () => {
  const hops = 3

  it('cada número tem a sua fase e todos terminam olhando pra câmera', () => {
    for (const act of FAWN_ACTS) {
      const show = { act, seed: 3 }
      const enter = enterSeconds(hops, show.seed)
      const seen: FawnPhase[] = []
      const total = WAIT_SECONDS + enter + actSeconds(act) + lookSeconds(act)
      for (const t of steps(0, total - 0.05, 0.05)) {
        const { phase } = fawnMoment(t, hops, show)
        if (seen[seen.length - 1] !== phase) seen.push(phase)
      }
      // 'chegada' é o número vazio: vai direto do pulo pro olhar
      expect(seen).toEqual(act === 'chegada' ? ['wait', 'enter', 'look'] : ['wait', 'enter', 'act', 'look'])
      // no fim do olhar ele está mesmo encarando a câmera
      expect(fawnMoment(total - 0.05, hops, show).pose.look).toBeGreaterThan(0.9)
    }
  })

  it('o número emenda no olhar sem a cabeça dar um pulo', () => {
    for (const act of FAWN_ACTS) {
      const show = { act, seed: 3 }
      const at = WAIT_SECONDS + enterSeconds(hops, show.seed) + actSeconds(act)
      const before = fawnMoment(at - 0.016, hops, show).pose
      const after = fawnMoment(at + 0.016, hops, show).pose
      expect(Math.abs(after.neck - before.neck)).toBeLessThan(0.1)
      expect(Math.abs(after.roll - before.roll)).toBeLessThan(0.1)
      expect(Math.abs(after.headPitch - before.headPitch)).toBeLessThan(0.1)
    }
  })

  it('nenhum casco afunda no chão em número nenhum', () => {
    for (const act of FAWN_ACTS) {
      for (const t of steps(0, actSeconds(act) || 0.1, 0.02)) expect(Math.min(...hooves(actPose(act, t)))).toBeGreaterThanOrEqual(-1e-6)
    }
  })

  it('o último pulo emenda no número sem o corpo dar um salto', () => {
    for (const act of FAWN_ACTS) {
      const show = { act, seed: 3 }
      const at = WAIT_SECONDS + enterSeconds(hops, show.seed)
      const body = (t: number) => settle(fawnMoment(t, hops, show).pose).y
      // antes: 3 cm de uma vez (do agachado do pouso direto pra pose do número)
      for (const t of steps(at - 0.032, at + 0.25, 0.016)) expect(Math.abs(body(t + 0.016) - body(t))).toBeLessThan(0.006)
    }
  })

  it('pastando abaixa a cabeça e volta a levantar', () => {
    const meio = grazePose(actSeconds('pastando') / 2, actSeconds('pastando'))
    expect(meio.neck).toBeGreaterThan(2.2)
    // filhote abre as patas da frente pra alcançar o chão
    expect(meio.front[0].out).toBeGreaterThan(0.3)
    expect(meio.front[1].out).toBeLessThan(-0.3)
    expect(grazePose(0, actSeconds('pastando')).neck).toBeCloseTo(0.5, 1)
    expect(grazePose(actSeconds('pastando'), actSeconds('pastando')).neck).toBeCloseTo(0.5, 1)
  })

  it('a sacudida sacode e para', () => {
    const rolls = steps(0, 1.2, 0.01).map((t) => shakePose(t, actSeconds('sacudida')).roll)
    expect(Math.max(...rolls)).toBeGreaterThan(0.08)
    expect(Math.min(...rolls)).toBeLessThan(-0.08)
    expect(shakePose(actSeconds('sacudida'), actSeconds('sacudida')).roll).toBeCloseTo(0, 2)
  })

  it('na sacudida os cascos ficam plantados: o tronco gira, as pernas compensam', () => {
    // era o bug: o tronco girava com as pernas penduradas e os cascos saíam do chão
    for (const t of steps(0, actSeconds('sacudida'), 0.01)) expect(Math.max(...hooves(shakePose(t, actSeconds('sacudida'))))).toBeLessThan(0.009)
  })

  it('a sacudida começa pela cabeça e termina no rabo', () => {
    const seconds = actSeconds('sacudida')
    const first = (key: 'headRoll' | 'roll' | 'tailWag') => steps(0, seconds, 0.01).find((t) => Math.abs(shakePose(t, seconds)[key]) > 0.03) ?? Infinity
    expect(first('headRoll')).toBeLessThan(first('roll'))
    expect(first('roll')).toBeLessThan(first('tailWag'))
  })

  it('o pulinho tira os quatro cascos do chão duas vezes', () => {
    const lifts = steps(0, actSeconds('pulinho'), 0.01).map((t) => Math.min(...hooves(pronkPose(t, actSeconds('pulinho')))))
    const picos = lifts.filter((v, i) => i > 0 && i < lifts.length - 1 && v > lifts[i - 1] && v >= lifts[i + 1] && v > 0.05)
    expect(picos.length).toBe(2)
  })
})

describe('sorteio do número', () => {
  it('nunca repete o número da vez anterior', () => {
    let previous: string | null = null
    let random = 0
    for (let i = 0; i < 40; i++) {
      // percorre todos os sorteios possíveis, inclusive as pontas
      random = (random + 0.37) % 1
      const show = nextShow(() => random)
      expect(show.act).not.toBe(previous)
      expect(FAWN_ACTS).toContain(show.act)
      previous = show.act
    }
  })

  it('o sorteio no limite ainda devolve um número válido', () => {
    expect(FAWN_ACTS).toContain(nextShow(() => 0.999999).act)
    expect(FAWN_ACTS).toContain(nextShow(() => 0).act)
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
