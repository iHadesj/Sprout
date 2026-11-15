// Onde fica a árvore velha da surpresa. Fica num arquivo só dele porque a árvore (OldTree) e o
// cervinho que corre pra trás dela (Fawn) precisam do mesmo lugar.
import type { Spot } from './islandGeometry'

/** Lugar livre na frente da ilha (a câmera fica no +z), longe das plantas e da placa do selo. */
export function oldTreeSpot(radius: number, spots: Spot[]): { x: number; z: number } {
  let best = { x: 0, z: 0, score: -Infinity }
  const reach = radius * 0.7
  const taken = [...spots, { position_x: 0, position_z: radius * 0.78 }]
  for (let gx = -reach; gx <= reach; gx += 0.2) {
    for (let gz = -reach; gz <= reach; gz += 0.2) {
      if (Math.hypot(gx, gz) > reach) continue
      const gap = taken.reduce((min, p) => Math.min(min, Math.hypot(p.position_x - gx, p.position_z - gz)), 3)
      const score = Math.min(gap, 1.3) - Math.hypot(gx + radius * 0.25, gz - radius * 0.45) * 0.2
      if (score > best.score) best = { x: gx, z: gz, score }
    }
  }
  return { x: best.x, z: best.z }
}
