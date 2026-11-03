// Flores que amigos plantaram na ilha (tabela flowers): uma florzinha low poly na cor que a
// pessoa escolheu, maior que as da grama. Passar o mouse (ou tocar) mostra quem plantou.
// Ao aparecer, ela brota (cresce do chão com um pulinho).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, Group, Vector3, type BufferGeometry } from 'three'
import type { GardenFlower } from '../lib/api'
import type { FacetMaterial } from './facetMaterial'
import type { IslandShape } from './islandGeometry'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'
import styles from './FriendFlowers.module.css'

const TAU = Math.PI * 2
const STEM = new Color('#4d8a45')
const GOLD = new Color('#f2c14e')

const cache = new Map<string, BufferGeometry>()

/** Flor de 5 pétalas em cima de um caule com uma folha. Uma geometria por cor. */
function flowerGeometry(hex: string): BufferGeometry {
  const hit = cache.get(hex)
  if (hit) return hit
  const petal = new Color(hex)
  const light = petal.clone().lerp(new Color('#ffffff'), 0.35)
  const b = new MeshBuilder(rng(41), 0.08)
  const top = new Vector3(0, 0.3, 0)
  // caule (dois triângulos cruzados, aparece de qualquer lado) e uma folha
  for (const a of [0, Math.PI / 2]) {
    const side = new Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.014)
    b.triangle(side.clone().negate(), side.clone(), top.clone(), STEM, STEM, STEM, 1)
  }
  b.triangle(new Vector3(0, 0.1, 0), new Vector3(0.12, 0.17, 0.02), new Vector3(0.02, 0.16, 0), STEM, STEM.clone().lerp(GOLD, 0.2), STEM, 1)
  // pétalas: losangos levemente inclinados pra cima, a ponta mais clara
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU
    const dir = new Vector3(Math.cos(a), 0.35, Math.sin(a)).normalize()
    const across = new Vector3(-Math.sin(a), 0, Math.cos(a))
    const mid = top.clone().addScaledVector(dir, 0.07)
    const tip = top.clone().addScaledVector(dir, 0.13)
    b.triangle(top.clone(), mid.clone().addScaledVector(across, 0.045), tip, petal, petal, light)
    b.triangle(top.clone(), tip.clone(), mid.clone().addScaledVector(across, -0.045), petal, light, petal)
  }
  // miolo dourado
  const ring = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * TAU + 0.6
    return new Vector3(Math.cos(a) * 0.03, 0.31, Math.sin(a) * 0.03)
  })
  b.fan(new Vector3(0, 0.33, 0), ring, GOLD, GOLD.clone().lerp(new Color('#c98a2a'), 0.5))
  const geometry = b.build()
  cache.set(hex, geometry)
  return geometry
}

interface FriendFlowersProps {
  flowers: GardenFlower[]
  heightAt: IslandShape['heightAt']
  material: FacetMaterial
}

export function FriendFlowers({ flowers, heightAt, material }: FriendFlowersProps) {
  return (
    <group name="friend-flowers">
      {flowers.map((f) => (
        <Flower key={f.id} flower={f} y={heightAt(f.position_x, f.position_z)} material={material} />
      ))}
    </group>
  )
}

function Flower({ flower, y, material }: { flower: GardenFlower; y: number; material: FacetMaterial }) {
  const geometry = flowerGeometry(flower.color)
  const group = useRef<Group>(null)
  const grow = useRef(0)
  const [hover, setHover] = useState(false)
  const invalidate = useThree((s) => s.invalidate)
  const yaw = useMemo(() => rng(flower.id.length * 13 + flower.color.length)() * TAU, [flower.id, flower.color])

  useEffect(
    () => () => {
      document.body.style.removeProperty('cursor')
    },
    [],
  )

  useFrame((_, delta) => {
    const g = group.current
    if (!g || grow.current >= 1) return
    grow.current = Math.min(1, grow.current + delta / 0.9)
    const k = grow.current
    // brota passando um pouco do tamanho e volta
    g.scale.setScalar(1.6 * (1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2))
    invalidate()
  })

  return (
    <group ref={group} position={[flower.position_x, y, flower.position_z]} rotation={[0, yaw, 0]} scale={0}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'help'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.removeProperty('cursor')
        }}
        onClick={(e) => {
          e.stopPropagation()
          setHover((h) => !h)
        }}
      />
      {hover && (
        <Html position={[0, 0.5, 0]} center zIndexRange={[20, 0]}>
          <span className={styles.tag}>plantada por {flower.from_username ? `@${flower.from_username}` : 'um amigo'}</span>
        </Html>
      )}
    </group>
  )
}
