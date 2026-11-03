// Coração low poly facetado, a partir do coração 3D clássico (uma equação):
// (x² + 9/4·z² + y² − 1)³ − x²·y³ − 9/80·z²·y³ = 0, com y pra cima e z = profundidade.
// Uma grade de direções (latitude x longitude) vai do centro até a superfície; com poucas
// linhas e colunas, as facetas ficam grandes e aparentes.
import { Color, Vector3, type BufferGeometry } from 'three'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'

function field(x: number, y: number, z: number): number {
  return (x * x + 2.25 * z * z + y * y - 1) ** 3 - x * x * y ** 3 - (9 / 80) * z * z * y ** 3
}

/** Distância do centro até a superfície, na direção `d` (unitária): busca + bisseção. */
function surfaceDistance(d: Vector3): number {
  let t = 0
  while (t < 2 && field(d.x * t, d.y * t, d.z * t) < 0) t += 0.04
  let lo = t - 0.04
  let hi = t
  for (let i = 0; i < 16; i++) {
    const m = (lo + hi) / 2
    if (field(d.x * m, d.y * m, d.z * m) < 0) lo = m
    else hi = m
  }
  return lo
}

const DARK = new Color('#8e1a37')
const LIGHT = new Color('#ef6a8a')

/** Coração com ~1 de altura, centrado na origem (a ponta fica em y ≈ -0,45). */
export function heartGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(14), 0.12)
  const rows = 8
  const cols = 12
  const scale = 0.45
  const grid: Vector3[][] = []
  for (let j = 0; j <= rows; j++) {
    const phi = (j / rows) * Math.PI
    const ring: Vector3[] = []
    for (let i = 0; i <= cols; i++) {
      const theta = (i / cols) * Math.PI * 2 + j * 0.3
      const d = new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
      ring.push(d.multiplyScalar(surfaceDistance(d) * scale))
    }
    grid.push(ring)
  }
  // mais claro em cima (onde bate a luz), mais escuro na ponta
  b.grid(grid, (row) => LIGHT.clone().lerp(DARK, row / rows))
  return b.build()
}
