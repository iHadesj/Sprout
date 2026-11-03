import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  /** Sessão de login do Supabase (tem o access_token do usuário). */
  session: Session | null
  user: User | null
  /** true até o Supabase dizer se tem alguém logado (lê do localStorage). */
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth precisa estar dentro do <AuthProvider>')
  return auth
}
