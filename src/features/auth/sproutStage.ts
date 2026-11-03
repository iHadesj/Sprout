// O que a muda da tela de login mostra, a partir do que está acontecendo no form.
// A cena 3D só conhece o `SproutStage`; quem decide o estágio é esta função pura.

export type SproutStage =
  /** nada preenchido: só balança com o vento */
  | 'idle'
  /** um dos campos pronto (e-mail válido ou senha): brota a primeira folha */
  | 'oneLeaf'
  /** os dois prontos: brota a segunda */
  | 'twoLeaves'
  /** enviando: estica pra cima, crescendo devagar */
  | 'loading'
  /** login recusado: as folhas murcham (o form volta pro normal depois de ~1,5 s) */
  | 'error'
  /** entrou: floresce e a câmera se aproxima */
  | 'success'

export interface FormSignals {
  email: string
  password: string
  busy: boolean
  wilting: boolean
  success: boolean
}

/** Tem cara de e-mail (o servidor é quem confere de verdade). */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function sproutStage({ email, password, busy, wilting, success }: FormSignals): SproutStage {
  if (success) return 'success'
  if (wilting) return 'error'
  if (busy) return 'loading'
  const ready = Number(isEmailLike(email)) + Number(password.length > 0)
  return ready === 2 ? 'twoLeaves' : ready === 1 ? 'oneLeaf' : 'idle'
}
