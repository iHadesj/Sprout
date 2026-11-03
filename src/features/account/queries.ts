import { useQuery } from '@tanstack/react-query'
import { getProfile } from '../../lib/api'
import { useAuth } from '../auth/authContext'

export const profileKey = (userId: string) => ['profile', userId] as const

/** Perfil do usuário logado (username e fuso horário). */
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  return useQuery({ queryKey: profileKey(userId), queryFn: () => getProfile(userId), enabled: !!userId })
}
