// Luz da cena, como numa ilustração: sol de um lado, sombra puxada pro azul (o céu ilumina o
// que o sol não pega) e uma contraluz fria por trás, que acende as bordas das copas e separa as
// árvores do fundo de papel. Pouca luz "geral": é o contraste entre as faces que faz o low poly
// aparecer.
//
// O sol fica alto (perto do meio-dia): as sombras ficam curtas, debaixo de cada árvore, em vez
// de compridas cruzando a ilha. A borda da sombra é macia (PCF com raio).
// Na neve a luz é mais branca e a sombra mais azul (senão o branco vira bege).
import type { Biome } from '../features/gardens/gardenOptions'

const LIGHT: Record<'warm' | 'snow', { sky: string; ground: string; sun: string; sunIntensity: number; rim: string }> = {
  warm: { sky: '#fff1d6', ground: '#6f7f99', sun: '#ffe6bd', sunIntensity: 2.9, rim: '#cfe0ff' },
  snow: { sky: '#f4f8ff', ground: '#7d90b0', sun: '#fff6ea', sunIntensity: 2.6, rim: '#d8e6ff' },
}

/** `radius` = tamanho da ilha, pra caixa da sombra cobrir tudo. */
export function SceneLights({ radius = 6, biome = 'campo' }: { radius?: number; biome?: Biome }) {
  const light = LIGHT[biome === 'neve' ? 'snow' : 'warm']
  const shadow = radius + 1.6
  return (
    <>
      <hemisphereLight args={[light.sky, light.ground, 0.85]} />
      <directionalLight
        position={[radius * 0.55 + 2, radius * 1.6 + 10, radius * 0.4 + 2.5]}
        color={light.sun}
        intensity={light.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-blurSamples={12}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-shadow}
        shadow-camera-right={shadow}
        shadow-camera-top={shadow}
        shadow-camera-bottom={-shadow}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 5 + 30}
      />
      <directionalLight position={[-radius - 2, radius * 0.5 + 2, -radius - 4]} color={light.rim} intensity={1.1} />
    </>
  )
}
