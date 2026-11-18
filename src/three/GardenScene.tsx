// Cena 3D de um jardim: ilha flutuante, plantas, grama, pólen e câmera.
// É carregada sob demanda (React.lazy no GardenStage): o three.js é pesado e as telas
// que não mostram o jardim não precisam baixá-lo.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Float, OrbitControls } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import { NeutralToneMapping, Vector3 } from 'three'
import { biomeOf } from '../features/gardens/gardenOptions'
import type { Garden, GardenFlower, Plant } from '../lib/api'
import { HeartFountain } from './CheerEffects'
import { FriendFlowers } from './FriendFlowers'
import { Fawn } from './Fawn'
import { FAWN_ACTS, planFawn, type FawnAct, type FawnPlan, type FawnShow } from './fawnMotion'
import { GiftEffects, type GiftShow } from './GiftEffects'
import { Grass } from './Grass'
import { HonestySign } from './HonestySign'
import { Island } from './Island'
import { SceneLights } from './SceneLights'
import { buildIsland, islandDepth, islandRadius } from './islandGeometry'
import { OldTree } from './OldTree'
import { oldTreeSpot } from './oldTreeSpot'
import { FallingLeaves, Fireflies, PetalBurst, Rainfall, Snowfall, type Burst } from './Particles'
import { daylightAt, hourOf, overcast, seasonalLight } from './daylight'
import { SEASONS, seasonLook, seasonOf, type Season, type SeasonLook } from './season'
import { useNow } from '../lib/useNow'
import { GrowingPlant, PlantField } from './Plant'
import { FOV, frameCamera, frameDistance } from './framing'
import { clamp, hashString } from './random'
import { useSceneMaterials } from './useSceneMaterials'
import { useSpots } from './useSpots'

export interface GardenSceneProps {
  garden: Garden
  plants: Plant[]
  /** foco em andamento: a câmera chega perto da planta da vez */
  focusMode?: boolean
  /** 3 dias sem sessão: folhas amarelando */
  neglected?: boolean
  /** uma planta morreu hoje neste jardim: o dia fica chuvoso */
  raining?: boolean
  /** selo de honestidade: 0 = sem selo, 1 a 3 = bronze, prata, ouro */
  sealLevel?: 0 | 1 | 2 | 3
  /** mostrado se o navegador não tiver WebGL */
  fallback?: ReactNode
  /** cena pequena no meio de uma página (índice): sem zoom pela roda, pra não prender a rolagem */
  compact?: boolean
  /** presentes de amigos tocando na cena (regador, corações) */
  gifts?: GiftShow | null
  /** jardim de um amigo (só olhando): sem as surpresas que são deste navegador */
  /** a árvore velha da surpresa (quem decide é o GardenStage, pelo dono do jardim) */
  oldTree?: boolean
  /** flores que amigos plantaram nesta ilha */
  flowers?: GardenFlower[]
  /** corações mandados agora, nesta visita (sobem ao vivo); undefined = sem a fonte */
  liveHearts?: number
}

/** Até onde dá pra chegar perto enquanto o cervinho da surpresa está em cena (e logo depois). */
const CLOSE_UP_DISTANCE = 2.2

/**
 * Enquadramento geral: câmera um pouco acima da ilha (dá pra ver a terra embaixo) e longe o
 * bastante pra ilha inteira caber na largura e na altura da moldura, fora do esfumado
 * (a conta fica no framing.ts).
 */
function defaultCamera(radius: number, aspect: number) {
  const { position, target } = frameCamera(radius, aspect)
  return { position: new Vector3(position.x, position.y, position.z), target: new Vector3(target.x, target.y, target.z) }
}

export default function GardenScene({ garden, plants, focusMode = false, neglected = false, raining = false, sealLevel = 0, fallback, compact = false, gifts = null, oldTree = false, flowers, liveHearts }: GardenSceneProps) {
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
        raining={raining}
        sealLevel={sealLevel}
        motion={!reducedMotion}
        compact={compact}
        gifts={gifts}
        oldTree={oldTree}
        flowers={flowers}
        liveHearts={liveHearts}
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
  raining: boolean
  sealLevel: 0 | 1 | 2 | 3
  motion: boolean
  compact: boolean
  gifts: GiftShow | null
  oldTree: boolean
  flowers?: GardenFlower[]
  liveHearts?: number
}

function SceneContents({ garden, plants, radius, focusMode, neglected, raining, sealLevel, motion, compact, gifts, oldTree, flowers, liveHearts }: ContentsProps) {
  const seed = hashString(garden.id)
  const biome = biomeOf(garden.biome)
  // no bioma neve é sempre inverno: a ilha já é de neve o ano inteiro
  const season = useMemo<SeasonLook>(() => seasonLook(biome === 'neve' ? 'inverno' : (forcedSeason() ?? seasonOf())), [biome])
  const leaves = useMemo(() => leafColors(garden.color, season), [garden.color, season])
  const growing = plants.find((p) => p.status === 'growing') ?? null
  // a moldura muda de proporção (janela redimensionada): o limite de afastamento acompanha
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const fitDistance = useMemo(() => frameDistance(radius, aspect), [radius, aspect])
  const [bursts, removeBurst] = useAdultBursts(plants, garden.color)
  const depth = islandDepth(radius)
  // a luz segue o relógio de quem está olhando; conferir de 5 em 5 min basta, a mudança é lenta
  const clockHour = useNow(5 * 60_000, true, () => hourOf())
  const hour = forcedHour() ?? clockHour
  // a hora manda na luz, a estação dá o tom e o dia de perda fecha o céu com chuva
  // (tudo só aparência: nada aqui muda regra, crescimento nem histórico)
  const light = useMemo(() => {
    const day = seasonalLight(daylightAt(hour, biome), season.warmth)
    return raining ? overcast(day) : day
  }, [hour, biome, raining, season])
  const materials = useSceneMaterials({ yellow: neglected ? 0.85 : 0, motion, depth, night: light.night, season })
  // a ilha (e a altura do chão) só é recalculada quando alguma planta nasce num lugar novo
  const spots = useSpots(plants)
  const island = useMemo(() => buildIsland(radius, biome, garden.color, seed, spots), [radius, biome, garden.color, seed, spots])
  useDevExpose()

  // Surpresa: a árvore velha e, a cada vez que o jardim abre, o cervinho que corre pra trás dela.
  // Ele não aparece no cerrado, nem durante o foco, nem com "reduzir movimento".
  const treePlace = useMemo(() => oldTreeSpot(radius, spots), [radius, spots])
  const [fawnSeen, setFawnSeen] = useState<string | null>(null)
  // a câmera chega perto pra ver o cervinho; depois que ele some, ela ainda precisa poder se afastar devagar
  const [closeUp, setCloseUp] = useState(false)
  const fawnWaiting = oldTree && motion && biome !== 'cerrado' && fawnSeen !== garden.id
  const endFawn = useCallback(() => {
    setFawnSeen(garden.id)
    setCloseUp(true)
  }, [garden.id])
  // começou um foco: a vez do cervinho passou (ele é só da abertura do jardim)
  if (fawnWaiting && focusMode) endFawn()
  const fawnOn = fawnWaiting && !focusMode
  const fawnPlan = useMemo(() => {
    if (!fawnOn) return null
    // o palco é montado pra câmera do enquadramento geral (ela fica no +z)
    const camera = defaultCamera(radius, 1).position
    const away = Math.hypot(camera.x - treePlace.x, camera.z - treePlace.z)
    const toCamera = { x: (camera.x - treePlace.x) / away, z: (camera.z - treePlace.z) / away }
    const obstacles = [...spots.map((p) => ({ x: p.position_x, z: p.position_z })), { x: 0, z: radius * 0.78 }]
    return planFawn(treePlace, toCamera, radius, obstacles, forcedShow())
  }, [fawnOn, radius, treePlace, spots])
  const farEnough = useCallback(() => setCloseUp(false), [])

  return (
    <>
      <SceneLights radius={radius} biome={biome} light={light} />

      <Float enabled={motion} speed={1} rotationIntensity={0.12} floatIntensity={0.35} floatingRange={[-0.06, 0.06]}>
        <Island shape={island} material={materials.island} />
        <Grass radius={radius} biome={biome} color={garden.color} seed={seed} spots={spots} heightAt={island.heightAt} materials={materials} />
        <PlantField plants={plants} color={garden.color} biome={biome} lodDistance={radius * 2 + 8} heightAt={island.heightAt} materials={materials} />
        {growing && (
          <GrowingPlant
            key={growing.id}
            plant={growing}
            color={garden.color}
            biome={biome}
            motion={motion}
            groundY={island.heightAt(growing.position_x, growing.position_z)}
          />
        )}
        {bursts.map((burst) => (
          <PetalBurst key={burst.id} burst={burst} onDone={removeBurst} />
        ))}
        {oldTree && <OldTree place={treePlace} heightAt={island.heightAt} material={materials.plant} motion={motion} snowy={biome === 'neve'} />}
        {fawnPlan && <Fawn key={garden.id} plan={fawnPlan} tree={treePlace} heightAt={island.heightAt} onDone={endFawn} />}
        {sealLevel > 0 && (
          <HonestySign level={sealLevel as 1 | 2 | 3} radius={radius} spots={spots} heightAt={island.heightAt} material={materials.island} />
        )}
        {/* no bioma neve já está nevando; a perda do dia aparece só no céu fechado */}
        {motion &&
          (biome === 'neve' ? (
            <Snowfall radius={radius} heightAt={island.heightAt} />
          ) : raining ? (
            <Rainfall radius={radius} heightAt={island.heightAt} />
          ) : (
            <FallingLeaves radius={radius} heightAt={island.heightAt} colors={leaves} count={season.leafCount} />
          ))}
        {/* vaga-lumes anoitecendo: não aparecem no frio da neve nem debaixo de chuva */}
        {motion && biome !== 'neve' && !raining && light.night > 0.05 && (
          <Fireflies radius={radius} heightAt={island.heightAt} night={light.night} />
        )}
        {gifts && <GiftEffects show={gifts} radius={radius} motion={motion} />}
        {flowers && flowers.length > 0 && <FriendFlowers flowers={flowers} heightAt={island.heightAt} material={materials.plant} />}
        {liveHearts !== undefined && <HeartFountain total={liveHearts} radius={radius} />}
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
        minDistance={fawnPlan || closeUp ? CLOSE_UP_DISTANCE : radius + 1.5}
        // dá pra afastar um pouco além do enquadramento geral (antes era um número fixo, e numa
        // moldura baixa ele puxava a câmera pra perto, cortando a ilha)
        maxDistance={Math.max(radius * 2.8 + 6, fitDistance * 1.25)}
        minPolarAngle={0.3}
        maxPolarAngle={1.3}
        autoRotate={motion && !focusMode && !fawnPlan}
        autoRotateSpeed={0.35}
      />
      <CameraRig
        radius={radius}
        focus={focusMode && growing ? [growing.position_x, growing.position_z] : null}
        intro={fawnPlan}
        tree={treePlace}
        onFar={closeUp ? farEnough : undefined}
      />
    </>
  )
}

/** Tons das folhas que caem: os da estação e, de vez em quando, uma da cor do jardim. */
function leafColors(gardenColor: string, season: SeasonLook) {
  const list = [...season.leafColors]
  list.splice(Math.floor(list.length / 2), 0, gardenColor)
  list.push(gardenColor)
  return list
}

/**
 * Só em desenvolvimento: `?estacao=outono` força a estação, pra ver as quatro sem esperar o
 * ano passar. Em produção é sempre a data de verdade.
 */
function forcedSeason(): Season | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get('estacao')
  return SEASONS.find((s) => s === value) ?? null
}

interface CameraRigProps {
  radius: number
  focus: [number, number] | null
  /** o cervinho da surpresa em cena: a câmera abre de perto, no palco dele ao lado da árvore */
  intro: FawnPlan | null
  tree: { x: number; z: number }
  /** avisa quando a câmera já se afastou o bastante pro limite normal de zoom voltar */
  onFar?: () => void
}

/** Leva a câmera suavemente até o enquadramento certo (geral, de perto no foco, ou no cervinho). */
function CameraRig({ radius, focus, intro, tree, onFar }: CameraRigProps) {
  const camera = useThree((s) => s.camera)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const controls = useThree((s) => s.controls) as unknown as
    | { target: Vector3; update: () => void; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }
    | null
  const [fx, fz] = focus ?? [NaN, NaN]
  const goal = useMemo(() => {
    if (Number.isNaN(fx) && intro) {
      // perto o bastante pro cervinho aparecer bem, longe o bastante pra caber ele e o tronco
      const halfV = ((FOV / 2) * Math.PI) / 180
      const halfH = Math.atan(Math.tan(halfV) * aspect)
      const wide = defaultCamera(radius, aspect)
      const distance = clamp(Math.max(0.95 / Math.tan(halfV), 1.4 / Math.tan(halfH)), 2.8, wide.position.distanceTo(wide.target))
      const target = new Vector3((tree.x + intro.stop.x) / 2, 0.45, (tree.z + intro.stop.z) / 2)
      const elevation = 0.32
      const back = new Vector3(intro.toCamera.x * Math.cos(elevation), Math.sin(elevation), intro.toCamera.z * Math.cos(elevation))
      return { position: target.clone().addScaledVector(back, distance), target }
    }
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
  }, [fx, fz, radius, aspect, intro, tree])

  // primeira vez: já começa no lugar certo, sem a câmera "viajar" ao abrir a tela.
  // Os controles chegam um instante depois da câmera; o alvo deles também começa no lugar.
  const placed = useRef<'no' | 'camera' | 'all'>('no')
  useLayoutEffect(() => {
    if (placed.current === 'all') return
    placed.current = controls ? 'all' : 'camera'
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
    if (onFar && controls && camera.position.distanceTo(controls.target) >= radius + 1.6) onFar()
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

/**
 * Só em desenvolvimento: `?hora=20` força a hora da luz, pra ver amanhecer, pôr do sol e
 * noite sem esperar o dia passar. Em produção é sempre o relógio de verdade.
 */
function forcedHour(): number | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const value = Number(new URLSearchParams(location.search).get('hora'))
  return Number.isFinite(value) && location.search.includes('hora=') ? value : null
}

/**
 * Só em desenvolvimento: `?cervo=pastando` força o número do cervinho (chegada, pastando,
 * sacudida ou pulinho), pra ver os quatro sem ficar abrindo o jardim até sair o que falta.
 * Em produção é sempre sorteado, sem repetir o da vez anterior.
 */
function forcedShow(): FawnShow | undefined {
  if (!import.meta.env.DEV || typeof location === 'undefined') return undefined
  const value = new URLSearchParams(location.search).get('cervo')
  return FAWN_ACTS.includes(value as FawnAct) ? { act: value as FawnAct, seed: 7 } : undefined
}
