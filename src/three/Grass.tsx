// Grama instanciada: uma geometria de tufo desenhada centenas de vezes numa só chamada
// à GPU (InstancedMesh). Junto, florzinhas na cor do jardim espalhadas pela grama.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import type { Biome } from '../features/gardens/gardenOptions'
import type { FacetMaterial } from './facetMaterial'
import { BIOME_COLORS, type IslandShape, type Spot } from './islandGeometry'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'
import type { SceneMaterials } from './useSceneMaterials'

interface GrassProps {
  radius: number
  biome: Biome
  color: string
  seed: number
  /** posições das plantas (estáveis: vêm do useSpots) */
  spots: Spot[]
  heightAt: IslandShape['heightAt']
  materials: SceneMaterials
}

const TAU = Math.PI * 2

function tuftGeometry(biome: Biome): BufferGeometry {
  const [dark, light] = BIOME_COLORS[biome].grass.map((c) => new Color(c))
  const b = new MeshBuilder(rng(7), 0.08)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.4
    const lean = new Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04)
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.014)
    const height = 0.13 + k * 0.03
    b.triangle(side.clone().negate(), side.clone(), lean.clone().setY(height), dark, dark, light, 1)
  }
  return b.build()
}

function flowerGeometry(color: string): BufferGeometry {
  const petal = new Color(color)
  const gold = new Color('#f4c34a')
  const b = new MeshBuilder(rng(11), 0.05)
  const center = new Vector3(0, 0.11, 0)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU
    const tip = new Vector3(Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08)
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.026)
    b.triangle(center.clone().add(side), center.clone().sub(side), tip, petal)
  }
  b.triangle(new Vector3(-0.005, 0, 0), new Vector3(0.005, 0, 0), new Vector3(0, 0.11, 0), new Color('#4d9a4a'), undefined, undefined, 1)
  const ring = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * TAU + 0.6
    return new Vector3(Math.cos(a) * 0.022, 0.118, Math.sin(a) * 0.022)
  })
  b.fan(center.clone().setY(0.128), ring, gold)
  return b.build()
}

/** Pontos espalhados no topo da ilha, pousados no relevo e longe das plantas. */
function scatter(count: number, radius: number, seed: number, spots: Spot[], minGap: number, heightAt: IslandShape['heightAt']) {
  const random = rng(seed)
  const matrices: Matrix4[] = []
  const q = new Quaternion()
  const yAxis = new Vector3(0, 1, 0)
  for (let n = 0; n < count * 2 && matrices.length < count; n++) {
    const r = radius * Math.sqrt(random())
    const a = random() * TAU
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (spots.some((p) => Math.hypot(p.position_x - x, p.position_z - z) < minGap)) continue
    q.setFromAxisAngle(yAxis, random() * TAU)
    const s = 0.65 + random() * 0.6
    matrices.push(new Matrix4().compose(new Vector3(x, heightAt(x, z) - 0.01, z), q, new Vector3(s, s * (0.8 + random() * 0.5), s)))
  }
  return matrices
}

function Instances({ geometry, material, matrices, name }: { geometry: BufferGeometry; material: FacetMaterial; matrices: Matrix4[]; name: string }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} receiveShadow name={name} />
}

export function Grass({ radius, biome, color, seed, spots, heightAt, materials }: GrassProps) {
  const tuft = useMemo(() => tuftGeometry(biome), [biome])
  const flower = useMemo(() => flowerGeometry(color), [color])
  useEffect(() => () => tuft.dispose(), [tuft])
  useEffect(() => () => flower.dispose(), [flower])

  const density = biome === 'neve' ? 4 : 8
  const tufts = useMemo(
    () => scatter(Math.round(40 + density * radius * radius), radius * 0.93, seed, spots, 0.3, heightAt),
    [radius, seed, spots, density, heightAt],
  )
  const flowers = useMemo(
    () => scatter(Math.round(4 + radius * 2.5), radius * 0.86, seed + 1, spots, 0.45, heightAt),
    [radius, seed, spots, heightAt],
  )

  return (
    <group name="grass">
      <Instances geometry={tuft} material={materials.grass} matrices={tufts} name="grass-tufts" />
      <Instances geometry={flower} material={materials.plant} matrices={flowers} name="grass-flowers" />
    </group>
  )
}
