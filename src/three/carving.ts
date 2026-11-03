// Entalhe "coração + E + F" desenhado num canvas, pra virar a textura de um pedaço de casca
// colado no tronco da árvore velha. Imita um corte a canivete:
// - letras em traços retos (canivete não faz curva bonita), com pontas levemente tortas;
// - dentro do corte aparece a madeira clara; o fundo do sulco é mais escuro;
// - a borda de baixo/direita fica na sombra e a de cima/esquerda pega um brilho fino.
// O resto do canvas é transparente: só o entalhe aparece por cima da casca.
import { CanvasTexture, SRGBColorSpace } from 'three'
import { rng } from './random'

const SIZE = 512

type Point = [number, number]

/** Coração: duas curvas de cada lado, da fenda de cima até a ponta. */
function heartPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(256, 150)
  ctx.bezierCurveTo(214, 76, 82, 92, 92, 212)
  ctx.bezierCurveTo(100, 300, 204, 362, 256, 438)
  ctx.bezierCurveTo(308, 362, 412, 300, 420, 212)
  ctx.bezierCurveTo(430, 92, 298, 76, 256, 150)
  ctx.closePath()
}

/** Letras E + F como traços retos de canivete. */
const LETTERS: [Point, Point][] = [
  // E
  [[170, 196], [170, 312]],
  [[170, 196], [218, 194]],
  [[170, 252], [210, 251]],
  [[170, 312], [220, 314]],
  // +
  [[236, 256], [276, 255]],
  [[256, 236], [257, 276]],
  // F
  [[298, 196], [299, 314]],
  [[298, 196], [346, 193]],
  [[298, 252], [338, 250]],
]

export function carvingTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const random = rng(2026)
  const wobble = (): number => (random() - 0.5) * 4

  // as letras com um tremidinho fixo (mão humana), iguais em todas as camadas
  const strokes = LETTERS.map(([a, b]): [Point, Point] => [
    [a[0] + wobble(), a[1] + wobble()],
    [b[0] + wobble(), b[1] + wobble()],
  ])
  const drawAll = (dx: number, dy: number) => {
    ctx.save()
    ctx.translate(dx, dy)
    heartPath(ctx)
    ctx.stroke()
    for (const [a, b] of strokes) {
      ctx.beginPath()
      ctx.moveTo(...a)
      ctx.lineTo(...b)
      ctx.stroke()
    }
    ctx.restore()
  }

  const layers: { color: string; width: number; dx: number; dy: number }[] = [
    { color: 'rgba(24, 13, 6, 0.85)', width: 22, dx: 3, dy: 4 }, // sombra da borda de baixo
    { color: '#b98b5d', width: 17, dx: 0, dy: 0 }, // madeira clara dentro do corte
    { color: '#8a5f3b', width: 9, dx: 1, dy: 1.5 }, // fundo do sulco, mais escuro
    { color: 'rgba(255, 236, 205, 0.55)', width: 3, dx: -6, dy: -6 }, // brilho fino na borda de cima
  ]
  for (const layer of layers) {
    ctx.strokeStyle = layer.color
    ctx.lineWidth = layer.width
    drawAll(layer.dx, layer.dy)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
