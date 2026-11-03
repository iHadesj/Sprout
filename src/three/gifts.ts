// Peças low poly dos presentes: o regador (corpo torneado, bico, alça e o chuveirinho) e a
// gota d'água. Mesmo jeito das árvores: MeshBuilder, facetas e cor por vértice.
import { Color, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'
import { bezier, lathe, ramp, tube } from './treeGeometry'

const TIN = [new Color('#5f7d8f'), new Color('#86a5b6'), new Color('#c4d9e3')]
const TIN_DARK = new Color('#4a6474')
const WATER = [new Color('#5ea8d6'), new Color('#bfe5f7')]

/** Onde a água sai, nas coordenadas do regador (a ponta do chuveirinho). */
export const SPOUT_TIP = new Vector3(1.32, 0.98, 0)

/** Regador com ~1,3 de comprimento: corpo em pé, bico pra +x, alça em cima. */
export function wateringCanGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(31), 0.08)
  const profile: [number, number][] = [
    [0, 0],
    [0.48, 0],
    [0.55, 0.06],
    [0.56, 0.72],
    [0.5, 0.8],
    [0.32, 0.84],
    [0, 0.84],
  ]
  lathe(b, profile, 10, (v) => v, (row) => ramp(TIN, row / (profile.length - 1)))
  // bico: sai da base do corpo e sobe até o chuveirinho
  tube(b, bezier(new Vector3(0.45, 0.18, 0), new Vector3(0.95, 0.35, 0), new Vector3(1.22, 0.92, 0), 5), (f) => 0.085 - f * 0.035, 6, (f) => ramp(TIN, 0.3 + f * 0.5))
  // chuveirinho: um cone curto virado pra frente
  const rose: [number, number][] = [
    [0.04, 0],
    [0.11, 0.12],
    [0.11, 0.14],
    [0, 0.14],
  ]
  const axis = new Vector3(1, 0.85, 0).normalize()
  const base = new Vector3(1.2, 0.9, 0)
  lathe(
    b,
    rose,
    8,
    (v) => {
      // gira o cone (feito em pé, no eixo y) pra apontar na direção do bico
      const up = new Vector3(0, 1, 0)
      const q = new Vector3().crossVectors(up, axis)
      const angle = Math.acos(up.dot(axis))
      return v.applyAxisAngle(q.normalize(), angle).add(base)
    },
    (row) => (row >= 2 ? TIN_DARK : TIN[1]),
  )
  // alça: arco por cima do corpo
  tube(b, bezier(new Vector3(-0.42, 0.78, 0), new Vector3(-0.1, 1.5, 0), new Vector3(0.3, 0.8, 0), 7), () => 0.045, 6, () => TIN[0])
  return b.build()
}

/** Gotinha: icosaedro esticado, azul claro em cima. */
export function dropGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(32), 0.06)
  const ico = new IcosahedronGeometry(1, 0)
  const pos = ico.getAttribute('position')
  const v = [new Vector3(), new Vector3(), new Vector3()]
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).multiply(new Vector3(0.035, 0.07, 0.035))
    const h = (v[0].y + v[1].y + v[2].y) / 3 / 0.07
    b.triangle(v[0].clone(), v[1].clone(), v[2].clone(), ramp(WATER, 0.5 + h * 0.5))
  }
  ico.dispose()
  return b.build()
}
