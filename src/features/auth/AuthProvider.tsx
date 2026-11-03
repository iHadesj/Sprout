// Guarda quem está logado e avisa o app quando muda (entrou, saiu, token renovado).
// O próprio supabase-js salva o login no localStorage; aqui só espelhamos no React.
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // dispara na hora com a sessão salva (INITIAL_SESSION) e depois a cada mudança
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (event === 'SIGNED_OUT') queryClient.clear() // não deixa dados de um usuário pro próximo
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext value={{ session, user: session?.user ?? null, loading }}>{children}</AuthContext>
}
