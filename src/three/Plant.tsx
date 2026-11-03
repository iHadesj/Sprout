// Plantas na cena.
// - GrowingPlant: a planta da vez, com detalhe máximo e material próprio. Anima a troca
//   de estágio (cresce e brilha).
// - PlantField: adultas e secas, desenhadas com InstancedMesh (uma chamada à GPU por
//   espécie+estágio) e com LOD: de longe, uma versão com bem menos triângulos.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Detailed } from '@react-three/drei'
import { Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { lookOf, stageOf, type Look } from '../features/gardens/plants'
import type { Plant } from '../lib/api'
import { createPlantMaterial, type FacetMaterial } from './facetMaterial'
import type { IslandShape } from './islandGeometry'
import { treeGeometry, type Detail } from './treeGeometry'
import { hashString, rng } from './random'

const TAU = Math.PI * 2
/** As árvores aparecem um pouco maiores que o modelo: na ilha, "fofas" e cheias. */
const TREE_SCALE = 1.2

/** `groundY` = altura do chão da ilha onde a planta está. */
interface GrowingPlantProps {
  plant: Plant
  color: string
  /** bioma do jardim: na neve a árvore aparece como a prima de neve dela */
  biome: string
  motion: boolean
  groundY: number
}

export function GrowingPlant({ plant, color, biome, motion, groundY }: GrowingPlantProps) {
  const species = lookOf(plant, biome)
  const geometry = treeGeometry(species, plant.growth, color, 'high')
  const material = useMemo(() => createPlantMaterial(), [])
  useEffect(() => () => material.dispose(), [material])

  const group = useRef<Group>(null)
  const anim = useRef({ scale: 1, glow: 0 })
  const yaw = useMemo(() => rng(hashString(plant.id))() * TAU, [plant.id])

  // troca de estágio: a árvore nova começa menor e brilhando
  const shownGrowth = useRef(plant.growth)
  useEffect(() => {
    if (plant.growth === shownGrowth.current) return
    shownGrowth.current = plant.growth
    anim.current.scale = 0.8
    anim.current.glow = 1.4
  }, [plant.growth])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const a = anim.current
    a.scale += (1 - a.scale) * (1 - Math.exp(-delta * 3))
    a.glow = Math.max(0, a.glow - delta * 0.8)

    const t = state.clock.elapsedTime
    g.rotation.set(0, yaw, 0)
    g.scale.setScalar(TREE_SCALE * a.scale)

    const u = material.userData.uniforms
    if (motion) u.uTime.value = t
    u.uGlow.value = a.glow
  })

  return (
    <group
      ref={group}
      position={[plant.position_x, groundY, plant.position_z]}
      name="plant-growing"
      userData={{ plantId: plant.id, gardenId: plant.garden_id, species, growth: plant.growth, stage: stageOf(plant.growth) }}
    >
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </group>
  )
}

interface PlantGroup {
  key: string
  species: Look
  growth: number
  dead: boolean
  plants: Plant[]
}

/** Posição, giro e tamanho de cada planta (sempre iguais pra mesma planta). Seca = tombada. */
function plantMatrix(plant: Plant, dead: boolean, heightAt: IslandShape['heightAt']): Matrix4 {
  const random = rng(hashString(plant.id))
  const yaw = random() * TAU
  const size = TREE_SCALE * (0.92 + random() * 0.16)
  const tilt = dead ? 0.22 + random() * 0.18 : 0
  const tiltDir = random() * TAU
  const rotation = new Quaternion().setFromEuler(new Euler(Math.cos(tiltDir) * tilt, yaw, Math.sin(tiltDir) * tilt))
  const scale = new Vector3(size, size * (dead ? 0.9 : 1), size)
  const ground = heightAt(plant.position_x, plant.position_z)
  return new Matrix4().compose(new Vector3(plant.position_x, ground, plant.position_z), rotation, scale)
}

function PlantInstances({ group, color, detail, material, heightAt }: { group: PlantGroup; color: string; detail: Detail; material: FacetMaterial; heightAt: IslandShape['heightAt'] }) {
  const geometry = treeGeometry(group.species, group.growth, color, detail)
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    group.plants.forEach((p, i) => mesh.setMatrixAt(i, plantMatrix(p, group.dead, heightAt)))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [group, heightAt])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, group.plants.length]}
      castShadow
      receiveShadow
      name={`plants:${group.key}`}
      userData={{ ids: group.plants.map((p) => p.id), species: group.species, growth: group.growth, dead: group.dead }}
    />
  )
}

interface PlantFieldProps {
  plants: Plant[]
  color: string
  biome: string
  lodDistance: number
  heightAt: IslandShape['heightAt']
  materials: { plant: FacetMaterial; dead: FacetMaterial }
}

export function PlantField({ plants, color, biome, lodDistance, heightAt, materials }: PlantFieldProps) {
  const groups = useMemo(() => {
    const map = new Map<string, PlantGroup>()
    for (const plant of plants) {
      if (plant.status === 'growing') continue
      const dead = plant.status === 'dead'
      const species = lookOf(plant, biome)
      const key = `${species}:${plant.growth}:${dead ? 'dead' : 'grown'}`
      const group = map.get(key) ?? { key, species, growth: plant.growth, dead, plants: [] }
      group.plants.push(plant)
      map.set(key, group)
    }
    return [...map.values()]
  }, [plants, biome])

  if (groups.length === 0) return null

  const level = (detail: Detail) => (
    <group key={detail}>
      {groups.map((group) => (
        <PlantInstances
          key={`${group.key}:${group.plants.length}:${detail}`}
          group={group}
          color={color}
          detail={detail}
          material={group.dead ? materials.dead : materials.plant}
          heightAt={heightAt}
        />
      ))}
    </group>
  )

  // perto da câmera a versão completa; longe, a simplificada
  return <Detailed distances={[0, lodDistance]}>{[level('high'), level('low')]}</Detailed>
}
