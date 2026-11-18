// Enquadramento geral da ilha: de que distância a câmera vê a ilha inteira, pela largura E pela
// altura do quadro, sem nada cair na faixa esfumada da moldura (--scene-fade-x/-y no tokens.css).
//
// Antes a distância saía só da largura. Numa moldura larga e baixa (notebook, ainda mais com a
// escala do Windows), a ilha cabia de lado a lado mas as copas passavam do topo, e nas ilhas
// grandes a beirada encostava nas laterais. Aqui a conta é feita de verdade: pra cada distância,
// os pontos da ilha são projetados na tela, e uma busca binária acha a menor distância que serve.
// Função pura (sem three.js), testada no framing.test.ts.

/** Abertura vertical da câmera, em graus (a mesma do <Canvas>). */
export const FOV = 38
/** Inclinação da câmera: um pouco acima, dá pra ver a terra embaixo da ilha. */
export const ELEVATION = 0.36
/** Pra onde a câmera olha, antes de centralizar (um pouco abaixo do chão). */
export const TARGET_Y = -0.45

/**
 * Até onde a ilha pode ir, em coordenadas de tela (-1 a 1, a partir do centro), pra ficar fora
 * do esfumado: dos lados ele ocupa 9% de cada borda, em cima 9%. Embaixo a terra pode entrar no
 * esfumado (ela já se dissolve no papel), mas a beirada da grama não.
 */
const LIMIT = { side: 0.78, top: 0.78, bottom: -0.5 }

/** Altura do alto das copas (árvore adulta já na escala da ilha). */
const CANOPY_TOP = 1.9

interface Point {
  x: number
  y: number
  z: number
}

/** Pontos que contornam a ilha: beirada da grama, lábio de terra e o alto das copas. */
function outline(radius: number): Point[] {
  const points: Point[] = []
  const SAMPLES = 36
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2
    const [c, s] = [Math.cos(a), Math.sin(a)]
    // o contorno ondula até ~1,1 do raio, e a ilha gira: vale o círculo inteiro
    points.push({ x: c * radius * 1.1, y: 0, z: s * radius * 1.1 })
    points.push({ x: c * radius * 1.07, y: -0.36, z: s * radius * 1.07 })
    // as plantas ficam a no máximo raio - 1,1 do centro; a copa abre um pouco mais que isso
    const canopy = Math.max(0.3, radius - 0.6)
    points.push({ x: c * canopy, y: CANOPY_TOP, z: s * canopy })
  }
  return points
}

interface Extent {
  /** maior |x| na tela, alto das copas e beirada de baixo (tudo de -1 a 1) */
  side: number
  top: number
  bottom: number
}

/** Onde a ilha cai na tela com a câmera a `distance` de um alvo na altura `targetY`. */
function extent(points: Point[], distance: number, aspect: number, targetY: number): Extent | null {
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180)
  const tanH = tanV * aspect
  // câmera em (0, alvo + d·sen e, d·cos e), olhando pro alvo (0, alvo, 0)
  const [sinE, cosE] = [Math.sin(ELEVATION), Math.cos(ELEVATION)]
  const cam = { y: targetY + distance * sinE, z: distance * cosE }
  const out = { side: 0, top: -Infinity, bottom: Infinity }
  for (const p of points) {
    const dy = p.y - cam.y
    const dz = p.z - cam.z
    // eixos da câmera: pra frente (0, -sen e, -cos e), pra cima (0, cos e, -sen e), lado = x
    const depth = -dy * sinE - dz * cosE
    if (depth <= 0.1) return null // ponto atrás da câmera: perto demais
    const up = dy * cosE - dz * sinE
    out.side = Math.max(out.side, Math.abs(p.x / (depth * tanH)))
    const sy = up / (depth * tanV)
    if (p.y > 0) out.top = Math.max(out.top, sy)
    else out.bottom = Math.min(out.bottom, sy)
  }
  return out
}

const fits = (e: Extent | null) => !!e && e.side <= LIMIT.side && e.top <= LIMIT.top && e.bottom >= LIMIT.bottom

/** Menor distância em que a ilha inteira cabe, com o alvo na altura `targetY`. */
function nearest(points: Point[], radius: number, aspect: number, targetY: number): number {
  let lo = radius * 0.5
  let hi = radius * 12 + 20
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (fits(extent(points, mid, aspect, targetY))) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * Enquadramento geral: distância e altura do alvo. A altura do alvo é ajustada pra a ilha ficar
 * no meio da faixa permitida (sem sobrar céu vazio em cima), o que deixa a câmera chegar mais
 * perto numa moldura baixa.
 */
function solve(radius: number, aspect: number) {
  const points = outline(radius)
  const safeAspect = Math.min(Math.max(aspect, 0.3), 4)
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180)
  let targetY = TARGET_Y
  let distance = nearest(points, radius, safeAspect, targetY)
  for (let i = 0; i < 6; i++) {
    const e = extent(points, distance, safeAspect, targetY)
    if (!e) break
    // quanto a ilha está acima (+) ou abaixo (-) do meio da faixa, em unidades da cena
    const off = (e.top + e.bottom) / 2 - (LIMIT.top + LIMIT.bottom) / 2
    targetY += off * distance * tanV * 0.9
    // o alvo não sai do corpo da ilha (entre a terra lá embaixo e o alto das copas)
    targetY = Math.min(Math.max(targetY, -2.5), 1)
    distance = nearest(points, radius, safeAspect, targetY)
  }
  // nunca perto demais: a perspectiva deforma a ilha pequena
  return { distance: Math.max(distance, radius + 3), targetY }
}

/** Distância (do alvo) do enquadramento geral, pra uma moldura de proporção `aspect`. */
export function frameDistance(radius: number, aspect: number): number {
  return solve(radius, aspect).distance
}

/** Posição da câmera e alvo do enquadramento geral. */
export function frameCamera(radius: number, aspect: number) {
  const { distance, targetY } = solve(radius, aspect)
  return {
    distance,
    position: { x: 0, y: targetY + distance * Math.sin(ELEVATION), z: distance * Math.cos(ELEVATION) },
    target: { x: 0, y: targetY, z: 0 },
  }
}
