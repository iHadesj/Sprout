// Ilha flutuante facetada: topo de grama com relevo leve, um "lábio" de grama na beirada
// e, embaixo, camadas de terra e rocha com degraus, que se dissolvem no papel (o shader
// faz o desbotado). O contorno é orgânico (22 lados com uma ondulação suave, em vez de um
// polígono certinho de 9 lados). A cor do jardim tinge levemente a grama.
// Além da geometria, devolve `heightAt(x, z)`: a altura do chão em qualquer ponto do topo,
// pra plantas, grama e pedras pousarem no relevo em vez de flutuar ou afundar.
import { BufferGeometry, Color, IcosahedronGeometry, Vector3 } from 'three'
import type { Biome } from '../features/gardens/gardenOptions'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'

const TAU = Math.PI * 2
const SIDES = 22

export interface Spot {
  position_x: number
  position_z: number
}

export interface IslandShape {
  geometry: BufferGeometry
  heightAt: (x: number, z: number) => number
}

export const BIOME_COLORS: Record<Biome, { top: [string, string]; rim: string; grass: [string, string] }> = {
  campo: { top: ['#a6c77a', '#8fb767'], rim: '#6e9a4e', grass: ['#7aa458', '#c4dc98'] },
  cerrado: { top: ['#dcc584', '#cbb06a'], rim: '#a98e4b', grass: ['#b39648', '#ecd89c'] },
  neve: { top: ['#f6f8f8', '#e6ecee'], rim: '#c9d4da', grass: ['#8aa996', '#cddfd2'] },
}

/** Faixas de terra e rocha, de cima pra baixo (alternando, como estratos). */
const EARTH = ['#8a6444', '#c99c6c', '#a77a55', '#dbb383', '#98704e', '#bf9568'].map((c) => new Color(c))
const ROCK = [new Color('#9a9187'), new Color('#b7aea2')]

/** Raio da ilha: cabe a planta mais distante do centro com folga (arredondado de 0,25 em 0,25). */
export function islandRadius(plants: Spot[]): number {
  const far = plants.reduce((max, p) => Math.max(max, Math.hypot(p.position_x, p.position_z)), 0)
  return Math.max(3, Math.ceil((far + 1.1) * 4) / 4)
}

/** Profundidade da ilha (a ponta de baixo fica a ~2,9 x isto). Ilhas maiores são mais fundas. */
export function islandDepth(radius: number): number {
  return 0.75 + radius * 0.08
}

export function buildIsland(radius: number, biome: Biome, gardenColor: string, seed: number, plants: Spot[]): IslandShape {
  const random = rng(seed)
  const b = new MeshBuilder(random, 0.05)
  const palette = BIOME_COLORS[biome]
  const tint = new Color(gardenColor)
  const grassColors = palette.top.map((c) => new Color(c).lerp(tint, 0.07))
  const pickGrass = () => grassColors[random() < 0.5 ? 0 : 1]
  const up = new Vector3(0, 1, 0)
  const depth = islandDepth(radius)

  // topo: anéis com o mesmo número de vértices, cada um girado um pouco (facetas tortinhas)
  const rings = Math.max(3, Math.round(radius / 0.95))
  // contorno: soma de ondas suaves (fica entre ~0,9 e ~1,1 do raio), igual pra todos os anéis
  const phases = [random() * TAU, random() * TAU, random() * TAU]
  const outline = (a: number) => 1 + 0.05 * Math.sin(2 * a + phases[0]) + 0.035 * Math.sin(3 * a + phases[1]) + 0.02 * Math.sin(5 * a + phases[2])
  const rimJitter = Array.from({ length: SIDES }, () => 1 + (random() - 0.5) * 0.04)
  const top: Vector3[][] = []
  for (let k = 1; k <= rings; k++) {
    const ring: Vector3[] = []
    const outer = k === rings
    for (let i = 0; i < SIDES; i++) {
      // cada anel gira um pouco (facetas tortinhas), sempre menos de meio passo entre vértices:
      // mais que isso, os quadriláteros entre anéis se cruzam e abrem frestas no gramado
      const angle = (i / SIDES) * TAU + k * (TAU / SIDES) * 0.4
      const r = ((radius * k) / rings) * outline(angle) * (outer ? rimJitter[i] : 1 + (random() - 0.5) * 0.08)
      // relevo: dá pra ver as facetas pela luz, não só pelo contorno
      ring.push(new Vector3(Math.cos(angle) * r, outer ? -0.03 : (random() - 0.35) * 0.18, Math.sin(angle) * r))
    }
    top.push(ring)
  }

  const topTriangles: [Vector3, Vector3, Vector3][] = []
  const topFace = (a: Vector3, c: Vector3, d: Vector3) => {
    topTriangles.push([a, c, d])
    b.triangleFacing(a, c, d, up, pickGrass(), pickGrass(), pickGrass())
  }
  const center = new Vector3(0, 0.06, 0)
  for (let i = 0; i < SIDES; i++) topFace(center, top[0][i], top[0][(i + 1) % SIDES])
  for (let k = 0; k < rings - 1; k++) {
    const inner = top[k]
    const outer = top[k + 1]
    for (let i = 0; i < SIDES; i++) {
      const next = (i + 1) % SIDES
      topFace(inner[i], outer[i], outer[next])
      topFace(inner[i], outer[next], inner[next])
    }
  }

  /** Altura do topo em (x, z): acha o triângulo que contém o ponto e interpola. */
  const heightAt = (x: number, z: number): number => {
    for (const [a, c, d] of topTriangles) {
      const det = (c.z - d.z) * (a.x - d.x) + (d.x - c.x) * (a.z - d.z)
      const wa = ((c.z - d.z) * (x - d.x) + (d.x - c.x) * (z - d.z)) / det
      const wc = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det
      const wd = 1 - wa - wc
      if (wa >= -1e-4 && wc >= -1e-4 && wd >= -1e-4) return wa * a.y + wc * c.y + wd * d.y
    }
    return 0
  }

  // laterais: o lábio de grama (um pouco pra fora da borda), uma faixa de terra escura e
  // estratos de rocha, cada um um degrau pra dentro, afinando até a ponta
  const layers = [
    { y: -0.12, scale: 1.035, jitter: 0.01, color: new Color(palette.rim) },
    { y: -0.24, scale: 0.97, jitter: 0.02, color: new Color(palette.rim).lerp(EARTH[0], 0.7) },
    { y: -0.36, scale: 0.95, jitter: 0.03, color: EARTH[0] },
    { y: -0.75 * depth, scale: 0.88, jitter: 0.06, color: EARTH[1] },
    { y: -0.85 * depth, scale: 0.8, jitter: 0.04, color: EARTH[2] },
    { y: -1.35 * depth, scale: 0.7, jitter: 0.08, color: EARTH[3] },
    { y: -1.45 * depth, scale: 0.6, jitter: 0.05, color: EARTH[4] },
    { y: -2.05 * depth, scale: 0.38, jitter: 0.1, color: EARTH[5] },
  ]
  const rim = top[rings - 1]
  let previous = rim
  layers.forEach((layer, index) => {
    const ring = rim.map((p) => {
      const s = layer.scale * (1 + (random() - 0.5) * layer.jitter * 2)
      return new Vector3(p.x * s, layer.y + (index > 2 ? (random() - 0.5) * 0.12 : 0), p.z * s)
    })
    // a face de cima de cada faixa é um pouco mais clara: dá o volume de "degrau"
    const upper = layer.color.clone().offsetHSL(0, 0, 0.05)
    for (let i = 0; i < SIDES; i++) {
      const next = (i + 1) % SIDES
      const out = new Vector3().addVectors(previous[i], previous[next]).setY(0).normalize()
      b.triangleFacing(previous[i], ring[i], ring[next], out, upper, layer.color, layer.color)
      b.triangleFacing(previous[i], ring[next], previous[next], out, upper, layer.color, upper)
    }
    previous = ring
  })
  const tip = new Vector3((random() - 0.5) * 0.3, -2.9 * depth, (random() - 0.5) * 0.3)
  for (let i = 0; i < SIDES; i++) {
    const next = (i + 1) % SIDES
    const out = new Vector3().addVectors(previous[i], previous[next]).setY(0).normalize()
    b.triangleFacing(previous[i], tip, previous[next], out, EARTH[5])
  }

  rocks(b, radius, plants, heightAt, random)
  return { geometry: b.build(), heightAt }
}

/** Algumas pedras perto da borda, longe das plantas. */
function rocks(b: MeshBuilder, radius: number, plants: Spot[], heightAt: IslandShape['heightAt'], random: () => number) {
  const ico = new IcosahedronGeometry(1, 0)
  const pos = ico.getAttribute('position')
  const count = 3 + Math.floor(radius / 2)
  for (let n = 0; n < count; n++) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = random() * TAU
      const r = radius * (0.7 + random() * 0.18)
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      if (plants.some((p) => Math.hypot(p.position_x - x, p.position_z - z) < 0.6)) continue
      const size = 0.12 + random() * 0.16
      const base = new Vector3(x, heightAt(x, z) + size * 0.2, z)
      // o mesmo ponto sempre ganha o mesmo deslocamento: as faces continuam emendadas
      const bumps = new Map<string, number>()
      const vertex = (i: number) => {
        const v = new Vector3().fromBufferAttribute(pos, i)
        const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
        if (!bumps.has(key)) bumps.set(key, 0.8 + random() * 0.4)
        return v.multiplyScalar(size * bumps.get(key)!).multiply(new Vector3(1, 0.7, 1)).add(base)
      }
      for (let t = 0; t < pos.count; t += 3) {
        const [a, c, d] = [vertex(t), vertex(t + 1), vertex(t + 2)]
        const facing = new Vector3().addVectors(a, c).add(d).divideScalar(3).sub(base)
        b.triangleFacing(a, c, d, facing, ROCK[(a.y + c.y + d.y) / 3 > base.y + size * 0.1 ? 1 : 0])
      }
      break
    }
  }
  ico.dispose()
}
