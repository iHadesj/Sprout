import { describe, expect, it } from 'vitest'
import { clampOffset, clampZoom, coverScale, MAX_ZOOM, sourceRect, WINDOW, zoomAt } from './avatarCrop'

const landscape = { width: 4000, height: 3000 }
const portrait = { width: 1200, height: 1600 }
const VIEW = 280

describe('corte da foto de perfil', () => {
  it('sem mexer, pega o quadrado do meio pelo lado menor', () => {
    expect(sourceRect(landscape, VIEW, 1, { x: 0, y: 0 })).toEqual({ x: 500, y: 0, size: 3000 })
    expect(sourceRect(portrait, VIEW, 1, { x: 0, y: 0 })).toEqual({ x: 0, y: 200, size: 1200 })
  })

  it('zoom 2 pega metade do lado, ainda no meio', () => {
    const rect = sourceRect(landscape, VIEW, 2, { x: 0, y: 0 })
    expect(rect.size).toBeCloseTo(1500)
    expect(rect.x + rect.size / 2).toBeCloseTo(2000)
    expect(rect.y + rect.size / 2).toBeCloseTo(1500)
  })

  it('arrastar a foto pra direita mostra a parte da esquerda dela', () => {
    const moved = sourceRect(landscape, VIEW, 1, { x: 40, y: 0 })
    expect(moved.x).toBeLessThan(500)
  })

  it('nunca deixa canto vazio: o arraste para na borda da foto', () => {
    // paisagem com zoom 1: só dá pra arrastar de lado, nada na vertical
    const scale = coverScale(landscape, VIEW)
    const free = (landscape.width * scale - VIEW) / 2
    expect(clampOffset({ x: 9999, y: 9999 }, landscape, VIEW, 1)).toEqual({ x: free, y: 0 })
    expect(clampOffset({ x: -9999, y: 0 }, landscape, VIEW, 1).x).toBeCloseTo(-free)
    // e o pedaço cortado fica sempre dentro da foto
    for (const offset of [{ x: 9999, y: 9999 }, { x: -9999, y: -9999 }]) {
      const rect = sourceRect(landscape, VIEW, 1.7, clampOffset(offset, landscape, VIEW, 1.7))
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.size).toBeLessThanOrEqual(landscape.width + 1e-6)
      expect(rect.y + rect.size).toBeLessThanOrEqual(landscape.height + 1e-6)
    }
  })

  it('salva só o que está dentro da janela (menor que o quadro), no mesmo centro', () => {
    const whole = sourceRect(landscape, VIEW, 1.3, { x: 20, y: -10 })
    const hole = sourceRect(landscape, VIEW, 1.3, { x: 20, y: -10 }, VIEW * WINDOW)
    expect(hole.size).toBeCloseTo(whole.size * WINDOW)
    expect(hole.x + hole.size / 2).toBeCloseTo(whole.x + whole.size / 2)
    expect(hole.y + hole.size / 2).toBeCloseTo(whole.y + whole.size / 2)
  })

  it('o zoom fica entre 1 e o máximo', () => {
    expect(clampZoom(0.2)).toBe(1)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })

  it('o ponto debaixo do cursor fica parado no zoom', () => {
    const at = { x: 60, y: -40 }
    const before = sourceRect(portrait, VIEW, 1.5, { x: 0, y: 0 })
    const { zoom, offset } = zoomAt({ x: 0, y: 0 }, 1.5, 2.5, at, portrait, VIEW)
    const after = sourceRect(portrait, VIEW, zoom, offset)
    // o mesmo ponto da tela (centro + at) aponta pro mesmo ponto da foto antes e depois
    const pointIn = (rect: { x: number; y: number; size: number }) => ({
      x: rect.x + ((at.x + VIEW / 2) / VIEW) * rect.size,
      y: rect.y + ((at.y + VIEW / 2) / VIEW) * rect.size,
    })
    expect(pointIn(after).x).toBeCloseTo(pointIn(before).x, 0)
    expect(pointIn(after).y).toBeCloseTo(pointIn(before).y, 0)
  })

  it('tirar o zoom puxa a foto de volta pra não sobrar buraco', () => {
    const { offset } = zoomAt({ x: 300, y: 300 }, 3, 1, { x: 0, y: 0 }, portrait, VIEW)
    expect(offset.y).toBeLessThanOrEqual((portrait.height * coverScale(portrait, VIEW) - VIEW) / 2 + 1e-9)
    expect(offset.x).toBe(0)
  })
})
