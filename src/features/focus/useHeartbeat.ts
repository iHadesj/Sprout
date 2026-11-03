// Avisa o servidor a cada 30 s que a aba continua aberta (session_heartbeat).
// Os avisos param quando a aba fecha ou congela (celular com o navegador no fundo). O servidor
// não pune o silêncio no meio do foco: só abandona a sessão quando já passou do planejado
// + 2 h sem notícias (aí nem daria mais pra concluir). Fechar a aba de propósito o front avisa.
// Roda no relógio de segundo plano: com o Sprout atrás de outro app, o Chrome atrasaria
// um setInterval comum pra 1x por minuto, perto demais do limite do servidor.
// Se o servidor responder que a sessão não está mais ativa, chama `onLost`.
import { useEffect, useRef } from 'react'
import { sendHeartbeat } from '../../lib/api'
import { setBackgroundInterval } from '../../lib/backgroundClock'

export const HEARTBEAT_MS = 30_000

export function useHeartbeat(sessionId: string | null, onLost: () => void) {
  const onLostRef = useRef(onLost)
  useEffect(() => {
    onLostRef.current = onLost
  })

  useEffect(() => {
    if (!sessionId) return
    return setBackgroundInterval(async () => {
      try {
        if (!(await sendHeartbeat(sessionId))) onLostRef.current()
      } catch {
        // rede oscilou: o próximo heartbeat tenta de novo
      }
    }, HEARTBEAT_MS)
  }, [sessionId])
}
