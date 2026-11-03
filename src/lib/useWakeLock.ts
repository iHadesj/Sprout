// Mantém a tela acesa durante o foco (Screen Wake Lock API).
// No celular, a tela apagando sozinha dispara visibilitychange e mataria a planta.
// O navegador solta o wake lock quando a aba some; pedimos de novo quando ela volta.
import { useEffect } from 'react'

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (stopped) void next.release()
        else lock = next
      } catch {
        // sem permissão ou bateria fraca: segue sem wake lock
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
