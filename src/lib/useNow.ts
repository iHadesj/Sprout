import { useEffect, useState } from 'react'

/**
 * Relógio atualizado a cada `intervalMs`, pra contagens na tela.
 * Padrão: performance.now() (ex.: "próximo foco em 40 s"). Passe Date.now pra hora do calendário.
 */
export function useNow(intervalMs: number, enabled = true, clock: () => number = () => performance.now()): number {
  const [now, setNow] = useState(clock)

  useEffect(() => {
    if (!enabled) return
    // atualiza já ao ligar: o valor guardado pode ser de minutos atrás
    const update = () => setNow(clock())
    update()
    const id = window.setInterval(update, intervalMs)
    return () => window.clearInterval(id)
    // o relógio é fixo por chamada; não reinicia o intervalo se a função mudar de identidade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled])

  return now
}
