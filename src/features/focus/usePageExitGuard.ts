// Protege a sessão contra saídas da página durante o foco:
// - fechar ou recarregar a aba: o navegador pede confirmação (beforeunload) e, se a pessoa
//   sair mesmo, o pagehide avisa o servidor com fetch keepalive (a planta morre);
// - navegar dentro do app (link, botão voltar): o useBlocker segura e a tela pergunta.
import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { failSessionOnPageClose } from '../../lib/api'

export function usePageExitGuard(sessionId: string | null, accessToken: string | null) {
  useEffect(() => {
    if (!sessionId || !accessToken) return
    // persisted = a página foi pro cache de voltar (pode reaparecer): não é fechar a aba
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) failSessionOnPageClose(sessionId, accessToken)
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = '' // navegadores mais antigos só mostram a confirmação com isto
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [sessionId, accessToken])

  return useBlocker(Boolean(sessionId))
}
