// O GardenLayout carrega o jardim, as plantas e as estatísticas uma vez e passa pras
// rotas filhas (visão geral e foco) pelo contexto do <Outlet>.
import { useOutletContext } from 'react-router'
import type { Garden, GardenStats, Plant } from '../../lib/api'
import type { HonestySeal } from '../stats/insights'

export interface GardenOutletContext {
  garden: Garden
  plants: Plant[]
  stats: GardenStats | null
  /** 3 dias sem sessão concluída: folhas amarelando */
  neglected: boolean
  seal: HonestySeal | null
}

export function useGardenContext() {
  return useOutletContext<GardenOutletContext>()
}
