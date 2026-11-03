// Leituras de sessões que a tela de foco precisa ao abrir.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { expireStaleSessions, getActiveSession, getPendingReview } from '../../lib/api'

export const sessionKeys = {
  active: ['sessions', 'active'] as const,
  pendingReview: (gardenId: string) => ['sessions', 'pending', gardenId] as const,
}

/**
 * Sessão ativa no servidor (de outra aba ou dispositivo, ou esquecida).
 * Antes de buscar, pede pro servidor encerrar as esquecidas: assim o jardim mostra a verdade.
 */
export function useActiveSession() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: sessionKeys.active,
    queryFn: async () => {
      if ((await expireStaleSessions()) > 0) await queryClient.invalidateQueries({ queryKey: ['plants'] })
      return getActiveSession()
    },
  })
}

/** Sessão concluída sem resposta da revisão (a aba fechou antes de responder). */
export function usePendingReview(gardenId: string) {
  return useQuery({ queryKey: sessionKeys.pendingReview(gardenId), queryFn: () => getPendingReview(gardenId) })
}
