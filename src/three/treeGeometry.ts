// Árvores low poly geradas por código, sem modelo baixado. Três espécies e um formato
// pra cada valor de growth:
//   0 semente meio enterrada · 1-3 broto · 4-6 muda · 7-9 árvore jovem
//   10 adulta, com frutas, flores ou bolinhas na cor do jardim
//
// O low poly é de propósito, então cada peça tem desenho próprio (como a rosa do para-carol):
// - copa: dezenas de folhas curvas (nervura no meio, bordas levantadas) espalhadas pelo
//   ângulo de ouro, sobrepostas como telhas; por baixo, um miolo escuro dá profundidade;
// - tronco e galhos: tubos curvos e levemente torcidos, com raízes na adulta;
// - pinheiro: "saias" recortadas em pontas, cada andar girado em relação ao de baixo;
// - frutas e flores torneadas (superfície de revolução), não bolinhas genéricas.
// A cor das folhas vai do escuro (base, parte de baixo da copa) ao claro (ponta, topo).
import { BufferGeometry, Color, IcosahedronGeometry, SRGBColorSpace, Vector3 } from 'three'
import type { Species } from '../features/gardens/plants'
import { MeshBuilder } from './meshBuilder'
import { clamp, hashString, lerp, rng } from './random'

export type Detail = 'high' | 'low'

const TAU = Math.PI * 2
const GOLDEN = 2.399963229728653
export const UP = new Vector3(0, 1, 0)

const hex = (...colors: string[]) => colors.map((c) => new Color(c))

/** Rampas de cor, do mais escuro (sombra) ao mais claro (ponta ao sol). */
export const LEAVES: Record<Species, Color[]> = {
  pinheiro: hex('#173f36', '#24604c', '#3f8a63', '#86bf83'),
  macieira: hex('#26502c', '#3f7f3a', '#71ad4f', '#c3df86'),
  cerejeira: hex('#2f5a33', '#4f8b45', '#86b85d', '#d2e59a'),
}
const BARK = hex('#4a3122', '#6f4a31', '#9a6c47')
const SOIL = hex('#6b4c33', '#93704d')
const SEED = hex('#7d5530', '#b88752', '#dcb27a')
export const STEM = hex('#2f5a33', '#6fa253')

/** Geometrias prontas, reaproveitadas por todas as árvores iguais (instancing). */
const cache = new Map<string, BufferGeometry>()

export function treeGeometry(species: Species, growth: number, color: string, detail: Detail): BufferGeometry {
  const g = clamp(Math.round(growth), 0, 10)
  const key = `${species}|${g}|${color}|${detail}`
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = buildTree(species, g, color, detail)
    cache.set(key, geometry)
  }
  return geometry
}

function buildTree(species: Species, growth: number, color: string, detail: Detail): BufferGeometry {
  const random = rng(hashString(`${species}:${growth}`))
  const b = new MeshBuilder(random, 0.1)
  const hi = detail === 'high'

  mound(b, 0.09 + growth * 0.006, random)
  if (growth === 0) seed(b)
  else if (growth <= 3) sprout(b, species, growth, hi, random)
  else {
    // t vai de 0 (muda recém-feita, growth 4) a 1 (adulta, growth 10)
    const t = (growth - 4) / 6
    const accent = accentPalette(color)
    if (species === 'pinheiro') pineTree(b, growth, t, accent, hi, random)
    else roundTree(b, species, growth, t, accent, hi, random)
  }
  const geometry = b.build()
  geometry.computeBoundingSphere()
  return geometry
}

// ---------- árvores ----------

interface Cluster {
  center: Vector3
  radius: number
}

/** Macieira e cerejeira: tronco curvo, galhos e uma copa de folhas por galho. */
function roundTree(b: MeshBuilder, species: Species, growth: number, t: number, accent: Accent, hi: boolean, random: () => number) {
  const cherry = species === 'cerejeira'
  const adult = growth >= 10
  const height = lerp(0.26, 0.5, t) * (cherry ? 0.88 : 1)
  const r0 = lerp(0.03, 0.075, t)
  const lean = new Vector3((random() - 0.5) * 0.1, 0, (random() - 0.5) * 0.1).multiplyScalar(cherry ? 1.8 : 1)
  const top = new Vector3(lean.x * 1.4, height, lean.z * 1.4)
  tube(b, bezier(new Vector3(), new Vector3(-lean.x, height * 0.5, -lean.z), top, hi ? 6 : 3), (f) => trunkRadius(r0, f), hi ? 7 : 5, (f) => ramp(BARK, 0.2 + f * 0.8))
  if (growth >= 7) roots(b, r0, hi, random)

  const R = lerp(0.19, 0.34, t)
  const squash = cherry ? 0.8 : 1
  const clusters: Cluster[] = [{ center: top.clone().add(new Vector3(0, R * (cherry ? 0.35 : 0.5), 0)), radius: R }]

  // galhos saindo do alto do tronco, cada um com sua copa
  const branches = growth <= 5 ? 0 : growth <= 7 ? 2 : 3
  const turn = random() * TAU
  for (let k = 0; k < branches; k++) {
    const az = turn + (k / branches) * TAU + (random() - 0.5) * 0.6
    const out = R * (cherry ? 1.05 : 0.8)
    const start = new Vector3().lerpVectors(new Vector3(), top, 0.78)
    const end = top.clone().add(new Vector3(Math.cos(az) * out, R * (cherry ? 0.12 : 0.3), Math.sin(az) * out))
    const ctrl = start.clone().add(new Vector3(Math.cos(az) * out * 0.25, (end.y - start.y) * 0.9, Math.sin(az) * out * 0.25))
    tube(b, bezier(start, ctrl, end, hi ? 4 : 2), (f) => r0 * 0.55 * (1 - f * 0.45), hi ? 5 : 4, (f) => ramp(BARK, 0.45 + f * 0.5))
    clusters.push({ center: end.clone().add(new Vector3(0, R * 0.22, 0)), radius: R * lerp(0.66, 0.78, random()) })
  }
  if (adult && !cherry) clusters.push({ center: clusters[0].center.clone().add(new Vector3(R * 0.12, R * 0.62, -R * 0.1)), radius: R * 0.62 })

  // a cerejeira adulta floresce inteira na cor do jardim; antes disso, folhas verdes
  const blossoming = cherry && adult
  const colors = blossoming ? [accent.deep, accent.base, accent.tip, accent.petal] : LEAVES[species]
  const shape: LeafShape = blossoming
    ? { length: 0.46, width: 0.95, cup: 0.45, curl: -0.05 }
    : cherry
      ? { length: 0.5, width: 0.78, cup: 0.35, curl: -0.04 }
      : { length: 0.52, width: 0.74, cup: 0.32, curl: -0.04 }
  for (const [i, c] of clusters.entries()) {
    const count = Math.round(lerp(26, 60, t) * (i === 0 ? 1 : 0.7) * (hi ? 1 : 0.45))
    canopy(b, c, squash, count, shape, colors, hi, rng(hashString(`${species}:${growth}:${i}`)))
  }

  if (cherry) {
    // flores: na jovem, na cor do jardim sobre o verde; na adulta, quase brancas sobre a cor
    const flowers = adult ? 14 : growth >= 7 ? (growth - 6) * 4 : 0
    const petals = adult ? [accent.petal, new Color('#fffaf2')] : [accent.base, accent.tip]
    onCanopy(clusters, hi ? flowers : Math.ceil(flowers / 2), squash, 1.04, random, (p, n) => blossom(b, p, n, adult ? 0.045 : 0.04, petals, hi))
  } else {
    const fruits = adult ? 9 : growth === 9 ? 4 : growth === 8 ? 2 : 0
    onCanopy(clusters, hi ? fruits : Math.ceil(fruits / 2), squash, 0.98, random, (p) => apple(b, p, adult ? 0.06 : 0.048, accent, hi), -0.55, 0.35)
  }
}

/** Pinheiro: tronco curto e andares de "saias" recortadas, cada um girado. */
function pineTree(b: MeshBuilder, growth: number, t: number, accent: Accent, hi: boolean, random: () => number) {
  const tiers = growth <= 5 ? 2 : growth <= 7 ? 3 : growth <= 9 ? 4 : 5
  const trunkHeight = lerp(0.1, 0.2, t)
  const R = lerp(0.24, 0.44, t)
  const H = lerp(0.46, 1.08, t)
  const r0 = lerp(0.028, 0.06, t)
  tube(b, bezier(new Vector3(), new Vector3(0.01, trunkHeight, 0), new Vector3(0, trunkHeight + H * 0.5, 0), hi ? 4 : 2), (f) => trunkRadius(r0, f), hi ? 6 : 5, (f) => ramp(BARK, 0.2 + f * 0.7))
  if (growth >= 7) roots(b, r0, hi, random)

  const colors = LEAVES.pinheiro
  const hems: Vector3[][] = []
  const turn = random() * TAU
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers
    const radius = R * (1 - k * 0.7)
    const y0 = trunkHeight + (i * H) / (tiers + 0.7)
    const h = (H / tiers) * 1.6
    hems.push(skirt(b, new Vector3(0, y0, 0), radius, h, hi ? 8 : 6, turn + i * GOLDEN, colors, 0.15 + k * 0.35))
  }

  if (growth >= 10) {
    // frutinhas na cor do jardim penduradas nas pontas dos andares de baixo
    for (const [n, hem] of hems.slice(0, 3).entries()) {
      hem.forEach((tip, i) => {
        if ((i + n) % 2 !== 0 || (!hi && i % 4 !== 0)) return
        gem(b, tip.clone().add(new Vector3(0, -0.035, 0)), 0.03, [accent.deep, accent.base, accent.tip])
      })
    }
  }
}

/** Broto: caulezinho curvo com folhas gordinhas (no pinheiro, um tufo de agulhas). */
function sprout(b: MeshBuilder, species: Species, growth: number, hi: boolean, random: () => number) {
  const s = lerp(0.75, 1.2, (growth - 1) / 2)
  const height = 0.11 * s
  const top = new Vector3(0.008, height, 0.004)
  tube(b, bezier(new Vector3(), new Vector3(0.018, height * 0.5, -0.006), top, 3), (f) => lerp(0.014, 0.008, f), 5, (f) => ramp(STEM, f), 1)
  const az = random() * TAU
  const colors = LEAVES[species]

  if (species === 'pinheiro') {
    const whorl = (center: Vector3, count: number, length: number, elevation: number, turn: number) => {
      for (let k = 0; k < count; k++) {
        const a = turn + (k / count) * TAU
        leaf(b, center, direction(a, elevation), UP, { length, width: 0.2, cup: 0.6, curl: 0.15 }, colors, 0.55, hi ? 2 : 1, 2)
      }
    }
    whorl(top, 6, 0.1 * s, 0.7, az)
    if (growth >= 2) whorl(top.clone().add(new Vector3(0, 0.012, 0)), 5, 0.07 * s, 1.05, az + 0.5)
    if (growth >= 3) whorl(top.clone().add(new Vector3(0, 0.03, 0)), 4, 0.05 * s, 1.3, az + 1.1)
    return
  }
  // duas folhas de semente (cotilédones) e, depois, o primeiro par de folhas de verdade
  for (const side of [0, Math.PI]) {
    leaf(b, top, direction(az + side, 0.32), UP, { length: 0.1 * s, width: 0.78, cup: 0.4, curl: 0.18 }, colors, 0.6, hi ? 3 : 2, hi ? 3 : 2)
  }
  if (growth >= 2) {
    const size = growth === 3 ? 0.085 : 0.055
    for (const side of [Math.PI / 2, -Math.PI / 2]) {
      leaf(b, top.clone().add(new Vector3(0, 0.008, 0)), direction(az + side, 1.0), UP, { length: size * s, width: 0.6, cup: 0.35, curl: 0.25 }, colors, 0.75, hi ? 3 : 2, hi ? 3 : 2)
    }
  }
}

/** Semente meio enterrada no montinho. */
function seed(b: MeshBuilder) {
  const profile: [number, number][] = [
    [0, -1],
    [0.55, -0.72],
    [0.82, -0.1],
    [0.66, 0.55],
    [0.25, 0.92],
    [0, 1],
  ]
  const place = (v: Vector3) => v.multiplyScalar(0.06).applyAxisAngle(new Vector3(0, 0, 1), 1.1).add(new Vector3(0, 0.045, 0))
  lathe(b, profile, 7, place, (row) => ramp(SEED, row / (profile.length - 1)))
}

// ---------- peças ----------

export interface LeafShape {
  /** comprimento, em fração do raio da copa (ou absoluto, nos brotos) */
  length: number
  /** largura, em fração do comprimento */
  width: number
  /** quanto as bordas levantam (folha em "V", mostra a nervura) */
  cup: number
  /** quanto a ponta curva de volta pra dentro */
  curl: number
}

/**
 * Folha em grade: nasce em `base`, aponta pra `dir`, e "levanta" as bordas pro lado de
 * `normal`. `light` (0 a 1) é quanto ela pega de sol: muda o tom da rampa de cor.
 */
export function leaf(b: MeshBuilder, base: Vector3, dir: Vector3, normal: Vector3, shape: LeafShape, colors: Color[], light: number, cols: number, rows: number) {
  const side = new Vector3().crossVectors(dir, normal)
  if (side.lengthSq() < 1e-6) side.crossVectors(dir, new Vector3(1, 0, 0))
  side.normalize()
  const up = new Vector3().crossVectors(side, dir).normalize()
  if (up.dot(normal) < 0) up.negate()
  const length = shape.length
  const grid: Vector3[][] = []
  for (let j = 0; j <= rows; j++) {
    const v = j / rows
    const w = length * shape.width * 0.5 * Math.pow(Math.sin(Math.PI * (0.07 + 0.86 * v)), 0.6)
    const row: Vector3[] = []
    for (let i = 0; i <= cols; i++) {
      const u = -1 + (2 * i) / cols
      const lift = shape.cup * Math.abs(u) * w - shape.curl * length * v * v
      row.push(base.clone().addScaledVector(dir, length * v).addScaledVector(side, w * u).addScaledVector(up, lift))
    }
    grid.push(row)
  }
  b.grid(grid, (j, i) => ramp(colors, clamp(lerp(0.08, 0.62, light) + (j / rows) * 0.38 - Math.abs(-1 + (2 * i) / cols) * 0.04, 0, 1)), 1)
}

/**
 * Copa: um miolo escuro e folhas distribuídas numa esfera pelo ângulo de ouro (como as
 * pétalas de uma rosa), escorrendo pra baixo como telhas e saindo um pouco pra fora.
 */
function canopy(b: MeshBuilder, cluster: Cluster, squash: number, count: number, shape: LeafShape, colors: Color[], hi: boolean, random: () => number) {
  const { center, radius: R } = cluster
  core(b, center, R * 0.8, squash, colors[0], colors[1])
  const rows = hi ? 2 : 1
  for (let k = 0; k < count; k++) {
    const y = 1 - ((k + 0.5) / count) * 1.5
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = k * GOLDEN + (random() - 0.5) * 0.4
    const n = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    const base = center.clone().add(new Vector3(n.x * R * 0.74, n.y * R * 0.74 * squash, n.z * R * 0.74))
    // as folhas "escorrem" pela superfície, como telhas, quase deitadas nela
    const down = new Vector3(0, -1, 0).addScaledVector(n, n.y)
    if (down.lengthSq() < 0.03) down.set(Math.cos(a + 1), 0, Math.sin(a + 1))
    const dir = down.normalize().multiplyScalar(0.85).addScaledVector(n, 0.32).normalize()
    const size = R * lerp(0.9, 1.1, random())
    leaf(b, base, dir, n, { ...shape, length: shape.length * size }, colors, (y + 1) / 2, 2, rows)
  }
}

/** Miolo da copa: icosaedro achatado, escuro embaixo. Aparece nas frestas entre as folhas. */
function core(b: MeshBuilder, center: Vector3, radius: number, squash: number, dark: Color, mid: Color) {
  const ico = new IcosahedronGeometry(1, 1)
  const pos = ico.getAttribute('position')
  const v = [new Vector3(), new Vector3(), new Vector3()]
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).multiply(new Vector3(radius, radius * squash, radius)).add(center)
    const h = clamp((v[0].y + v[1].y + v[2].y) / 3 - center.y + radius * 0.3, 0, radius) / radius
    b.triangle(v[0].clone(), v[1].clone(), v[2].clone(), dark.clone().lerp(mid, h), undefined, undefined, 1)
  }
  ico.dispose()
}

/** Um andar do pinheiro: saia com 2*pontas colunas, pontas caídas. Devolve as pontas da barra. */
function skirt(b: MeshBuilder, base: Vector3, radius: number, height: number, points: number, turn: number, colors: Color[], light: number): Vector3[] {
  const cols = points * 2
  const rings: Vector3[][] = [[], [], []]
  const tips: Vector3[] = []
  for (let i = 0; i <= cols; i++) {
    const a = turn + (i / cols) * TAU
    const tip = i % 2 === 0
    const at = (r: number, y: number) => new Vector3(base.x + Math.cos(a) * r, base.y + y, base.z + Math.sin(a) * r)
    rings[0].push(at(radius * 0.06, height))
    rings[1].push(at(radius * (tip ? 0.64 : 0.5), height * (tip ? 0.4 : 0.48)))
    const hem = at(radius * (tip ? 1 : 0.76), tip ? -radius * 0.14 : radius * 0.02)
    rings[2].push(hem)
    if (tip && i < cols) tips.push(hem)
  }
  b.grid(rings, (row, col) => ramp(colors, clamp(light + (2 - row) * 0.24 + (col % 2 === 0 ? 0.06 : 0), 0, 1)), 1)
  // parte de baixo, na sombra
  b.fan(base.clone().add(new Vector3(0, height * 0.12, 0)), rings[2], colors[0], colors[0].clone().lerp(colors[1], 0.5), 1, false)
  return tips
}

/** Tubo ao longo de pontos (tronco, galhos, caule), com os anéis girando um pouco. */
export function tube(b: MeshBuilder, points: Vector3[], radiusAt: (f: number) => number, sides: number, colorAt: (f: number) => Color, leafy = 0) {
  const rings: Vector3[][] = []
  const tangent = new Vector3()
  // o "lado" de cada anel é carregado de um ponto pro outro (sem saltos onde o tubo curva)
  let normal = new Vector3(1, 0, 0)
  for (let j = 0; j < points.length; j++) {
    tangent.subVectors(points[Math.min(points.length - 1, j + 1)], points[Math.max(0, j - 1)]).normalize()
    normal = normal.addScaledVector(tangent, -normal.dot(tangent))
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1).addScaledVector(tangent, -tangent.z)
    normal.normalize()
    const binormal = new Vector3().crossVectors(tangent, normal)
    const f = j / (points.length - 1)
    const r = radiusAt(f)
    const ring: Vector3[] = []
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * TAU + j * 0.45
      ring.push(points[j].clone().addScaledVector(normal, Math.cos(a) * r).addScaledVector(binormal, Math.sin(a) * r))
    }
    rings.push(ring)
  }
  b.grid(rings, (row) => colorAt(row / (points.length - 1)), leafy)
}

/** Raio do tronco: base alargada, afinando até o alto. */
function trunkRadius(r0: number, f: number) {
  const flare = Math.max(0, 1 - f / 0.18)
  return r0 * (0.62 + 0.38 * (1 - f)) * (1 + 0.55 * flare * flare)
}

/** Três raízes saindo da base e entrando no chão. */
function roots(b: MeshBuilder, r0: number, hi: boolean, random: () => number) {
  const turn = random() * TAU
  for (let k = 0; k < 3; k++) {
    const a = turn + (k / 3) * TAU + (random() - 0.5) * 0.5
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const start = new Vector3(0, r0 * 1.2, 0).addScaledVector(out, r0 * 0.5)
    const end = new Vector3(0, -0.01, 0).addScaledVector(out, r0 * 3.2)
    const ctrl = new Vector3(0, r0 * 0.3, 0).addScaledVector(out, r0 * 2.2)
    tube(b, bezier(start, ctrl, end, hi ? 3 : 2), (f) => r0 * 0.42 * (1 - f * 0.7), 4, (f) => ramp(BARK, 0.25 - f * 0.15))
  }
}

/** Maçãzinha torneada, com cabinho e folhinha. */
function apple(b: MeshBuilder, at: Vector3, size: number, accent: Accent, hi: boolean) {
  const profile: [number, number][] = [
    [0, -0.82],
    [0.55, -0.8],
    [0.95, -0.25],
    [0.92, 0.35],
    [0.55, 0.72],
    [0.14, 0.6],
  ]
  const colors = [accent.deep, accent.base, accent.base, accent.tip, accent.tip, accent.base]
  const place = (v: Vector3) => v.multiplyScalar(size).add(at)
  lathe(b, profile, hi ? 7 : 5, place, (row) => colors[row])
  if (!hi) return
  const stemTop = at.clone().add(new Vector3(0.006, size * 1.25, 0))
  const stemBase = at.clone().add(new Vector3(0, size * 0.55, 0))
  const s = new Vector3(size * 0.08, 0, 0)
  b.triangle(stemBase.clone().sub(s), stemBase.clone().add(s), stemTop, BARK[1], BARK[1], BARK[2])
  leaf(b, stemTop, direction(0.6, 0.35), UP, { length: size * 0.9, width: 0.55, cup: 0.3, curl: 0.1 }, LEAVES.macieira, 0.8, 2, 1)
}

/** Flor de 5 pétalas virada pra `normal`, com miolo dourado. */
function blossom(b: MeshBuilder, at: Vector3, normal: Vector3, size: number, [petal, light]: Color[], hi: boolean) {
  const n = normal.clone().normalize()
  const side = new Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new Vector3(1, 0, 0) : UP).normalize()
  const other = new Vector3().crossVectors(n, side).normalize()
  const center = at.clone().addScaledVector(n, size * 0.15)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU
    const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(other, Math.sin(a))
    const across = side.clone().multiplyScalar(-Math.sin(a)).addScaledVector(other, Math.cos(a))
    const mid = center.clone().addScaledVector(dir, size * 0.55).addScaledVector(n, size * 0.12)
    const tip = center.clone().addScaledVector(dir, size).addScaledVector(n, size * 0.05)
    const l = mid.clone().addScaledVector(across, size * 0.32)
    const r = mid.clone().addScaledVector(across, -size * 0.32)
    b.triangle(center, l, tip, petal, light, light)
    b.triangle(center, tip, r, petal, light, light)
  }
  if (!hi) return
  const ring = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * TAU + 0.6
    return center.clone().addScaledVector(side, Math.cos(a) * size * 0.18).addScaledVector(other, Math.sin(a) * size * 0.18).addScaledVector(n, size * 0.14)
  })
  b.fan(center.clone().addScaledVector(n, size * 0.22), ring, new Color('#f6d374'), new Color('#d9a441'))
}

/** Bolinha facetada (frutinha do pinheiro), clara em cima. */
export function gem(b: MeshBuilder, center: Vector3, radius: number, colors: Color[]) {
  const ico = new IcosahedronGeometry(radius, 0)
  const pos = ico.getAttribute('position')
  const v = [new Vector3(), new Vector3(), new Vector3()]
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).add(center)
    const h = ((v[0].y + v[1].y + v[2].y) / 3 - center.y) / radius
    b.triangle(v[0].clone(), v[1].clone(), v[2].clone(), ramp(colors, clamp(0.5 + h * 0.6, 0, 1)))
  }
  ico.dispose()
}

/** Montinho de terra onde a árvore nasce. */
export function mound(b: MeshBuilder, radius: number, random: () => number) {
  const sides = 8
  const outer: Vector3[] = []
  const inner: Vector3[] = []
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * TAU
    const r = i === sides ? outer[0] : null
    outer.push(r ? r.clone() : new Vector3(Math.cos(a) * radius * (0.85 + random() * 0.3), 0.004, Math.sin(a) * radius * (0.85 + random() * 0.3)))
    inner.push(new Vector3(Math.cos(a + 0.3) * radius * 0.5, 0.028, Math.sin(a + 0.3) * radius * 0.5))
  }
  b.grid([outer, inner], (row) => SOIL[row])
  b.fan(new Vector3(0, 0.036, 0), inner, SOIL[1], SOIL[1], 0, false)
}

/** Superfície de revolução: o perfil [raio, altura] gira em volta do eixo y. */
export function lathe(b: MeshBuilder, profile: [number, number][], sides: number, place: (v: Vector3) => Vector3, colorAt: (row: number) => Color) {
  const rings = profile.map(([r, y], j) => {
    const ring: Vector3[] = []
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * TAU + j * 0.35
      ring.push(place(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r)))
    }
    return ring
  })
  b.grid(rings, colorAt)
}

/** Pontos na superfície das copas (pra frutas e flores), entre as alturas `minY` e `maxY`. */
function onCanopy(clusters: Cluster[], count: number, squash: number, out: number, random: () => number, put: (p: Vector3, n: Vector3) => void, minY = -0.3, maxY = 0.9) {
  for (let i = 0; i < count; i++) {
    const { center, radius } = clusters[i % clusters.length]
    const a = random() * TAU
    const y = lerp(minY, maxY, random())
    const r = Math.sqrt(1 - y * y)
    const n = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    put(center.clone().add(new Vector3(n.x * radius * out, n.y * radius * out * squash, n.z * radius * out)), n)
  }
}

// ---------- utilidades ----------

/** Curva de Bézier quadrática (a -> e, puxada por c), em `n` segmentos. */
export function bezier(a: Vector3, c: Vector3, e: Vector3, n: number): Vector3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return new Vector3()
      .addScaledVector(a, (1 - t) * (1 - t))
      .addScaledVector(c, 2 * (1 - t) * t)
      .addScaledVector(e, t * t)
  })
}

/** Cor ao longo de uma rampa (0 = primeira cor, 1 = última). */
export function ramp(colors: Color[], t: number): Color {
  const x = clamp(t, 0, 1) * (colors.length - 1)
  const i = Math.min(colors.length - 2, Math.floor(x))
  return colors[i].clone().lerp(colors[i + 1], x - i)
}

export function direction(azimuth: number, elevation: number): Vector3 {
  return new Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation))
}

interface Accent {
  deep: Color
  base: Color
  tip: Color
  /** quase branco, pra pétala clara */
  petal: Color
}

/** Tons da cor do jardim pra frutas, flores e bolinhas. */
function accentPalette(hexColor: string): Accent {
  const base = new Color(hexColor)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl, SRGBColorSpace)
  return {
    deep: new Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * 0.7, SRGBColorSpace),
    base,
    tip: new Color().setHSL(hsl.h, hsl.s * 0.85, Math.min(0.9, hsl.l * 1.12 + 0.1), SRGBColorSpace),
    petal: new Color().setHSL(hsl.h, hsl.s * 0.55, 0.93, SRGBColorSpace),
  }
}

// ---------- árvore velha (surpresa, ver src/three/OldTree.tsx) ----------

const OAK = hex('#22472a', '#386f35', '#5f9a45', '#a9cf76')
const OLD_BARK = hex('#3d281b', '#5e3f2a', '#80593c')

/** Medidas da árvore velha: o entalhe precisa saber onde o tronco é reto e qual o raio. */
export const OLD_TREE = {
  height: 0.7,
  radius: 0.17,
  sides: 16,
  /** faixa do tronco onde fica o entalhe (raio constante) */
  bandBottom: 0.15,
  bandTop: 0.47,
}

function oldTrunkRadius(y: number): number {
  const { radius, height } = OLD_TREE
  const flare = Math.max(0, 1 - y / 0.13)
  const taper = y > 0.52 ? 1 - ((y - 0.52) / (height - 0.52)) * 0.22 : 1
  return radius * (1 + 0.6 * flare * flare) * taper
}

let oldCache: BufferGeometry | null = null

/** Árvore grande e velha: tronco grosso e reto embaixo (pro entalhe), galhos grossos, copa alta. */
export function oldTreeGeometry(): BufferGeometry {
  if (oldCache) return oldCache
  const random = rng(hashString('árvore velha'))
  const b = new MeshBuilder(random, 0.1)
  const { height, radius, sides } = OLD_TREE
  mound(b, 0.36, random)
  const trunkPoints = Array.from({ length: 9 }, (_, i) => new Vector3(0, (height * i) / 8, 0))
  tube(b, trunkPoints, (f) => oldTrunkRadius(f * height), sides, (f) => ramp(OLD_BARK, 0.25 + f * 0.6))
  roots(b, radius * 0.9, true, random)

  const top = new Vector3(0, height, 0)
  const clusters: Cluster[] = [{ center: new Vector3(0, height + 0.62, -0.04), radius: 0.56 }]
  const turn = 0.9
  for (let k = 0; k < 3; k++) {
    const az = turn + (k / 3) * TAU + (random() - 0.5) * 0.4
    const start = top.clone().add(new Vector3(0, -0.06, 0))
    const end = top.clone().add(new Vector3(Math.cos(az) * 0.6, 0.38, Math.sin(az) * 0.6))
    const ctrl = start.clone().add(new Vector3(Math.cos(az) * 0.12, 0.3, Math.sin(az) * 0.12))
    tube(b, bezier(start, ctrl, end, 4), (f) => radius * 0.55 * (1 - f * 0.5), 7, (f) => ramp(OLD_BARK, 0.45 + f * 0.4))
    clusters.push({ center: end.clone().add(new Vector3(0, 0.16, 0)), radius: 0.44 })
  }
  const shape: LeafShape = { length: 0.5, width: 0.74, cup: 0.32, curl: -0.04 }
  for (const [i, c] of clusters.entries()) {
    canopy(b, c, 0.92, i === 0 ? 74 : 52, shape, OAK, true, rng(hashString(`árvore velha:${i}`)))
  }

  oldCache = b.build()
  oldCache.computeBoundingSphere()
  return oldCache
}

/** Raio do tronco da árvore velha na faixa do entalhe (é constante ali). */
export function oldTreeBandRadius(): number {
  return oldTrunkRadius((OLD_TREE.bandBottom + OLD_TREE.bandTop) / 2)
}
