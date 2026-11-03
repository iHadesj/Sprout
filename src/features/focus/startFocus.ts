// Começar um foco com um clique, de qualquer tela: libera o som e pede a permissão de
// notificação ainda dentro do clique (o navegador só deixa assim) e vai pra tela de foco do
// jardim pedindo pra começar sozinha (state.autostart). Quem confere se pode começar
// (outra sessão aberta, revisão pendente, 1 min depois de pular a pausa) é a FocusScreen.
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { primeChime } from '../../lib/chime'
import { askNotifyPermission } from '../../lib/notify'

export interface FocusRouteState {
  autostart?: boolean
}

export function useStartFocus() {
  const navigate = useNavigate()
  return useCallback(
    (gardenId: string) => {
      primeChime()
      askNotifyPermission()
      navigate(`/jardim/${gardenId}/foco`, { state: { autostart: true } satisfies FocusRouteState })
    },
    [navigate],
  )
}
