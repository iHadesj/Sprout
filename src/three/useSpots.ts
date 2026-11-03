import { useMemo } from 'react'
import type { Spot } from './islandGeometry'

/**
 * Posições das plantas como lista estável: só muda quando alguma planta muda de lugar
 * (ou nasce), não a cada vez que os dados são buscados de novo. Ilha e grama dependem
 * disto pra não recalcular a geometria à toa.
 */
export function useSpots(plants: Spot[]): Spot[] {
  const key = plants.map((p) => `${p.position_x.toFixed(2)},${p.position_z.toFixed(2)}`).join(';')
  return useMemo(
    () =>
      key
        ? key.split(';').map((pair) => {
            const [x, z] = pair.split(',').map(Number)
            return { position_x: x, position_z: z }
          })
        : [],
    [key],
  )
}
