// Amigos, ranking e presentes com o TanStack Query. Tudo passa por funções do servidor,
// que conferem a amizade; aqui só se busca, guarda em cache e invalida depois de mudar algo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  friendGardens,
  friendPlants,
  friendRanking,
  joinByInvite,
  lastWaterTo,
  listFriends,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  sendGift,
  unseenGifts,
  type GiftKind,
} from '../../lib/api'

export const friendKeys = {
  all: ['friends'] as const,
  list: ['friends', 'list'] as const,
  ranking: ['friends', 'ranking'] as const,
  gardens: (userId: string) => ['friends', 'gardens', userId] as const,
  plants: (userId: string) => ['friends', 'plants', userId] as const,
  lastWater: (userId: string) => ['friends', 'last-water', userId] as const,
  unseenGifts: ['gifts', 'unseen'] as const,
}

export function useFriends() {
  return useQuery({ queryKey: friendKeys.list, queryFn: listFriends })
}

export function useRanking() {
  return useQuery({ queryKey: friendKeys.ranking, queryFn: friendRanking })
}

export function useFriendGardens(userId: string) {
  return useQuery({ queryKey: friendKeys.gardens(userId), queryFn: () => friendGardens(userId), retry: false })
}

export function useFriendPlants(userId: string) {
  return useQuery({ queryKey: friendKeys.plants(userId), queryFn: () => friendPlants(userId), retry: false })
}

export function useLastWater(userId: string) {
  return useQuery({ queryKey: friendKeys.lastWater(userId), queryFn: () => lastWaterTo(userId) })
}

/**
 * Presentes não vistos. A lista fica parada enquanto a tela está aberta (mesmo depois de
 * marcar como vistos, a animação continua com o que chegou) e é jogada fora ao sair:
 * na próxima visita, busca de novo.
 */
export function useUnseenGifts() {
  return useQuery({ queryKey: friendKeys.unseenGifts, queryFn: unseenGifts, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false })
}

/** Mutações de amizade: depois de qualquer uma, lista e ranking são buscados de novo. */
function useFriendMutation<T, R>(fn: (arg: T) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.all }),
  })
}

export const useSendFriendRequest = () => useFriendMutation(sendFriendRequest)
export const useRespondFriendRequest = () =>
  useFriendMutation(({ userId, accept }: { userId: string; accept: boolean }) => respondFriendRequest(userId, accept))
export const useRemoveFriend = () => useFriendMutation(removeFriend)
export const useJoinByInvite = () => useFriendMutation(joinByInvite)

export function useSendGift(to: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, amount }: { kind: GiftKind; amount?: number }) => sendGift(to, kind, amount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.lastWater(to) }),
  })
}
