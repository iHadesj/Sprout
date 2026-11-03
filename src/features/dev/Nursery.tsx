// Viveiro (só em desenvolvimento, /dev/viveiro): todas as espécies em todos os estágios,
// lado a lado, pra ver e ajustar as plantas sem precisar fazer 5 sessões de foco.
import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { NeutralToneMapping } from 'three'
import { GARDEN_COLORS } from '../gardens/gardenOptions'
import type { Species } from '../gardens/plants'
import { createDeadPlantMaterial, createPlantMaterial } from '../../three/facetMaterial'
import { SceneLights } from '../../three/SceneLights'
import { treeGeometry } from '../../three/treeGeometry'

const SPECIES: Species[] = ['pinheiro', 'macieira', 'cerejeira']
const GROWTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const DEAD = [2, 5, 8]
/** /dev/viveiro?perto: câmera de perto nas árvores jovens e adultas */
const CLOSE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perto')

export default function Nursery() {
  const [color, setColor] = useState<string>(GARDEN_COLORS[0].value)
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100dvh - 64px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '8px 16px' }}>
        <strong style={{ fontWeight: 500 }}>Viveiro</strong>
        <span style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          colunas: growth 0 → 10 · linhas: pinheiro, macieira, cerejeira · à direita: secas (2, 5, 8)
        </span>
        {GARDEN_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            onClick={() => setColor(c.value)}
            style={{ width: 24, height: 24, borderRadius: '50%', border: color === c.value ? '2px solid #22382e' : '1px solid #ccc', background: c.value, cursor: 'pointer' }}
          />
        ))}
      </div>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 30, position: CLOSE ? [2.6, 2.6, 6.2] : [0.8, 5.5, 13] }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping
        }}
      >
        <NurseryScene color={color} />
      </Canvas>
    </div>
  )
}

function NurseryScene({ color }: { color: string }) {
  const alive = useMemo(() => createPlantMaterial(), [])
  const dead = useMemo(() => createDeadPlantMaterial(), [])
  // relógio do vento: uniformes do three.js são feitos pra mudar a cada quadro (a regra do lint não sabe disso)
  useFrame(({ clock }) => {
    const u = alive.userData.uniforms
    // oxlint-disable-next-line react/immutability
    u.uTime.value = clock.elapsedTime
  })
  useEffect(
    () => () => {
      alive.dispose()
      dead.dispose()
    },
    [alive, dead],
  )
  const spacing = 1
  return (
    <>
      <SceneLights />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 7]} />
        <meshStandardMaterial color="#efe6d2" />
      </mesh>
      {SPECIES.map((species, row) => (
        <group key={species} position={[0, 0, (row - 1) * 1.7]}>
          {GROWTHS.map((growth, col) => (
            <mesh
              key={growth}
              position={[(col - 6) * spacing, 0, 0]}
              geometry={treeGeometry(species, growth, color, 'high')}
              material={alive}
              castShadow
              receiveShadow
            />
          ))}
          {DEAD.map((growth, i) => (
            <mesh
              key={`dead-${growth}`}
              position={[5.6 + i * 1, 0, 0]}
              rotation={[0.25, 0.4, 0.15]}
              geometry={treeGeometry(species, growth, color, 'high')}
              material={dead}
              castShadow
            />
          ))}
        </group>
      ))}
      <OrbitControls target={CLOSE ? [2.6, 0.45, 0] : [0.8, 0.3, 0]} makeDefault />
    </>
  )
}
