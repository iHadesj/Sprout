// Árvore velha (só no navegador marcado pelo link secreto, ver src/features/surprise): uma árvore grande que já
// está na ilha desde o primeiro dia, com um coração e "E + F" entalhados no tronco, de frente
// pra câmera. Clicar no entalhe solta um coração low poly facetado que sobe girando.
// É cenário: não está no banco e não conta como planta.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { BufferAttribute, CylinderGeometry, Group } from 'three'
import { carvingTexture } from './carving'
import { createFacetMaterial, type FacetMaterial } from './facetMaterial'
import { heartGeometry } from './heart'
import type { IslandShape, Spot } from './islandGeometry'
import { OLD_TREE, oldTreeBandRadius, oldTreeGeometry } from './treeGeometry'

/** Abertura (em radianos) do pedaço de casca com o entalhe. */
const ARC = 1.7
const HEART_LIFE = 2.6

/** Pedaço de cilindro um tiquinho por fora do tronco, na faixa reta. */
function carvingGeometry() {
  const { bandBottom, bandTop } = OLD_TREE
  const r = oldTreeBandRadius() * 1.025
  const geometry = new CylinderGeometry(r, r, bandTop - bandBottom, 24, 1, true, -ARC / 2, ARC)
  geometry.translate(0, (bandTop + bandBottom) / 2, 0)
  // atributos que o material facetado espera: cor branca (a textura dá a cor), sem amarelar e sem arestas
  const n = geometry.getAttribute('position').count
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  geometry.setAttribute('leafy', new BufferAttribute(new Float32Array(n), 1))
  geometry.setAttribute('bary', new BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  return geometry
}

/** Lugar livre na frente da ilha (a câmera fica no +z), longe das plantas e da placa do selo. */
function freestSpot(radius: number, spots: Spot[]) {
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
  return best
}

interface OldTreeProps {
  radius: number
  spots: Spot[]
  heightAt: IslandShape['heightAt']
  /** o mesmo material das árvores (vento igual) */
  material: FacetMaterial
  motion: boolean
  /** jardim de neve: neve em cima da copa */
  snowy?: boolean
}

let nextPop = 0

export function OldTree({ radius, spots, heightAt, material, motion, snowy = false }: OldTreeProps) {
  const geometry = oldTreeGeometry(snowy)
  const carving = useMemo(() => carvingGeometry(), [])
  const carvingMaterial = useMemo(() => {
    // mesmo vento das árvores: o entalhe balança junto com o tronco
    const m = createFacetMaterial({ edge: 0, rim: 0.12, wind: 0.045, roughness: 0.9 })
    m.map = carvingTexture()
    m.transparent = true
    m.depthWrite = false
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    return m
  }, [])
  const heart = useMemo(() => ({ geometry: heartGeometry(), material: createFacetMaterial({ edge: 0.6, rim: 0.4, roughness: 0.45 }) }), [])
  useEffect(
    () => () => {
      carving.dispose()
      carvingMaterial.map?.dispose()
      carvingMaterial.dispose()
      heart.geometry.dispose()
      heart.material.dispose()
      document.body.style.cursor = ''
    },
    [carving, carvingMaterial, heart],
  )

  const place = useMemo(() => freestSpot(radius, spots), [radius, spots])
  const [pops, setPops] = useState<number[]>([])

  useFrame(({ clock }) => {
    const u = carvingMaterial.userData.uniforms
    if (motion) u.uTime.value = clock.elapsedTime
  })

  const pop = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (event.delta > 6) return // foi um arrasto pra girar a câmera, não um clique
    nextPop += 1
    const id = nextPop
    setPops((list) => [...list, id])
  }

  const start: [number, number, number] = [0, (OLD_TREE.bandBottom + OLD_TREE.bandTop) / 2, oldTreeBandRadius()]

  return (
    <group position={[place.x, heightAt(place.x, place.z), place.z]} name="old-tree">
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh
        geometry={carving}
        material={carvingMaterial}
        name="carving"
        onClick={pop}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      />
      {pops.map((id) => (
        <HeartPop
          key={id}
          start={start}
          motion={motion}
          geometry={heart.geometry}
          material={heart.material}
          onDone={() => setPops((list) => list.filter((x) => x !== id))}
        />
      ))}
    </group>
  )
}

interface HeartPopProps {
  start: [number, number, number]
  motion: boolean
  geometry: ReturnType<typeof heartGeometry>
  material: FacetMaterial
  onDone: () => void
}

/** O coração: nasce do entalhe com um pulinho, sobe pra frente girando e encolhe no fim. */
function HeartPop({ start, motion, geometry, material, onDone }: HeartPopProps) {
  const ref = useRef<Group>(null)
  const age = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  useFrame((_, delta) => {
    const g = ref.current
    if (!g || age.current < 0) return
    age.current += Math.min(delta, 0.05)
    const t = age.current / HEART_LIFE
    if (t >= 1) {
      age.current = -1 // avisa uma vez só
      onDone()
      return
    }
    // aparece passando um pouco do tamanho e volta (easeOutBack), e some encolhendo
    const k = Math.min(1, t / 0.16)
    const grow = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2
    const shrink = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1
    const rise = 1 - (1 - t) ** 2
    g.scale.setScalar(0.32 * grow * shrink)
    g.position.set(start[0], start[1] + (motion ? rise * 0.95 : 0.12), start[2] + (motion ? rise * 0.5 : 0.12))
    g.rotation.y = motion ? t * Math.PI * 2.4 : 0
    invalidate() // com "reduzir movimento" a cena só redesenha quando pedem
  })

  return (
    <group ref={ref} scale={0} position={start}>
      <mesh geometry={geometry} material={material} castShadow name="heart-pop" />
    </group>
  )
}
