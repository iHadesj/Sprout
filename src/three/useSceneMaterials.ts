// Materiais compartilhados pela cena inteira (criados uma vez, descartados ao sair).
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'
import { mixHex } from './daylight'
import { createDeadPlantMaterial, createFacetMaterial, createPlantMaterial, setRimTint, RIM_DAY, RIM_NIGHT, type FacetMaterial } from './facetMaterial'
import type { SeasonLook } from './season'

export interface SceneMaterials {
  plant: FacetMaterial
  dead: FacetMaterial
  island: FacetMaterial
  grass: FacetMaterial
}

export interface SceneMaterialOptions {
  /** jardim sem sessão há 3 dias: folhas e grama amarelam (nada é apagado) */
  yellow: number
  /** falso com "reduzir movimento": o vento para */
  motion: boolean
  /** profundidade da ilha: a terra lá embaixo se dissolve no papel */
  depth: number
  /** 0 de dia, 1 na noite fechada: o brilho de contorno vira luar */
  night?: number
  /** estação do ano: tinge a copa e, mais de leve, a grama */
  season?: SeasonLook | null
}

export function useSceneMaterials({ yellow, motion, depth, night = 0, season = null }: SceneMaterialOptions): SceneMaterials {
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

  // a árvore seca não muda de estação: ela já está fora do ciclo
  useEffect(() => {
    const [r, g, b] = season?.tint ?? [1, 1, 1]
    for (const [material, amount] of [
      [materials.plant, season?.tintAmount ?? 0],
      [materials.grass, season?.grassAmount ?? 0],
    ] as const) {
      material.userData.uniforms.uSeason.value.setRGB(r, g, b)
      material.userData.uniforms.uSeasonMix.value = amount
    }
  }, [materials, season])

  useEffect(() => {
    const tint = mixHex(RIM_DAY, RIM_NIGHT, night)
    for (const material of Object.values(materials)) setRimTint(material, tint)
  }, [materials, night])

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
