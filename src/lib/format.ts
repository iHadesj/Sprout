/** 1_500_000 ms -> "25:00". Arredonda pra cima pra não mostrar "0:00" com tempo sobrando. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
