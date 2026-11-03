// Lembra (só neste navegador) qual jardim foi aberto por último, pro índice destacá-lo.
// É conveniência: se o armazenamento falhar (aba anônima, bloqueado), o índice escolhe outro.

const KEY = 'sprout:last-garden'

export function rememberGarden(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // sem armazenamento: tudo bem
  }
}

export function lastGardenId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
