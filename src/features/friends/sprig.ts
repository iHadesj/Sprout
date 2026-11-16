// O raminho do avatar: um broto desenhado a traço, diferente pra cada pessoa e sempre o mesmo
// pra ela. No lugar da pedrinha com a inicial, cada amigo vira um espécime do caderno.
//
// A semente é o **id** da pessoa, não o nome de usuário: o id não muda, o nome pode mudar, e
// seria estranho seu raminho virar outro porque você se renomeou.
//
// Só enfeite: o nome continua escrito ao lado, e nada aqui mexe em jardim, sessão ou regra.
// Funções puras (semente -> caminhos SVG), testáveis sem navegador.
import { hashString, rng } from '../../three/random'

export type TipKind = 'botao' | 'fruto' | 'cacho'

export interface Sprig {
  /** caminho da haste */
  stem: string
  /** cada folha, já encaixada na haste */
  leaves: string[]
  /** o que fica na ponta */
  tip: { kind: TipKind; d: string }
  /** verde das folhas */
  leafColor: string
  /** cor da ponta e do fundo da pedrinha: é ela que diferencia à primeira vista */
  accent: string
}

/** A caixa do desenho. A haste nasce embaixo, no meio. */
export const SPRIG_BOX = { width: 24, height: 32 }

/** Verdes de herbário pras folhas. */
const GREENS = ['#4f7a4a', '#3b6a44', '#5d8a4e', '#6b9a55', '#416f5a', '#557f48']
/** Cores da ponta: as mesmas dos jardins, pra pessoa ter uma cor própria. */
const ACCENTS = ['#f08fb0', '#f2c14e', '#b49af0', '#f4876b', '#7fb4f0', '#6fcfb6', '#f5a35c', '#e5677a']

type Point = [number, number]

/** O raminho daquela pessoa. A mesma semente dá sempre o mesmo desenho. */
export function sprigOf(seed: string): Sprig {
  const random = rng(hashString(seed || 'sprout'))
  const base: Point = [12, 29.5]
  // o quanto a haste entorta pra um lado (de -3 a 3)
  const bend = random() * 6 - 3
  const topY = 6.5 + random() * 2.5
  const c1: Point = [12 + bend * 0.35, 23]
  const c2: Point = [12 + bend * 1.1, 15]
  const top: Point = [12 + bend * 0.85, topY]

  const count = 2 + Math.floor(random() * 4) // 2 a 5 folhas
  // o primeiro lado é sorteado; depois elas alternam, como folha de verdade
  let side = random() < 0.5 ? 1 : -1
  const leaves: string[] = []
  for (let i = 0; i < count; i++) {
    const t = 0.26 + (i / Math.max(1, count - 1)) * 0.56 + (random() - 0.5) * 0.05
    const at = cubicAt(base, c1, c2, top, t)
    const along = cubicTangent(base, c1, c2, top, t)
    const out = normalize([along[1] * side, -along[0] * side])
    // a folha sai pro lado, mas apontando um pouco pra cima
    const dir = normalize([out[0] * 0.82 + along[0] * 0.58, out[1] * 0.82 + along[1] * 0.58])
    // folha generosa: no avatar de 42 px, folha pequena some
    const length = (9.5 + random() * 2.5) * (1 - t * 0.28)
    leaves.push(leafPath(at, dir, length, length * 0.5))
    side = -side
  }

  const kinds: TipKind[] = ['botao', 'fruto', 'cacho']
  const kind = kinds[Math.floor(random() * kinds.length)]
  const headUp = normalize(cubicTangent(base, c1, c2, top, 1))

  return {
    stem: `M ${n(base[0])} ${n(base[1])} C ${n(c1[0])} ${n(c1[1])}, ${n(c2[0])} ${n(c2[1])}, ${n(top[0])} ${n(top[1])}`,
    leaves,
    tip: { kind, d: tipPath(kind, top, headUp, random) },
    leafColor: GREENS[Math.floor(random() * GREENS.length)],
    accent: ACCENTS[Math.floor(random() * ACCENTS.length)],
  }
}

/** Folha em gota: duas curvas saindo do encaixe na haste e se encontrando na ponta. */
function leafPath(at: Point, dir: Point, length: number, width: number): string {
  const tip: Point = [at[0] + dir[0] * length, at[1] + dir[1] * length]
  const mid: Point = [at[0] + dir[0] * length * 0.45, at[1] + dir[1] * length * 0.45]
  const side: Point = [-dir[1] * width, dir[0] * width]
  const a: Point = [mid[0] + side[0], mid[1] + side[1]]
  const b: Point = [mid[0] - side[0], mid[1] - side[1]]
  return `M ${n(at[0])} ${n(at[1])} Q ${n(a[0])} ${n(a[1])}, ${n(tip[0])} ${n(tip[1])} Q ${n(b[0])} ${n(b[1])}, ${n(at[0])} ${n(at[1])} Z`
}

/** A ponta: botão fechado, fruto redondo ou um cachinho que enrola. */
function tipPath(kind: TipKind, top: Point, up: Point, random: () => number): string {
  if (kind === 'fruto') {
    const r = 1.8 + random() * 0.9
    const c: Point = [top[0] + up[0] * r, top[1] + up[1] * r]
    return `M ${n(c[0] - r)} ${n(c[1])} a ${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0 Z`
  }
  if (kind === 'botao') {
    const length = 4 + random() * 1.6
    return leafPath(top, up, length, length * 0.38)
  }
  // cacho: a haste continua e enrola pro lado
  const turn = random() < 0.5 ? 1 : -1
  const side: Point = [-up[1] * turn, up[0] * turn]
  const p1: Point = [top[0] + up[0] * 3 + side[0] * 0.7, top[1] + up[1] * 3 + side[1] * 0.7]
  const p2: Point = [top[0] + up[0] * 2.8 + side[0] * 3.3, top[1] + up[1] * 2.8 + side[1] * 3.3]
  const p3: Point = [top[0] + up[0] * 1 + side[0] * 2.7, top[1] + up[1] * 1 + side[1] * 2.7]
  return `M ${n(top[0])} ${n(top[1])} C ${n(p1[0])} ${n(p1[1])}, ${n(p2[0])} ${n(p2[1])}, ${n(p3[0])} ${n(p3[1])}`
}

/** Ponto da curva cúbica em `t` (de Casteljau, direto na fórmula). */
function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

/** Para onde a curva aponta em `t` (a derivada), normalizado. */
function cubicTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = 3 * u * u
  const b = 6 * u * t
  const c = 3 * t * t
  return normalize([
    a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
    a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]),
  ])
}

function normalize([x, y]: Point): Point {
  const size = Math.hypot(x, y) || 1
  return [x / size, y / size]
}

/** Duas casas bastam: deixa o caminho curto e o teste estável. */
const n = (value: number) => Math.round(value * 100) / 100
