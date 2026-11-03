// Grama instanciada: uma geometria de tufo desenhada centenas de vezes numa só chamada
// à GPU (InstancedMesh). Junto, florzinhas na cor do jardim espalhadas pela grama.
// Na neve: pouco capim seco, montinhos de neve e flores de neve (edelvais branca,
// campainha-branca pendurada e açafrão na cor do jardim).
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

// ---------- neve ----------

/** Edelvais: estrela de pétalas compridas, branca e "felpuda", com o miolo amarelado. */
function edelweissGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(13), 0.04)
  const white = new Color('#f7f7f2')
  const grey = new Color('#d9ddd5')
  const center = new Vector3(0, 0.09, 0)
  b.triangle(new Vector3(-0.005, 0, 0), new Vector3(0.005, 0, 0), center, new Color('#7d8f6a'), undefined, undefined, 1)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU
    const dir = new Vector3(Math.cos(a), 0.18, Math.sin(a))
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.014)
    const mid = center.clone().addScaledVector(dir, 0.03)
    const tip = center.clone().addScaledVector(dir, 0.062)
    b.triangle(center, mid.clone().add(side), tip, grey, white, white)
    b.triangle(center, tip, mid.clone().sub(side), grey, white, white)
  }
  const ring = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (k / 6) * TAU + 0.3
    return new Vector3(Math.cos(a) * 0.016, 0.098, Math.sin(a) * 0.016)
  })
  b.fan(center.clone().setY(0.106), ring, new Color('#e8dc8e'), new Color('#cfc274'))
  return b.build()
}

/** Campainha-branca: cabinho curvo e um sininho branco pendurado, com uma folha fina. */
function snowdropGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(17), 0.03)
  const green = new Color('#5f8a55')
  const light = new Color('#8fb37c')
  b.triangle(new Vector3(-0.006, 0, 0), new Vector3(0.006, 0, 0), new Vector3(0.012, 0.15, 0), green, green, light, 1)
  b.triangle(new Vector3(-0.004, 0, 0.004), new Vector3(0.006, 0, 0.004), new Vector3(-0.03, 0.1, 0.01), green, green, light, 1)
  const top = new Vector3(0.03, 0.14, 0)
  const white = new Color('#fbfcf9')
  const inner = new Color('#dfeedd')
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.016)
    const tip = top.clone().addScaledVector(out, 0.026).add(new Vector3(0, -0.055, 0))
    b.triangle(top, tip.clone().add(side), tip.clone().sub(side), inner, white, white, 1)
  }
  return b.build()
}

/** Açafrão: copinho de 6 pétalas em pé, na cor do jardim, com o miolo dourado. */
function crocusGeometry(color: string): BufferGeometry {
  const b = new MeshBuilder(rng(19), 0.04)
  const petal = new Color(color)
  const tip = petal.clone().offsetHSL(0, -0.05, 0.12)
  b.triangle(new Vector3(-0.005, 0, 0), new Vector3(0.005, 0, 0), new Vector3(0, 0.07, 0), new Color('#6d9a58'), undefined, undefined, 1)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + (k % 2) * 0.2
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.016)
    const base = new Vector3(0, 0.065, 0).addScaledVector(out, 0.006)
    const top = new Vector3(0, 0.12, 0).addScaledVector(out, 0.03)
    const narrow = side.clone().multiplyScalar(0.4)
    b.triangle(base.clone().add(narrow), base.clone().sub(narrow), top.clone().add(side), petal, petal, tip)
    b.triangle(base.clone().sub(narrow), top.clone().sub(side), top.clone().add(side), petal, tip, tip)
  }
  const heart = [0, 1, 2].map((k) => new Vector3(Math.cos((k / 3) * TAU) * 0.008, 0.08, Math.sin((k / 3) * TAU) * 0.008))
  b.fan(new Vector3(0, 0.085, 0), heart, new Color('#f4c34a'))
  return b.build()
}

/** Montinho de neve: uma cúpula baixa e torta, branca em cima e azulada na beirada. */
function driftGeometry(): BufferGeometry {
  const random = rng(23)
  const b = new MeshBuilder(random, 0.03)
  const sides = 9
  const outer: Vector3[] = []
  const mid: Vector3[] = []
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * TAU
    const j = i === sides ? 0 : i
    const r = 0.22 * (0.85 + ((j * 7919) % 13) / 40)
    outer.push(new Vector3(Math.cos(a) * r, -0.005, Math.sin(a) * r))
    mid.push(new Vector3(Math.cos(a + 0.3) * r * 0.6, 0.05 + ((j * 31) % 5) * 0.004, Math.sin(a + 0.3) * r * 0.6))
  }
  b.grid([outer, mid], (row) => (row === 0 ? new Color('#d4e0ec') : new Color('#eef4f9')))
  b.fan(new Vector3(0.02, 0.075, -0.01), mid, new Color('#ffffff'), new Color('#eef4f9'), 0, false)
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

  if (biome === 'neve') {
    return (
      <group name="grass">
        <Instances geometry={tuft} material={materials.grass} matrices={tufts} name="grass-tufts" />
        <SnowExtras radius={radius} color={color} seed={seed} spots={spots} heightAt={heightAt} materials={materials} />
      </group>
    )
  }

  return (
    <group name="grass">
      <Instances geometry={tuft} material={materials.grass} matrices={tufts} name="grass-tufts" />
      <Instances geometry={flower} material={materials.plant} matrices={flowers} name="grass-flowers" />
    </group>
  )
}

/** Neve: montinhos e as três flores de neve, cada uma espalhada do seu jeito. */
function SnowExtras({ radius, color, seed, spots, heightAt, materials }: Omit<GrassProps, 'biome'>) {
  const geometries = useMemo(() => ({ drift: driftGeometry(), edelweiss: edelweissGeometry(), snowdrop: snowdropGeometry() }), [])
  const crocus = useMemo(() => crocusGeometry(color), [color])
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])
  useEffect(() => () => crocus.dispose(), [crocus])

  const drifts = useMemo(() => scatter(Math.round(6 + radius * 2.2), radius * 0.9, seed + 5, spots, 0.42, heightAt), [radius, seed, spots, heightAt])
  const edelweiss = useMemo(() => scatter(Math.round(3 + radius * 1.4), radius * 0.86, seed + 1, spots, 0.4, heightAt), [radius, seed, spots, heightAt])
  const snowdrops = useMemo(() => scatter(Math.round(3 + radius * 1.6), radius * 0.86, seed + 2, spots, 0.38, heightAt), [radius, seed, spots, heightAt])
  const crocuses = useMemo(() => scatter(Math.round(2 + radius), radius * 0.8, seed + 3, spots, 0.4, heightAt), [radius, seed, spots, heightAt])

  return (
    <>
      <Instances geometry={geometries.drift} material={materials.plant} matrices={drifts} name="snow-drifts" />
      <Instances geometry={geometries.edelweiss} material={materials.plant} matrices={edelweiss} name="snow-edelweiss" />
      <Instances geometry={geometries.snowdrop} material={materials.plant} matrices={snowdrops} name="snow-snowdrops" />
      <Instances geometry={crocus} material={materials.plant} matrices={crocuses} name="snow-crocus" />
    </>
  )
}

