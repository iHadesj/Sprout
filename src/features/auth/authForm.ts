// Estado do form de login/cadastro, que mora no AuthLayout e chega nas rotas pelo outlet
// context. Fica num lugar só pra a muda não reiniciar ao trocar de rota: o e-mail e a senha
// digitados continuam lá (e as folhas também).
import { AuthError } from '@supabase/supabase-js'
import { useOutletContext } from 'react-router'

export interface AuthMessage {
  kind: 'error' | 'info'
  text: string
}

/** O que o envio deu: entrou (a muda floresce e o app abre) ou um aviso (ex.: confirmar o e-mail). */
export type SubmitOutcome = { kind: 'signed-in' } | { kind: 'info'; text: string }

export interface AuthFormState {
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  /** enviando (ou já entrando no app) */
  busy: boolean
  message: AuthMessage | null
  /** Envia: erro = card balança e folhas murcham; sucesso = flor, dolly e app. */
  submit: (send: () => Promise<SubmitOutcome>) => void
  /** state da rota (pra onde ia antes do login), repassado nos links entre login e cadastro */
  linkState: unknown
}

export function useAuthForm(): AuthFormState {
  return useOutletContext<AuthFormState>()
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com esse e-mail.',
  weak_password: 'Senha fraca: use pelo menos 6 caracteres.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).',
  over_email_send_rate_limit: 'Muitas tentativas. Espere um pouco e tente de novo.',
}

export function authMessage(error: unknown): string {
  if (error instanceof AuthError && error.code && AUTH_ERRORS[error.code]) return AUTH_ERRORS[error.code]
  return error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.'
}
