import { describe, expect, it } from 'vitest'
import { addDays, distractionInsight, formatMinutes, honestySeal, isNeglected, lastDays, todayIn } from './insights'

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-10-22T15:00:00Z')

describe('jardim esquecido (folhas amarelas)', () => {
  it('3 dias sem sessão concluída amarela; uma sessão volta ao normal', () => {
    const created = '2026-10-01T10:00:00Z'
    expect(isNeglected(new Date(NOW - 73 * HOUR).toISOString(), created, NOW)).toBe(true)
    expect(isNeglected(new Date(NOW - 71 * HOUR).toISOString(), created, NOW)).toBe(false)
  })

  it('jardim novo sem sessão não amarela antes de 3 dias de criado', () => {
    expect(isNeglected(null, new Date(NOW - 24 * HOUR).toISOString(), NOW)).toBe(false)
    expect(isNeglected(null, new Date(NOW - 80 * HOUR).toISOString(), NOW)).toBe(true)
  })
})

describe('selo de honestidade', () => {
  it('sobe de nível com os "não" assumidos', () => {
    expect(honestySeal(0)).toBeNull()
    expect(honestySeal(1)?.level).toBe(1)
    expect(honestySeal(5)?.level).toBe(2)
    expect(honestySeal(15)?.label).toBe('Honestidade de ferro')
  })
})

describe('dias', () => {
  it('hoje no fuso do usuário', () => {
    // 15h UTC = 12h em São Paulo, mas já é dia 23 em Tóquio
    expect(todayIn('America/Sao_Paulo', NOW)).toBe('2026-10-22')
    expect(todayIn('Asia/Tokyo', Date.parse('2026-10-22T16:00:00Z'))).toBe('2026-10-23')
  })

  it('soma dias atravessando mês', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('preenche com zero os dias sem foco', () => {
    const days = lastDays([{ day: '2026-10-21', minutes: 50, sessions: 2, user_id: 'u' }], '2026-10-22', 3)
    expect(days).toEqual([
      { day: '2026-10-20', minutes: 0, sessions: 0 },
      { day: '2026-10-21', minutes: 50, sessions: 2 },
      { day: '2026-10-22', minutes: 0, sessions: 0 },
    ])
  })

  it('formata minutos', () => {
    expect(formatMinutes(40)).toBe('40 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(95)).toBe('1 h 35 min')
  })
})

describe('frase das distrações', () => {
  const row = (tag: string, hour: number, count: number) => ({ tag, hour, count, user_id: 'u' })

  it('fica quieta com pouco dado', () => {
    expect(distractionInsight([row('celular', 23, 2)])).toBeNull()
  })

  it('aponta o motivo mais comum e o horário em que ele concentra', () => {
    const text = distractionInsight([row('celular', 22, 3), row('celular', 23, 2), row('celular', 10, 1), row('fome', 12, 2)])
    expect(text).toBe('O celular é o que mais te distrai, principalmente depois das 22h.')
  })

  it('sem horário dominante, fala só do motivo', () => {
    const text = distractionInsight([row('barulho', 2, 1), row('barulho', 9, 1), row('barulho', 14, 1), row('barulho', 20, 1)])
    expect(text).toBe('O barulho é o que mais te atrapalha.')
  })
})
