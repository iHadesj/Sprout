import { describe, expect, it } from 'vitest'
import { frameCamera, frameDistance } from './framing'

describe('enquadramento da ilha', () => {
  it('moldura larga e baixa (notebook): quem manda é a altura, não a largura', () => {
    // a conta antiga, só pela largura: numa moldura larga ela chegava perto demais e as copas
    // passavam do topo
    const widthOnly = (radius: number, aspect: number) => {
      const halfH = Math.atan(Math.tan((19 * Math.PI) / 180) * aspect)
      return (radius * 1.12) / Math.tan(halfH) + radius * 0.35
    }
    expect(frameDistance(5, 2.6)).toBeGreaterThan(widthOnly(5, 2.6))
    // a partir daí, alargar mais não aproxima a câmera: a altura da moldura é a mesma
    expect(frameDistance(5, 3.5)).toBeCloseTo(frameDistance(5, 2.6))
  })

  it('moldura mais estreita (celular em pé) também afasta: a largura conta', () => {
    expect(frameDistance(5, 0.9)).toBeGreaterThan(frameDistance(5, 1.6))
  })

  it('ilha maior pede câmera mais longe', () => {
    for (const aspect of [0.9, 1.6, 2.6]) {
      expect(frameDistance(7.5, aspect)).toBeGreaterThan(frameDistance(3, aspect))
    }
  })

  it('nunca chega perto demais da ilha pequena', () => {
    expect(frameDistance(3, 1.6)).toBeGreaterThanOrEqual(6)
  })

  it('a câmera fica acima e na frente da ilha, olhando pro alvo', () => {
    const { position, target, distance } = frameCamera(4, 1.5)
    expect(position.y).toBeGreaterThan(target.y)
    expect(position.z).toBeGreaterThan(0)
    expect(Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z)).toBeCloseTo(distance)
  })

  it('aguenta proporções absurdas (moldura de 0 px durante o carregamento)', () => {
    expect(Number.isFinite(frameDistance(4, 0))).toBe(true)
    expect(Number.isFinite(frameDistance(4, 1e6))).toBe(true)
  })
})
