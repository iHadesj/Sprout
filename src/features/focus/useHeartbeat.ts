// Avisa o servidor a cada 30 s que a aba continua aberta (session_heartbeat).
// Fechou a aba, os avisos param e o servidor abandona a sessão sozinho (90 s sem notícias).
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
        // rede oscilou: o próximo heartbeat tenta de novo (o servidor tolera 90 s)
      }
    }, HEARTBEAT_MS)
  }, [sessionId])
}
