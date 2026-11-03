import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameError } from './username'

describe('nome de usuário', () => {
  it('aceita letras, números, _ e ponto no meio', () => {
    for (const ok of ['edu', 'edu.dev', 'edu_dev', 'e.d.u', '123', '']) expect(usernameError(ok)).toBeNull()
  })

  it('recusa ponto na ponta, ponto duplo, curto, longo e outros símbolos', () => {
    for (const bad of ['.edu', 'edu.', 'edu..dev', 'ed', 'a'.repeat(25), 'edu-dev', 'édu']) expect(usernameError(bad)).not.toBeNull()
  })

  it('digitado vira minúsculas e sem espaços', () => {
    expect(normalizeUsername('Edu.Dev ')).toBe('edu.dev')
  })
})
