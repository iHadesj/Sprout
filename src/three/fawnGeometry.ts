// O cervinho filhote da surpresa (ver src/three/Fawn.tsx), no mesmo estilo facetado das árvores,
// só que com facetas pequenas. Proporções de filhote de verdade: pernas compridas, cabeça e
// orelhas grandes, pintinhas brancas no lombo, barriga clara, rabo branco por baixo.
//
// Cada parte que se mexe é uma geometria separada, desenhada em volta da própria articulação
// (a origem): a perna desce a partir do quadril, o pescoço sobe a partir do ombro, e assim por
// diante. Quem junta e mexe as partes é o Fawn.tsx, com as medidas do RIG (fawnMotion.ts).
import { Color, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three'
import { RIG } from './fawnMotion'
import { MeshBuilder } from './meshBuilder'
import { clamp, hashString, lerp, rng } from './random'
import { ramp } from './treeGeometry'

const TAU = Math.PI * 2
const X = new Vector3(1, 0, 0)
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)

const hex = (...colors: string[]) => colors.map((c) => new Color(c))
const [DORSAL, COAT, FLANK, TAN, CREAM, WHITE] = hex('#84502a', '#b06c3c', '#c88c56', '#e0b582', '#f8e2b8', '#fff9ec')
const [NOSE, HOOF, EAR_IN, EYE, EYE_SHINE] = hex('#2a1c17', '#33241c', '#f2bfae', '#17100e', '#ffffff')

/** Anel elíptico em volta de `center`: começa em +v e gira pra +u. O último ponto repete o primeiro. */
function ring(center: Vector3, u: Vector3, v: Vector3, ru: number, rv: number, sides: number): Vector3[] {
  return Array.from({ length: sides + 1 }, (_, i) => {
    const a = (i / sides) * TAU
    return center.clone().addScaledVector(u, Math.sin(a) * ru).addScaledVector(v, Math.cos(a) * rv)
  })
}

/**
 * Casca entre anéis, fechada nas duas pontas. `colorAt(linha, t)`: t = 0 onde o anel começa
 * (+v), 1 do lado oposto. Num corpo, +v é pra cima: 0 = lombo, 1 = barriga.
 */
function skin(b: MeshBuilder, rings: Vector3[][], colorAt: (row: number, t: number) => Color, caps: [Vector3 | null, Vector3 | null] = [null, null]) {
  const sides = rings[0].length - 1
  const t = (col: number) => (1 - Math.cos((col / sides) * TAU)) / 2
  b.grid(rings, (row, col) => colorAt(row, t(col)))
  const last = rings.length - 1
  if (caps[0]) b.fan(caps[0], rings[0], colorAt(0, 0.5), colorAt(0, 0.5), 0, false)
  if (caps[1]) b.fan(caps[1], rings[last], colorAt(last, 0.5), colorAt(last, 0.5), 0, false)
}

// ---------- tronco ----------

// z (de trás pra frente), altura do centro, meia largura, meia altura
const TORSO = [
  [-0.168, 0.246, 0.026, 0.034],
  [-0.15, 0.244, 0.046, 0.056],
  [-0.115, 0.241, 0.057, 0.068], // garupa
  [-0.07, 0.238, 0.056, 0.064],
  [-0.025, 0.236, 0.052, 0.058], // cintura
  [0.025, 0.232, 0.054, 0.062],
  [0.07, 0.23, 0.056, 0.068], // costelas
  [0.11, 0.233, 0.052, 0.068], // ombros
  [0.142, 0.24, 0.04, 0.056],
  [0.165, 0.246, 0.022, 0.034], // peito
]

/** Ponto e normal na superfície do tronco, na posição z e no ângulo `a` (0 = lombo). */
function onTorso(z: number, a: number) {
  let i = 0
  while (i < TORSO.length - 2 && z > TORSO[i + 1][0]) i++
  const k = clamp((z - TORSO[i][0]) / (TORSO[i + 1][0] - TORSO[i][0]), 0, 1)
  const [, y, rx, ry] = TORSO[i].map((v, n) => lerp(v, TORSO[i + 1][n], k))
  return {
    point: new Vector3(Math.sin(a) * rx, y + Math.cos(a) * ry, z),
    normal: new Vector3(Math.sin(a) / rx, Math.cos(a) / ry, 0).normalize(),
  }
}

function torso(): BufferGeometry {
  const random = rng(hashString('cervinho'))
  const b = new MeshBuilder(random, 0.045)
  const rings = TORSO.map(([z, y, rx, ry]) => ring(new Vector3(0, y, z), X, Y, rx, ry, 14))
  const last = TORSO.length - 1
  skin(
    b,
    rings,
    (row, t) => {
      const coat = ramp([DORSAL, COAT, COAT, COAT, FLANK, CREAM, CREAM], t)
      // atrás: o branco da garupa, embaixo do rabo; na frente: o peito claro
      if (row <= 1) return coat.lerp(WHITE, clamp((t - 0.3) * 2.2, 0, 1))
      if (row >= last - 1) return coat.lerp(CREAM, clamp((t - 0.25) * 1.6, 0, 0.85))
      return coat
    },
    [new Vector3(0, 0.247, -0.177), new Vector3(0, 0.248, 0.173)],
  )

  // pintinhas: duas fileiras de cada lado do lombo e algumas soltas no flanco
  const spot = (z: number, a: number, size: number) => {
    const { point, normal } = onTorso(z, a)
    const across = new Vector3().crossVectors(normal, Z).normalize()
    const center = point.addScaledVector(normal, 0.0038)
    const turn = random() * TAU
    const edge = Array.from({ length: 7 }, (_, i) => {
      const angle = turn + (i / 6) * TAU
      return center
        .clone()
        .addScaledVector(Z, Math.cos(angle) * size * 1.25)
        .addScaledVector(across, Math.sin(angle) * size)
        .addScaledVector(normal, -0.0016)
    })
    b.fan(center, edge, WHITE, WHITE, 0, false)
  }
  for (const side of [1, -1]) {
    for (const [angle, count, from, to] of [
      [0.36, 8, -0.13, 0.115],
      [0.8, 7, -0.125, 0.1],
      [1.22, 5, -0.11, 0.07],
    ]) {
      for (let i = 0; i < count; i++) {
        const z = lerp(from, to, (i + 0.5) / count) + (random() - 0.5) * 0.016
        spot(z, side * (angle + (random() - 0.5) * 0.16), 0.0075 + random() * 0.004)
      }
    }
  }
  return b.build()
}

// ---------- pescoço, cabeça, olho, orelha, rabo ----------

function neck(): BufferGeometry {
  const b = new MeshBuilder(rng(hashString('cervinho:pescoço')), 0.045)
  // altura (a partir do ombro), meia largura, meia profundidade, deslocamento pra frente
  const sections = [
    [-0.04, 0.044, 0.058, -0.016],
    [0.005, 0.038, 0.048, -0.01],
    [0.045, 0.031, 0.038, -0.004],
    [0.08, 0.028, 0.033, 0.0],
    [RIG.neck.length + 0.008, 0.027, 0.031, 0.003],
  ]
  // o anel começa na frente (garganta clara) e dá a volta por trás (nuca escura)
  const rings = sections.map(([y, rx, rz, z]) => ring(new Vector3(0, y, z), X, Z, rx, rz, 10))
  skin(b, rings, (row, t) => ramp([row >= 2 ? CREAM : TAN, TAN, COAT, COAT, DORSAL], t))
  return b.build()
}

// z (da nuca ao nariz), altura do centro, meia largura, meia altura
const HEAD = [
  [-0.04, 0.034, 0.018, 0.02],
  [-0.026, 0.037, 0.036, 0.038],
  [-0.004, 0.04, 0.045, 0.046],
  [0.02, 0.04, 0.046, 0.045], // testa larga e redonda: carinha de filhote
  [0.042, 0.034, 0.04, 0.037], // olhos
  [0.06, 0.024, 0.029, 0.027],
  [0.076, 0.017, 0.023, 0.021], // focinho curto
  [0.09, 0.014, 0.019, 0.017],
  [0.099, 0.013, 0.0145, 0.013],
  [0.105, 0.0135, 0.009, 0.008], // nariz
]

/** Onde ficam os olhos e as orelhas, em relação à base da cabeça. */
export const FACE = {
  eye: new Vector3(0.0365, 0.041, 0.045),
  ear: new Vector3(0.031, 0.071, -0.01),
  earLength: 0.096,
}

function head(): BufferGeometry {
  const b = new MeshBuilder(rng(hashString('cervinho:cabeça')), 0.04)
  const rings = HEAD.map(([z, y, rx, ry]) => ring(new Vector3(0, y, z), X, Y, rx, ry, 12))
  skin(
    b,
    rings,
    (row, t) => {
      if (row >= 9) return t < 0.6 ? NOSE.clone() : CREAM.clone() // nariz escuro, queixo claro
      if (row >= 7) return ramp([TAN, WHITE, CREAM, TAN], t) // faixa clara atrás do nariz
      const face = ramp([COAT, COAT, FLANK, CREAM, TAN], t)
      return row >= 5 ? face.lerp(TAN, 0.5) : face
    },
    [new Vector3(0, 0.034, -0.046), new Vector3(0, 0.0135, 0.1075)],
  )
  // pelo mais claro em volta dos olhos
  for (const side of [1, -1]) {
    const center = new Vector3(FACE.eye.x * side, FACE.eye.y, FACE.eye.z)
    const out = new Vector3(side, 0.25, 0.3).normalize()
    const up = new Vector3().crossVectors(Z, out).normalize().multiplyScalar(side)
    const forward = new Vector3().crossVectors(out, up).normalize()
    const edge = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * TAU
      return center.clone().addScaledVector(forward, Math.cos(a) * 0.024).addScaledVector(up, Math.sin(a) * 0.022).addScaledVector(out, -0.0035)
    })
    b.fan(center.clone().addScaledVector(out, 0.004), edge, CREAM, CREAM.clone().lerp(TAN, 0.5), 0, false)
  }
  return b.build()
}

/** Olho: bolinha escura achatada contra a cabeça, com um brilho. +x aponta pra fora da cabeça. */
function eye(): BufferGeometry {
  const b = new MeshBuilder(rng(7), 0.02)
  const ico = new IcosahedronGeometry(1, 1)
  const pos = ico.getAttribute('position')
  const size = new Vector3(0.0095, 0.0155, 0.0155)
  const v = [new Vector3(), new Vector3(), new Vector3()]
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).multiply(size)
    b.triangle(v[0].clone(), v[1].clone(), v[2].clone(), EYE)
  }
  ico.dispose()
  // brilho: um losango branco no alto do olho, do lado da frente
  const at = new Vector3(0.86, 0.42, 0.3).normalize().multiply(size).multiplyScalar(1.05)
  const out = at.clone().normalize()
  const side = new Vector3().crossVectors(Y, out).normalize()
  const up = new Vector3().crossVectors(out, side).normalize()
  const corners = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 4) * TAU
    return at.clone().addScaledVector(side, Math.cos(a) * 0.0052).addScaledVector(up, Math.sin(a) * 0.006)
  })
  b.fan(at.clone().addScaledVector(out, 0.0006), corners, EYE_SHINE, EYE_SHINE, 0, false)
  return b.build()
}

/** Folha curvada (orelha, rabo): sobe em +y a partir da base, com as bordas viradas pra +z. */
function petal(b: MeshBuilder, length: number, width: (v: number) => number, cup: number, lean: number, offset: number, colorAt: (v: number, edge: number) => Color) {
  const rows = 6
  const cols = 4
  const points: Vector3[][] = []
  for (let j = 0; j <= rows; j++) {
    const v = j / rows
    const w = width(v)
    const line: Vector3[] = []
    for (let i = 0; i <= cols; i++) {
      const c = -1 + (2 * i) / cols
      line.push(new Vector3(c * w, v * length, cup * c * c * w + lean * v * v + offset))
    }
    points.push(line)
  }
  b.grid(points, (j, i) => colorAt(j / rows, Math.abs(-1 + (2 * i) / cols)))
}

function ear(): BufferGeometry {
  const b = new MeshBuilder(rng(hashString('cervinho:orelha')), 0.04)
  const L = FACE.earLength
  const width = (v: number) => 0.0275 * Math.sin(Math.PI * (0.12 + 0.88 * v)) ** 0.85
  // por fora: a cor do pelo, escurecendo na ponta e na borda
  petal(b, L, width, 0.42, -0.012, 0, (v, edge) => COAT.clone().lerp(DORSAL, clamp(v * 0.7 + edge * 0.35, 0, 1)))
  // por dentro: rosado no meio, claro na borda
  petal(b, L * 0.93, (v) => width(v) * 0.8, 0.42, -0.012, 0.0035, (v, edge) => EAR_IN.clone().lerp(CREAM, clamp(edge * 0.8 + v * 0.25, 0, 1)))
  return b.build()
}

function tail(): BufferGeometry {
  const b = new MeshBuilder(rng(hashString('cervinho:rabo')), 0.04)
  const width = (v: number) => 0.019 * Math.sin(Math.PI * (0.3 + 0.7 * v)) ** 0.8
  // em cima, a cor do pelo; embaixo, branco (um pouco mais largo: a franja branca aparece)
  petal(b, 0.068, width, -0.5, 0, 0.002, (v, edge) => COAT.clone().lerp(DORSAL, v * 0.6).lerp(WHITE, edge > 0.9 ? 0.6 : 0))
  petal(b, 0.072, (v) => width(v) * 1.1, -0.5, 0, -0.0025, () => WHITE.clone())
  return b.build()
}

// ---------- pernas ----------

/** Pedaço de perna descendo a partir da articulação. Seções: [altura, meia largura, meia profundidade]. */
function limb(seed: string, sections: number[][], colorAt: (row: number) => Color, hoof = false): BufferGeometry {
  const b = new MeshBuilder(rng(hashString(seed)), 0.045)
  const rings = sections.map(([y, rx, rz]) => ring(new Vector3(0, y, 0), X, Z, rx, rz, 7))
  const end = sections[sections.length - 1][0]
  skin(b, rings, (row) => colorAt(row), [null, hoof ? new Vector3(0, end - 0.001, 0) : null])
  return b.build()
}

function lowerLeg(seed: string, length: number): BufferGeometry {
  return limb(
    seed,
    [
      [0.004, 0.0135, 0.0145],
      [-length * 0.4, 0.0108, 0.0115],
      [-length + 0.026, 0.0105, 0.0115],
      [-length + 0.019, 0.0128, 0.014], // casco
      [-length, 0.0138, 0.016],
    ],
    (row) => (row >= 3 ? HOOF.clone() : row === 2 ? TAN.clone().lerp(CREAM, 0.35) : row === 1 ? TAN.clone() : FLANK.clone()),
    true,
  )
}

export interface FawnParts {
  torso: BufferGeometry
  neck: BufferGeometry
  head: BufferGeometry
  eye: BufferGeometry
  ear: BufferGeometry
  tail: BufferGeometry
  frontUpper: BufferGeometry
  frontLower: BufferGeometry
  hindUpper: BufferGeometry
  hindLower: BufferGeometry
}

let cache: FawnParts | null = null

/** As partes do cervinho (feitas uma vez e guardadas: são sempre iguais). */
export function fawnParts(): FawnParts {
  if (cache) return cache
  const { front, hind } = RIG
  cache = {
    torso: torso(),
    neck: neck(),
    head: head(),
    eye: eye(),
    ear: ear(),
    tail: tail(),
    frontUpper: limb(
      'cervinho:braço',
      [
        [0.02, 0.02, 0.027],
        [-0.005, 0.021, 0.027],
        [-0.045, 0.016, 0.019],
        [-front.upper + 0.018, 0.0125, 0.0135],
        [-front.upper, 0.0138, 0.0148], // joelho
      ],
      (row) => (row <= 1 ? COAT.clone() : row === 2 ? COAT.clone().lerp(FLANK, 0.6) : FLANK.clone()),
    ),
    frontLower: lowerLeg('cervinho:canela da frente', front.lower),
    hindUpper: limb(
      'cervinho:coxa',
      [
        [0.03, 0.024, 0.044],
        [-0.005, 0.027, 0.046],
        [-0.05, 0.02, 0.029],
        [-hind.upper + 0.022, 0.0135, 0.016],
        [-hind.upper, 0.0135, 0.0152], // jarrete
      ],
      (row) => (row <= 1 ? COAT.clone() : row === 2 ? COAT.clone().lerp(FLANK, 0.5) : FLANK.clone()),
    ),
    hindLower: lowerLeg('cervinho:canela de trás', hind.lower),
  }
  return cache
}
