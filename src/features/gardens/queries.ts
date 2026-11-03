// Leituras e escritas de jardins e plantas com o TanStack Query: ele guarda em cache,
// evita buscar duas vezes e, quando invalidamos uma chave, busca de novo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveGarden,
  createGarden,
  getGarden,
  listGardens,
  listPlants,
  updateGarden,
  type Garden,
  type GardenInput,
} from '../../lib/api'

export const gardenKeys = {
  all: ['gardens'] as const,
  detail: (id: string) => ['gardens', id] as const,
  /** Sem gardenId = plantas de todos os jardins. Invalidar ['plants'] pega todas. */
  plants: (gardenId?: string) => ['plants', gardenId ?? 'all'] as const,
}

export function useGardens() {
  return useQuery({ queryKey: gardenKeys.all, queryFn: listGardens })
}

export function useGarden(id: string) {
  return useQuery({ queryKey: gardenKeys.detail(id), queryFn: () => getGarden(id) })
}

export function usePlants(gardenId?: string) {
  return useQuery({ queryKey: gardenKeys.plants(gardenId), queryFn: () => listPlants(gardenId) })
}

export function useCreateGarden() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GardenInput) => createGarden(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gardenKeys.all }),
  })
}

export function useUpdateGarden(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<GardenInput>) => updateGarden(id, patch),
    onSuccess: (garden: Garden) => {
      queryClient.setQueryData(gardenKeys.detail(id), garden)
      return queryClient.invalidateQueries({ queryKey: gardenKeys.all })
    },
  })
}

export function useArchiveGarden(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => archiveGarden(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gardenKeys.all }),
  })
}
