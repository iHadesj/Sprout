// Raiz do app: providers (cache de dados e login) em volta das rotas.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { supabaseConfigured } from '../lib/supabase'
import { router } from './router'
import { SetupScreen } from './SetupScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export function App() {
  if (!supabaseConfigured) {
    return (
      <SetupScreen />
    )
  }
  return (
    // reducedMotion="user": quem ativou "reduzir movimento" no sistema não vê deslizes e pulos
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  )
}
