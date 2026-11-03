// Leituras das views de estatística. Depois de uma sessão, invalidar ['stats'] atualiza tudo.
import { useQuery } from '@tanstack/react-query'
import { getStreaks, listDistractions, listFocusDays, listGardenStats } from '../../lib/api'

export function useGardenStats() {
  return useQuery({ queryKey: ['stats', 'gardens'], queryFn: listGardenStats })
}

export function useFocusDays(since: string) {
  return useQuery({ queryKey: ['stats', 'days', since], queryFn: () => listFocusDays(since) })
}

export function useStreaks() {
  return useQuery({ queryKey: ['stats', 'streaks'], queryFn: getStreaks })
}

export function useDistractions() {
  return useQuery({ queryKey: ['stats', 'distractions'], queryFn: listDistractions })
}
