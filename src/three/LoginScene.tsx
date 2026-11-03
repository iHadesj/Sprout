// Cena da tela de login: uma ilha pequena com uma muda no meio, tela cheia atrás do form.
// A muda só conhece o `stage` (o form decide qual é) e reage a ele: brota folhas, estica,
// murcha e floresce. Tudo aqui anda por molas (spring.ts), nunca troca seco.
// É carregada sob demanda (React.lazy no AuthLayout), como o GardenScene.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import { DoubleSide, Group, NeutralToneMapping, Vector3, type PerspectiveCamera } from 'three'
import { SKY, skyHeight, TIMING } from '../features/auth/motion/loginVariants'
import type { SproutStage } from '../features/auth/sproutStage'
import { createFacetMaterial } from './facetMaterial'
import { Grass } from './Grass'
import { Island } from './Island'
import { buildIsland, islandDepth, type Spot } from './islandGeometry'
import { clamp, lerp } from './random'
import { SceneLights } from './SceneLights'
import { flowerCoreGeometry, petalGeometry, sproutLeafGeometry, stemGeometry, stemPoint, STEM_HEIGHT } from './sproutGeometry'
import { Spring, type SpringConfig } from './spring'
import { useSceneMaterials } from './useSceneMaterials'

export interface LoginSceneProps {
  stage: SproutStage
  /** primeiro quadro pronto: o canvas pode aparecer */
  onReady?: () => void
  /** mostrado se o navegador não tiver WebGL */
  fallback?: ReactNode
}

interface Pose {
  /** cada folha: 0 = fechada (escondida), 1 = aberta */
  leaves: [number, number]
  /** esticar pra cima (enviando) */
  lift: number
  /** murchar: folhas caem e a cor desbota */
  wilt: number
  /** florescer */
  bloom: number
}

/** O que cada estágio pede da muda. Pra mudar o "humor" de um estado, é aqui. */
const POSES: Record<SproutStage, Pose> = {
  idle: { leaves: [0, 0], lift: 0, wilt: 0, bloom: 0 },
  oneLeaf: { leaves: [1, 0], lift: 0, wilt: 0, bloom: 0 },
  twoLeaves: { leaves: [1, 1], lift: 0, wilt: 0, bloom: 0 },
  loading: { leaves: [1, 1], lift: 1, wilt: 0, bloom: 0 },
  error: { leaves: [1, 1], lift: 0, wilt: 1, bloom: 0 },
  success: { leaves: [1, 1], lift: 0.4, wilt: 0, bloom: 1 },
}

/** Molas: amortecimento baixo em relação à rigidez = passa do alvo e volta (overshoot). */
const SPRINGS = {
  leaf: { stiffness: 170, damping: 12 },
  lift: { stiffness: 40, damping: 11 },
  wilt: { stiffness: 60, damping: 12 },
  head: { stiffness: 130, damping: 13 },
  petal: { stiffness: 120, damping: 11 },
  island: { stiffness: 90, damping: 10 },
  grow: { stiffness: 60, damping: 9 },
} satisfies Record<string, SpringConfig>
/** "Reduzir movimento": tudo chega rápido e sem passar do alvo. */
const CALM: SpringConfig = { stiffness: 400, damping: 40 }

const RADIUS = 1.35
const SPROUT_SCALE = 0.85
const SEED = 20261102
const FLOWER_COLOR = '#f08fb0'
/** --paper do tokens.css: a terra embaixo da ilha se dissolve nesta cor */
const PAPER: [number, number, number] = [0xf3 / 255, 0xee / 255, 0xe2 / 255]
const SPOTS: Spot[] = [{ position_x: 0, position_z: 0 }]

const FOV = 36
const ELEVATION = 0.42
/** Faixa (no mundo) que precisa caber no céu acima do card. A terra mais embaixo pode passar por trás do card. */
const SUBJECT = { bottom: -0.95, top: 1.15 }
const ISLAND_WIDTH = RADIUS * 2.3

/** Folhas: altura no caule (0 a 1), giro em volta do caule (as duas viradas pra câmera) e tamanho. */
const LEAVES = [
  { at: 0.42, yaw: -0.45, length: 0.5 },
  { at: 0.7, yaw: Math.PI + 0.5, length: 0.42 },
]
const PETALS = 6
/** Ângulo da pétala: fechada (ponta pra cima, botão) e aberta. */
const PETAL_CLOSED = 1.3
const PETAL_OPEN = 0.42

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Câmera pra caber a ilha no céu (entre o wordmark e o card) e na largura (celular em pé).
 * `shift` = quantos pixels o centro da imagem sobe, pra ilha ficar acima do card.
 */
function framing(width: number, height: number) {
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180)
  const available = Math.max(110, skyHeight(height) - SKY.top - 4)
  const byHeight = (SUBJECT.top - SUBJECT.bottom) / ((available / height) * 2 * tanV)
  const usableWidth = Math.min(width - 32, 760)
  const byWidth = ISLAND_WIDTH / ((usableWidth / width) * 2 * tanV * (width / height))
  const distance = Math.max(byHeight, byWidth)
  return {
    distance,
    shift: height / 2 - (SKY.top + available / 2),
    worldPerPx: (2 * distance * tanV) / height,
  }
}

export default function LoginScene({ stage, onReady, fallback }: LoginSceneProps) {
  const reduced = useReducedMotion() ?? false
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 4, 14] }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        onReady?.()
      }}
      fallback={fallback}
      aria-hidden="true"
    >
      <SceneContents stage={stage} motion={!reduced} />
    </Canvas>
  )
}

function SceneContents({ stage, motion }: { stage: SproutStage; motion: boolean }) {
  const depth = islandDepth(RADIUS)
  const materials = useSceneMaterials(0, motion, depth)
  useEffect(() => {
    // a terra embaixo some no papel bem antes do card (atrás dele, viraria uma mancha borrada)
    const u = materials.island.userData.uniforms
    u.uPaper.value.set(...PAPER)
    u.uFadeLo.value = -1.25
    u.uFadeHi.value = -0.3
  }, [materials])

  const island = useMemo(() => buildIsland(RADIUS, 'campo', FLOWER_COLOR, SEED, SPOTS), [])
  const groundY = island.heightAt(0, 0)
  const parts = useMemo(
    () => ({
      stem: stemGeometry(),
      leaves: LEAVES.map((leaf) => sproutLeafGeometry(leaf.length)),
      petal: petalGeometry(),
      core: flowerCoreGeometry(),
    }),
    [],
  )
  useEffect(() => () => [parts.stem, parts.petal, parts.core, ...parts.leaves].forEach((g) => g.dispose()), [parts])
  const sproutMaterial = useMemo(() => createFacetMaterial({ side: DoubleSide, edge: 0.55, rim: 0.32, roughness: 0.6 }), [])
  useEffect(() => () => sproutMaterial.dispose(), [sproutMaterial])

  const islandRef = useRef<Group>(null)
  const sproutRef = useRef<Group>(null)
  const flowerRef = useRef<Group>(null)
  const leafRefs = useRef<(Group | null)[]>([])
  const petalRefs = useRef<(Group | null)[]>([])

  // estado da animação: muda a cada quadro, então fica fora do React (sem re-render)
  const anim = useMemo(
    () => ({
      started: false,
      time: 0,
      successAt: null as number | null,
      rise: new Spring(0, SPRINGS.island),
      grow: new Spring(0, SPRINGS.grow),
      leaves: LEAVES.map(() => new Spring(0, SPRINGS.leaf)),
      lift: new Spring(0, SPRINGS.lift),
      wilt: new Spring(0, SPRINGS.wilt),
      head: new Spring(0, SPRINGS.head),
      petals: Array.from({ length: PETALS }, () => new Spring(0, SPRINGS.petal)),
      /** crescimento lento enquanto envia */
      stretch: 0,
      target: new Vector3(),
      flower: new Vector3(),
    }),
    [],
  )

  useFrame((state, delta) => {
    const island = islandRef.current
    const sprout = sproutRef.current
    const flower = flowerRef.current
    if (!island || !sprout || !flower) return
    const a = anim
    const dt = Math.min(delta, 0.1)
    const pick = (config: SpringConfig) => (motion ? config : CALM)
    const { width, height } = state.size
    const frame = framing(width, height)

    if (!a.started) {
      a.started = true
      // a ilha começa um pouco abaixo (em pixels de tela) e sobe com a mola
      a.rise.value = motion ? -TIMING.scene.islandRisePx * frame.worldPerPx : 0
      if (!motion) a.grow.value = 1
    }
    a.time += dt
    const t = a.time
    const pose = POSES[stage]
    if (stage === 'success') a.successAt ??= t
    else a.successAt = null
    const since = a.successAt === null ? -1 : t - a.successAt

    // ---- montagem: a ilha sobe e a muda cresce do chão (escala Y de 0 a 1)
    a.rise.config = pick(SPRINGS.island)
    a.grow.config = pick(SPRINGS.grow)
    island.position.y = a.rise.step(t >= TIMING.scene.island || !motion ? 0 : a.rise.value, dt)
    const grow = a.grow.step(t >= TIMING.scene.sprout || !motion ? 1 : 0, dt)

    // ---- a muda inteira: vento, esticar (enviando), murchar
    a.lift.config = pick(SPRINGS.lift)
    a.wilt.config = pick(SPRINGS.wilt)
    const lift = a.lift.step(pose.lift, dt)
    const wilt = a.wilt.step(pose.wilt, dt)
    a.stretch = stage === 'loading' ? Math.min(0.12, a.stretch + dt * 0.05) : a.stretch * (1 - Math.min(1, dt * 3))
    const calmness = 1 - 0.6 * clamp(lift, 0, 1)
    const swayZ = motion ? (Math.sin(t * 1.15) * 0.05 + Math.sin(t * 2.6 + 1) * 0.018) * calmness : 0
    const swayX = motion ? Math.sin(t * 0.9 + 2) * 0.03 * calmness : 0
    sprout.rotation.set(swayX, 0, swayZ + 0.12 * wilt)
    const stretchY = 1 + 0.06 * lift + a.stretch
    sprout.scale.set(SPROUT_SCALE, SPROUT_SCALE * Math.max(1e-3, grow) * stretchY, SPROUT_SCALE)

    // ---- folhas: brotam com overshoot, sobem um pouco ao enviar, caem ao murchar
    a.leaves.forEach((spring, i) => {
      const leaf = leafRefs.current[i]
      if (!leaf) return
      spring.config = pick(SPRINGS.leaf)
      leaf.scale.setScalar(Math.max(1e-3, spring.step(pose.leaves[i], dt)))
      const flutter = motion ? Math.sin(t * 2.2 + i * 1.7) * 0.06 : 0
      leaf.rotation.z = flutter + 0.3 * lift - 0.95 * wilt
    })
    const u = sproutMaterial.userData.uniforms
    u.uSaturation.value = 1 - 0.6 * clamp(wilt, 0, 1)
    u.uDry.value = 0.3 * clamp(wilt, 0, 1)

    // ---- flor: o botão cresce e as pétalas abrem uma depois da outra
    a.head.config = pick(SPRINGS.head)
    const head = a.head.step(pose.bloom, dt)
    flower.scale.setScalar(Math.max(1e-3, head))
    a.petals.forEach((spring, k) => {
      const petal = petalRefs.current[k]
      if (!petal) return
      spring.config = pick(SPRINGS.petal)
      const open = since >= 0.15 + k * TIMING.success.petalStagger ? 1 : 0
      petal.rotation.z = lerp(PETAL_CLOSED, PETAL_OPEN, spring.step(open, dt))
    })
    u.uGlow.value = since >= 0 ? 0.45 * Math.max(0, 1 - since / 1.4) : 0

    // ---- câmera: chega de longe e de cima; no sucesso, dolly-in até a flor
    const camera = state.camera as PerspectiveCamera
    const intro = motion ? easeOut(clamp(t / TIMING.scene.camera, 0, 1)) : 1
    let distance = frame.distance * (1 + 0.45 * (1 - intro))
    let elevation = ELEVATION + 0.28 * (1 - intro)
    let shift = frame.shift
    const target = a.target.set(0, (SUBJECT.top + SUBJECT.bottom) / 2, 0)
    if (motion && since >= 0) {
      const d = easeInOut(clamp((since - TIMING.success.dollyDelay) / TIMING.success.dolly, 0, 1))
      a.flower.set(0, island.position.y + groundY + SPROUT_SCALE * (STEM_HEIGHT + 0.08), 0)
      // termina mais alto, olhando a flor aberta de cima
      distance = lerp(distance, 2.3, d)
      elevation = lerp(elevation, 0.8, d)
      target.lerp(a.flower, d)
      shift = lerp(shift, 0, d)
    }
    camera.position.set(target.x, target.y + Math.sin(elevation) * distance, target.z + Math.cos(elevation) * distance)
    camera.lookAt(target)
    camera.setViewOffset(width, height, 0, shift, width, height)
  })

  const tip = stemPoint(1)
  return (
    <>
      <SceneLights radius={RADIUS} />
      <group ref={islandRef}>
        <Float enabled={motion} speed={1.1} rotationIntensity={0.08} floatIntensity={0.3} floatingRange={[-0.04, 0.04]}>
          <Island shape={island} material={materials.island} />
          <Grass radius={RADIUS} biome="campo" color={FLOWER_COLOR} seed={SEED} spots={SPOTS} heightAt={island.heightAt} materials={materials} />
          <group ref={sproutRef} position={[0, groundY, 0]} scale={[SPROUT_SCALE, 1e-3, SPROUT_SCALE]} name="login-sprout">
            <mesh geometry={parts.stem} material={sproutMaterial} />
            {LEAVES.map((leaf, i) => (
              <group key={i} position={stemPoint(leaf.at)} rotation={[0, leaf.yaw, 0]}>
                <group
                  ref={(node) => {
                    leafRefs.current[i] = node
                  }}
                  scale={1e-3}
                >
                  <mesh geometry={parts.leaves[i]} material={sproutMaterial} />
                </group>
              </group>
            ))}
            <group ref={flowerRef} position={[tip.x, tip.y + 0.03, tip.z]} scale={1e-3}>
              <mesh geometry={parts.core} material={sproutMaterial} />
              {Array.from({ length: PETALS }, (_, k) => (
                <group key={k} rotation={[0, (k / PETALS) * Math.PI * 2, 0]}>
                  <group
                    ref={(node) => {
                      petalRefs.current[k] = node
                    }}
                    rotation={[0, 0, PETAL_CLOSED]}
                  >
                    <mesh geometry={parts.petal} material={sproutMaterial} />
                  </group>
                </group>
              ))}
            </group>
          </group>
        </Float>
      </group>
    </>
  )
}
