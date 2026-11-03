// Selo de honestidade no jardim: um marquinho de madeira com uma placa facetada na borda
// da ilha. Bronze, prata ou ouro conforme o nível (1, 5 ou 15 "não" assumidos).
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Vector3 } from 'three'
import type { FacetMaterial } from './facetMaterial'
import type { IslandShape, Spot } from './islandGeometry'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'

const TAU = Math.PI * 2
const WOOD = new Color('#8a5a36')
const WOOD_LIGHT = new Color('#a8744a')
const PLAQUE: Record<1 | 2 | 3, [string, string]> = {
  1: ['#b9774a', '#d9a074'], // bronze
  2: ['#a9b4bd', '#dfe6ec'], // prata
  3: ['#e2a93a', '#f7d77a'], // ouro
}

function signGeometry(level: 1 | 2 | 3): BufferGeometry {
  const b = new MeshBuilder(rng(5), 0.05)
  // poste: prisma de 4 lados
  const post = (y: number) => [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * TAU + Math.PI / 4
    return new Vector3(Math.cos(a) * 0.035, y, Math.sin(a) * 0.035)
  })
  b.grid([[...post(0), post(0)[0]], [...post(0.62), post(0.62)[0]]], (row) => (row === 0 ? WOOD : WOOD_LIGHT))
  // placa: hexágono facetado com um "domo" baixo na frente (aponta pra +z) e atrás
  const [dark, light] = PLAQUE[level].map((c) => new Color(c))
  const center = new Vector3(0, 0.62, 0)
  const radius = level === 3 ? 0.2 : 0.17
  const ring = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * TAU + Math.PI / 6
    return new Vector3(Math.cos(a) * radius, 0.62 + Math.sin(a) * radius, 0)
  })
  for (const side of [1, -1]) {
    const tip = center.clone().setZ(0.05 * side)
    for (let k = 0; k < 6; k++) {
      b.triangleFacing(ring[k], ring[(k + 1) % 6], tip, new Vector3(0, 0, side), dark, dark, light)
    }
  }
  return b.build()
}

/** Lugar livre perto da borda, de frente pra câmera (que fica no +z), longe das plantas. */
function freeSpot(radius: number, spots: Spot[]) {
  const r = radius * 0.78
  for (let k = 0; k < 24; k++) {
    const angle = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.22
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    if (spots.every((p) => Math.hypot(p.position_x - x, p.position_z - z) > 0.7)) return { x, z }
  }
  return { x: 0, z: r }
}

interface HonestySignProps {
  level: 1 | 2 | 3
  radius: number
  spots: Spot[]
  heightAt: IslandShape['heightAt']
  material: FacetMaterial
}

export function HonestySign({ level, radius, spots, heightAt, material }: HonestySignProps) {
  const geometry = useMemo(() => signGeometry(level), [level])
  useEffect(() => () => geometry.dispose(), [geometry])

  const place = useMemo(() => freeSpot(radius, spots), [radius, spots])

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[place.x, heightAt(place.x, place.z), place.z]}
      rotation={[0, -0.3 * Math.sign(place.x), 0]}
      castShadow
      name="honesty-sign"
      userData={{ level }}
    />
  )
}
