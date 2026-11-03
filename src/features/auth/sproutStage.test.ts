import { describe, expect, it } from 'vitest'
import { isEmailLike, sproutStage, type FormSignals } from './sproutStage'

const base: FormSignals = { email: '', password: '', busy: false, wilting: false, success: false }

describe('isEmailLike', () => {
  it('aceita e-mails comuns, com espaço sobrando nas pontas', () => {
    expect(isEmailLike('edu@sprout.test')).toBe(true)
    expect(isEmailLike('  a.b+c@mail.com.br ')).toBe(true)
  })

  it('recusa o que ainda está sendo digitado', () => {
    for (const value of ['', 'edu', 'edu@', 'edu@sprout', 'edu@sprout.t', 'e du@sprout.test']) {
      expect(isEmailLike(value)).toBe(false)
    }
  })
})

describe('sproutStage', () => {
  it('sem nada preenchido, a muda fica parada no vento', () => {
    expect(sproutStage(base)).toBe('idle')
  })

  it('cada campo pronto vale uma folha, na ordem que for', () => {
    expect(sproutStage({ ...base, email: 'edu@sprout.test' })).toBe('oneLeaf')
    expect(sproutStage({ ...base, password: 'x' })).toBe('oneLeaf')
    expect(sproutStage({ ...base, email: 'edu@', password: 'x' })).toBe('oneLeaf')
    expect(sproutStage({ ...base, email: 'edu@sprout.test', password: 'x' })).toBe('twoLeaves')
  })

  it('sucesso vence murchar, que vence carregando', () => {
    const filled = { ...base, email: 'edu@sprout.test', password: 'x' }
    expect(sproutStage({ ...filled, busy: true })).toBe('loading')
    expect(sproutStage({ ...filled, busy: true, wilting: true })).toBe('error')
    expect(sproutStage({ ...filled, wilting: true, success: true })).toBe('success')
  })
})
