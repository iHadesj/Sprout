// Regra do nome de usuário, a mesma do banco (constraint username_format): de 3 a 24
// caracteres, letras minúsculas, números, _ e ponto, sem ponto no começo, no fim ou repetido.
// Aqui é só pra avisar antes de enviar; quem barra de verdade é o banco.

export const USERNAME_HINT = 'De 3 a 24 caracteres: letras, números, _ e ponto (sem ponto no começo, no fim ou dois seguidos).'

const FORMAT = /^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$/

/** O que a pessoa digita vira minúsculas e sem espaços (o banco guarda assim). */
export function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/\s/g, '')
}

/** Mensagem de erro, ou null se está ok (vazio também está ok: o nome é opcional). */
export function usernameError(name: string): string | null {
  if (!name) return null
  if (!FORMAT.test(name) || name.includes('..')) return `Nome de usuário inválido. ${USERNAME_HINT}`
  return null
}
