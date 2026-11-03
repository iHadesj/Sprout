// Materiais compartilhados pela cena inteira (criados uma vez, descartados ao sair).
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'
import { createDeadPlantMaterial, createFacetMaterial, createPlantMaterial, type FacetMaterial } from './facetMaterial'

export interface SceneMaterials {
  plant: FacetMaterial
  dead: FacetMaterial
  island: FacetMaterial
  grass: FacetMaterial
}

/**
 * `yellow` = jardim sem sessão há 3 dias: folhas e grama amarelam (nada é apagado).
 * `motion` = falso com "reduzir movimento": o vento para.
 * `depth` = profundidade da ilha: a terra lá embaixo se dissolve no papel.
 */
export function useSceneMaterials(yellow: number, motion: boolean, depth: number): SceneMaterials {
  const materials = useMemo<SceneMaterials>(
    () => ({
      plant: createPlantMaterial(),
      dead: createDeadPlantMaterial(),
      island: createFacetMaterial({ edge: 0.1, rim: 0.12 }),
      grass: createFacetMaterial({ side: DoubleSide, wind: 1.1, edge: 0, rim: 0.1 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useEffect(() => {
    materials.plant.userData.uniforms.uYellow.value = yellow
    materials.grass.userData.uniforms.uYellow.value = yellow
  }, [materials, yellow])

  useEffect(() => {
    const u = materials.island.userData.uniforms
    u.uFadeLo.value = -2.85 * depth
    u.uFadeHi.value = -1.1 * depth
  }, [materials, depth])

  // relógio do vento (árvores e grama)
  useFrame(({ clock }) => {
    if (!motion) return
    materials.plant.userData.uniforms.uTime.value = clock.elapsedTime
    materials.grass.userData.uniforms.uTime.value = clock.elapsedTime
  })

  return materials
}
