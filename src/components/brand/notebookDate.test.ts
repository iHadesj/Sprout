import { describe, expect, it } from 'vitest'
import { formatNotebookDate } from './notebookDate'

describe('formatNotebookDate', () => {
  // 16h UTC: ainda terça em São Paulo, já quarta em Tóquio
  const NOW = Date.parse('2026-11-03T16:00:00Z')

  it('escreve dia da semana, dia e mês, sem ponto', () => {
    expect(formatNotebookDate(NOW, 'America/Sao_Paulo')).toBe('ter · 03 nov')
  })

  it('usa o fuso da pessoa', () => {
    expect(formatNotebookDate(NOW, 'Asia/Tokyo')).toBe('qua · 04 nov')
  })
})
