// Luz da cena, como numa ilustração: sol quente de um lado, sombra puxada pro azul
// (o céu ilumina o que o sol não pega) e uma contraluz fria por trás, que acende as
// bordas das copas e separa as árvores do fundo de papel.
// Pouca luz "geral": é o contraste entre as faces que faz o low poly aparecer.

/** `radius` = tamanho da ilha, pra caixa da sombra cobrir tudo. */
export function SceneLights({ radius = 6 }: { radius?: number }) {
  const shadow = radius + 1.6
  return (
    <>
      <hemisphereLight args={['#fff1d6', '#6f7f99', 0.85]} />
      <directionalLight
        position={[radius + 3, radius + 7, radius * 0.6 + 3]}
        color="#ffe6bd"
        intensity={2.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadow}
        shadow-camera-right={shadow}
        shadow-camera-top={shadow}
        shadow-camera-bottom={-shadow}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 4 + 20}
      />
      <directionalLight position={[-radius - 2, radius * 0.5 + 2, -radius - 4]} color="#cfe0ff" intensity={1.1} />
    </>
  )
}
