// Cena 3D de um jardim: ilha flutuante, plantas, grama, pólen e câmera.
// É carregada sob demanda (React.lazy no GardenStage): o three.js é pesado e as telas
// que não mostram o jardim não precisam baixá-lo.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Float, OrbitControls } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import { NeutralToneMapping, Vector3 } from 'three'
import { biomeOf } from '../features/gardens/gardenOptions'
import type { Garden, Plant } from '../lib/api'
import { isForHer } from '../features/surprise/surprise'
import { GiftEffects, type GiftShow } from './GiftEffects'
import { Grass } from './Grass'
import { HonestySign } from './HonestySign'
import { Island } from './Island'
import { SceneLights } from './SceneLights'
import { buildIsland, islandDepth, islandRadius } from './islandGeometry'
import { OldTree } from './OldTree'
import { DriftingLeaves, PetalBurst, type Burst } from './Particles'
import { GrowingPlant, PlantField } from './Plant'
import { hashString } from './random'
import { useSceneMaterials } from './useSceneMaterials'
import { useSpots } from './useSpots'

export interface GardenSceneProps {
  garden: Garden
  plants: Plant[]
  /** foco em andamento: a câmera chega perto da planta da vez */
  focusMode?: boolean
  /** 3 dias sem sessão: folhas amarelando */
  neglected?: boolean
  /** selo de honestidade: 0 = sem selo, 1 a 3 = bronze, prata, ouro */
  sealLevel?: 0 | 1 | 2 | 3
  /** mostrado se o navegador não tiver WebGL */
  fallback?: ReactNode
  /** cena pequena no meio de uma página (índice): sem zoom pela roda, pra não prender a rolagem */
  compact?: boolean
  /** presentes de amigos tocando na cena (regador, corações) */
  gifts?: GiftShow | null
  /** jardim de um amigo (só olhando): sem as surpresas que são deste navegador */
  visiting?: boolean
}

const FOV = 38

/**
 * Enquadramento geral: câmera um pouco acima da ilha (dá pra ver a terra embaixo) e longe
 * o bastante pra ilha caber inteira na largura, inclusive em tela de celular em pé.
 */
function defaultCamera(radius: number, aspect: number) {
  const halfV = ((FOV / 2) * Math.PI) / 180
  const halfH = Math.atan(Math.tan(halfV) * aspect)
  const fitWidth = (radius * 1.12) / Math.tan(halfH) + radius * 0.35
  const distance = Math.max(radius * 2 + 3.4, fitWidth)
  const elevation = 0.36
  return {
    position: new Vector3(0, distance * Math.sin(elevation) + 0.2, distance * Math.cos(elevation)),
    target: new Vector3(0, -0.45, 0),
  }
}

export default function GardenScene({ garden, plants, focusMode = false, neglected = false, sealLevel = 0, fallback, compact = false, gifts = null, visiting = false }: GardenSceneProps) {
  // "reduzir movimento" no sistema: a ilha para de flutuar e girar, sem folhas no ar
  const reducedMotion = useReducedMotion() ?? false
  const radius = islandRadius(plants)
  const start = defaultCamera(radius, 1.6)
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      // sem nada se mexendo (reduzir movimento), só redesenha quando algo muda
      frameloop={reducedMotion && !focusMode ? 'demand' : 'always'}
      camera={{ fov: FOV, near: 0.1, far: 120, position: start.position.toArray() }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping // cores vivas, sem o tom "filme" do padrão
      }}
      fallback={fallback}
      aria-hidden="true"
    >
      <SceneContents
        garden={garden}
        plants={plants}
        radius={radius}
        focusMode={focusMode}
        neglected={neglected}
        sealLevel={sealLevel}
        motion={!reducedMotion}
        compact={compact}
        gifts={gifts}
        visiting={visiting}
      />
    </Canvas>
  )
}

interface ContentsProps {
  garden: Garden
  plants: Plant[]
  radius: number
  focusMode: boolean
  neglected: boolean
  sealLevel: 0 | 1 | 2 | 3
  motion: boolean
  compact: boolean
  gifts: GiftShow | null
  visiting: boolean
}

function SceneContents({ garden, plants, radius, focusMode, neglected, sealLevel, motion, compact, gifts, visiting }: ContentsProps) {
  const seed = hashString(garden.id)
  const biome = biomeOf(garden.biome)
  const growing = plants.find((p) => p.status === 'growing') ?? null
  const [bursts, removeBurst] = useAdultBursts(plants, garden.color)
  const depth = islandDepth(radius)
  const materials = useSceneMaterials(neglected ? 0.85 : 0, motion, depth)
  // a ilha (e a altura do chão) só é recalculada quando alguma planta nasce num lugar novo
  const spots = useSpots(plants)
  const island = useMemo(() => buildIsland(radius, biome, garden.color, seed, spots), [radius, biome, garden.color, seed, spots])
  useDevExpose()

  return (
    <>
      <SceneLights radius={radius} />

      <Float enabled={motion} speed={1} rotationIntensity={0.12} floatIntensity={0.35} floatingRange={[-0.06, 0.06]}>
        <Island shape={island} material={materials.island} />
        <Grass radius={radius} biome={biome} color={garden.color} seed={seed} spots={spots} heightAt={island.heightAt} materials={materials} />
        <PlantField plants={plants} color={garden.color} lodDistance={radius * 2 + 8} heightAt={island.heightAt} materials={materials} />
        {growing && (
          <GrowingPlant
            key={growing.id}
            plant={growing}
            color={garden.color}
            motion={motion}
            groundY={island.heightAt(growing.position_x, growing.position_z)}
          />
        )}
        {bursts.map((burst) => (
          <PetalBurst key={burst.id} burst={burst} onDone={removeBurst} />
        ))}
        {isForHer() && !visiting && <OldTree radius={radius} spots={spots} heightAt={island.heightAt} material={materials.plant} motion={motion} />}
        {sealLevel > 0 && (
          <HonestySign level={sealLevel as 1 | 2 | 3} radius={radius} spots={spots} heightAt={island.heightAt} material={materials.island} />
        )}
        {motion && <DriftingLeaves radius={radius} />}
        {gifts && <GiftEffects show={gifts} radius={radius} motion={motion} />}
      </Float>

      <ContactShadows
        position={[0, -3.3 * depth, 0]}
        opacity={0.28}
        scale={radius * 3.2}
        blur={2.6}
        far={3}
        frames={1}
        color="#5a4426"
      />
      <OrbitControls
        makeDefault
        enabled={!focusMode}
        enablePan={false}
        enableZoom={!compact}
        enableDamping
        minDistance={radius + 1.5}
        maxDistance={radius * 2.8 + 6}
        minPolarAngle={0.3}
        maxPolarAngle={1.3}
        autoRotate={motion && !focusMode}
        autoRotateSpeed={0.35}
      />
      <CameraRig radius={radius} focus={focusMode && growing ? [growing.position_x, growing.position_z] : null} />
    </>
  )
}

/** Leva a câmera suavemente até o enquadramento certo (geral, ou de perto no foco). */
function CameraRig({ radius, focus }: { radius: number; focus: [number, number] | null }) {
  const camera = useThree((s) => s.camera)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const controls = useThree((s) => s.controls) as unknown as
    | { target: Vector3; update: () => void; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }
    | null
  const [fx, fz] = focus ?? [NaN, NaN]
  const goal = useMemo(() => {
    if (Number.isNaN(fx)) return defaultCamera(radius, aspect)
    // foco imersivo: a cena ocupa a tela toda e a etiqueta do timer fica à direita (em tela larga),
    // então a câmera mira um pouco à direita da planta, que aparece à esquerda da etiqueta
    const plant = new Vector3(fx, 0.55, fz)
    // de cima: as plantas da frente não tapam a da vez; em tela em pé (celular), mais longe
    const offset = new Vector3(1.9, 4.1, 5.2).multiplyScalar(aspect < 1 ? 1 + (1 - aspect) * 1.3 : 1)
    const right = new Vector3().crossVectors(offset.clone().negate().normalize(), new Vector3(0, 1, 0)).normalize()
    const target = plant.clone().addScaledVector(right, aspect > 1.15 ? 1.5 : 0)
    // tela em pé: a ficha fica embaixo, então a planta sobe no enquadramento
    if (aspect < 1) target.y -= 1.1
    return { position: target.clone().add(offset), target }
  }, [fx, fz, radius, aspect])

  // primeira vez: já começa no lugar certo, sem a câmera "viajar" ao abrir a tela
  const placed = useRef(false)
  useLayoutEffect(() => {
    if (placed.current) return
    placed.current = true
    camera.position.copy(goal.position)
    if (controls) controls.target.copy(goal.target)
    camera.lookAt(goal.target)
  }, [camera, controls, goal])

  const moving = useRef(true)
  useEffect(() => {
    moving.current = true
  }, [goal])
  // se a pessoa girar a câmera no meio da transição, quem manda é ela
  useEffect(() => {
    if (!controls) return
    const stop = () => {
      moving.current = false
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, delta) => {
    if (!moving.current) return
    const k = 1 - Math.exp(-delta * 2.2)
    camera.position.lerp(goal.position, k)
    if (controls) {
      controls.target.lerp(goal.target, k)
      controls.update()
    } else {
      camera.lookAt(goal.target)
    }
    if (camera.position.distanceTo(goal.position) < 0.02) moving.current = false
  })
  return null
}

/** Planta que acabou de virar adulta (growing -> grown) solta uma chuva de pétalas. */
function useAdultBursts(plants: Plant[], color: string) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const previous = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = new Map(plants.map((p) => [p.id, p.status]))
    if (!before) return // primeira carga: nada acabou de acontecer
    const fresh = plants.filter((p) => p.status === 'grown' && before.get(p.id) === 'growing')
    if (fresh.length) setBursts((list) => [...list, ...fresh.map((p) => ({ id: p.id, x: p.position_x, z: p.position_z, color }))])
  }, [plants, color])

  const remove = useCallback((id: string) => setBursts((list) => list.filter((b) => b.id !== id)), [])
  return [bursts, remove] as const
}

/** Em desenvolvimento, deixa a cena acessível no console (e pros testes E2E). */
function useDevExpose() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__sprout3d = { scene, gl, camera }
    return () => {
      if (window.__sprout3d?.scene === scene) window.__sprout3d = undefined
    }
  }, [scene, gl, camera])
}
