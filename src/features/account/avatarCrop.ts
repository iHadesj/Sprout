// A conta do corte da foto de perfil (a telinha fica no AvatarCropper.tsx). Funções puras:
// sem DOM, testadas no avatarCrop.test.ts.
//
// Na telinha, a foto aparece atrás de uma janela quadrada de lado `view` (em px da tela).
// - zoom 1 = a foto cobre a janela exatamente pelo lado menor (nunca sobra buraco);
// - offset = quanto o centro da foto está deslocado do centro da janela, em px da tela.
// No fim, `sourceRect` diz qual pedaço da foto original está dentro da janela: é ele que vira
// o avatar de 256 px.

export const OUTPUT_SIZE = 256
/** A janela em forma de pedrinha ocupa 88% do quadro (o resto é a margem coberta de papel). */
export const WINDOW = 0.88
export const MAX_ZOOM = 4

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

/** Escala (px da tela por px da foto) com zoom 1: a foto cobre a janela pelo lado menor. */
export function coverScale(image: Size, view: number): number {
  return view / Math.min(image.width, image.height)
}

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(1, zoom))

/** Prende o deslocamento pra a foto nunca deixar canto vazio dentro da janela. */
export function clampOffset(offset: Offset, image: Size, view: number, zoom: number): Offset {
  const scale = coverScale(image, view) * zoom
  const maxX = Math.max(0, (image.width * scale - view) / 2)
  const maxY = Math.max(0, (image.height * scale - view) / 2)
  return { x: Math.min(maxX, Math.max(-maxX, offset.x)), y: Math.min(maxY, Math.max(-maxY, offset.y)) }
}

/**
 * Zoom em volta de um ponto (o cursor, ou o meio dos dois dedos), que fica parado na tela.
 * `at` é relativo ao centro da janela, em px da tela.
 */
export function zoomAt(offset: Offset, from: number, to: number, at: Offset, image: Size, view: number): { zoom: number; offset: Offset } {
  const zoom = clampZoom(to)
  const k = zoom / from
  const next = { x: at.x - (at.x - offset.x) * k, y: at.y - (at.y - offset.y) * k }
  return { zoom, offset: clampOffset(next, image, view, zoom) }
}

/**
 * O pedaço da foto original (em px da foto) que está dentro da janela: sempre um quadrado.
 * `window` = lado da janela em px da tela (por padrão, o quadro inteiro).
 */
export function sourceRect(image: Size, view: number, zoom: number, offset: Offset, window = view) {
  const scale = coverScale(image, view) * zoom
  const size = window / scale
  const center = { x: image.width / 2 - offset.x / scale, y: image.height / 2 - offset.y / scale }
  // arredondamento pode empurrar um tiquinho pra fora da foto: segura dentro dela
  const x = Math.min(image.width - size, Math.max(0, center.x - size / 2))
  const y = Math.min(image.height - size, Math.max(0, center.y - size / 2))
  return { x, y, size }
}
