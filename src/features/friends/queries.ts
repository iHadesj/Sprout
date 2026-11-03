// Amigos, ranking e presentes com o TanStack Query. Tudo passa por funções do servidor,
// que conferem a amizade; aqui só se busca, guarda em cache e invalida depois de mudar algo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clapEvent,
  friendFeed,
  friendGardens,
  friendPlants,
  friendRanking,
  gardenFlowers,
  joinByInvite,
  lastFlowerFor,
  lastGiftTo,
  listFriends,
  nudgeReplies,
  plantFlower,
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
  lastGift: (userId: string, kind: GiftKind) => ['friends', 'last-gift', userId, kind] as const,
  lastFlower: (userId: string) => ['friends', 'last-flower', userId] as const,
  flowers: (gardenId: string) => ['flowers', gardenId] as const,
  feed: ['friends', 'feed'] as const,
  unseenGifts: ['gifts', 'unseen'] as const,
  nudgeReplies: ['gifts', 'nudge-replies'] as const,
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

export function useLastGift(userId: string, kind: GiftKind) {
  return useQuery({ queryKey: friendKeys.lastGift(userId, kind), queryFn: () => lastGiftTo(userId, kind) })
}

/** Última flor que eu plantei pra esse amigo (o limite é 1 por semana, somando os jardins dele). */
export function useLastFlower(userId: string, gardenIds: string[]) {
  return useQuery({ queryKey: [...friendKeys.lastFlower(userId), gardenIds.join()], queryFn: () => lastFlowerFor(gardenIds), enabled: gardenIds.length > 0 })
}

/** Flores de um jardim (meu ou de amigo). Sem jardim, não busca. */
export function useGardenFlowers(gardenId: string | null) {
  return useQuery({ queryKey: friendKeys.flowers(gardenId ?? ''), queryFn: () => gardenFlowers(gardenId!), enabled: !!gardenId })
}

export function useFeed() {
  return useQuery({ queryKey: friendKeys.feed, queryFn: friendFeed })
}

/** Chamados que o amigo atendeu (mesma ideia dos presentes: parados na tela, buscados de novo na próxima visita). */
export function useNudgeReplies() {
  return useQuery({ queryKey: friendKeys.nudgeReplies, queryFn: nudgeReplies, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false })
}

export function useClap() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ to, eventKey }: { to: string; eventKey: string }) => clapEvent(to, eventKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.feed }),
  })
}

export function usePlantFlower(friendId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ gardenId, color }: { gardenId: string; color: string }) => plantFlower(gardenId, color),
    onSuccess: (flower) => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.flowers(flower.garden_id) })
      void queryClient.invalidateQueries({ queryKey: friendKeys.lastFlower(friendId) })
    },
  })
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
    onSuccess: (_, { kind }) => queryClient.invalidateQueries({ queryKey: friendKeys.lastGift(to, kind) }),
  })
}
