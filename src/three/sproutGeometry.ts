// A muda da tela de login, em peças separadas pra cada uma animar sozinha: caule, folhas
// (brotam e murcham) e uma flor de pétalas soltas (abrem uma por uma). Usa as mesmas
// peças das árvores do jardim (folha em grade, tubo, gema), então o visual é o mesmo.
//
// Unidades: o caule tem 1 de altura, com a base na origem. Folhas e pétalas nascem na
// origem apontando pra +x, então girar no eixo z levanta ou abaixa a ponta.
import { Color, Vector3, type BufferGeometry } from 'three'
import { MeshBuilder } from './meshBuilder'
import { lerp, rng } from './random'
import { bezier, direction, gem, leaf, LEAVES, mound, ramp, STEM, tube, UP } from './treeGeometry'

export const STEM_HEIGHT = 1

const STEM_CURVE = [new Vector3(0, 0, 0), new Vector3(0.17, 0.48, 0.04), new Vector3(0.03, STEM_HEIGHT, 0)] as const

/** Ponto do caule na fração `f` da altura (0 = chão, 1 = ponta). */
export function stemPoint(f: number): Vector3 {
  const [a, c, e] = STEM_CURVE
  return new Vector3()
    .addScaledVector(a, (1 - f) * (1 - f))
    .addScaledVector(c, 2 * (1 - f) * f)
    .addScaledVector(e, f * f)
}

/**
 * Plântula: caule fino e curvado, com um montinho de terra na base e os dois cotilédones
 * (as folhinhas de semente) abertos na ponta. Ela nunca aparece só como um caule pelado.
 */
export function stemGeometry(): BufferGeometry {
  const random = rng(31)
  const b = new MeshBuilder(random, 0.08)
  mound(b, 0.3, random)
  tube(b, bezier(...STEM_CURVE, 10), (f) => lerp(0.036, 0.019, f), 7, (f) => ramp(STEM, 0.15 + f * 0.85), 1)
  // um pra cada lado, um pouco pra trás: as folhas do form brotam na frente deles
  const tip = stemPoint(1)
  for (const side of [-0.25, Math.PI + 0.25]) {
    leaf(b, tip, direction(side, 0.4), UP, { length: 0.3, width: 0.8, cup: 0.42, curl: 0.16 }, LEAVES.cerejeira, 0.72, 3, 4)
  }
  return b.build()
}

/** Folha gordinha, um pouco levantada, com a nervura no meio. */
export function sproutLeafGeometry(length: number): BufferGeometry {
  const b = new MeshBuilder(rng(53), 0.07)
  leaf(b, new Vector3(), direction(0, 0.22), UP, { length, width: 0.72, cup: 0.32, curl: 0.14 }, LEAVES.macieira, 0.6, 4, 5)
  return b.build()
}

const PETAL = ['#c45a80', '#f08fb0', '#f7b8cd', '#fde4ec'].map((c) => new Color(c))
const GOLD = ['#b07a22', '#f2c14e', '#fbe7a6'].map((c) => new Color(c))

/** Pétala em concha, rosa (a primeira cor de jardim do app), mais clara na ponta. */
export function petalGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(71), 0.06)
  leaf(b, new Vector3(), new Vector3(1, 0, 0), UP, { length: 0.27, width: 0.92, cup: 0.5, curl: -0.08 }, PETAL, 0.7, 3, 4)
  return b.build()
}

/** Miolo dourado da flor. */
export function flowerCoreGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(89), 0.05)
  gem(b, new Vector3(0, 0.02, 0), 0.06, GOLD)
  return b.build()
}
