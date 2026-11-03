// Contas das composições curvas: onde cada item cai num arco e quanto cada linha recua numa
// lista que "contorna" alguma coisa. Só números; quem desenha são os componentes.

/** Posição no arco: -1 (primeiro) .. 1 (último); com 1 item, 0 (meio). */
export function along(i: number, n: number) {
  return n <= 1 ? 0 : (i / (n - 1)) * 2 - 1
}

/**
 * Arco "sorriso" (o meio mais baixo): quanto o item desce (px) e quanto gira (graus) pra
 * acompanhar a curva. bend negativo vira o arco pra cima.
 */
export function arc(i: number, n: number, bend: number, tilt: number) {
  const t = along(i, n)
  return { lift: Math.round(bend * (1 - t * t) * 10) / 10, angle: Math.round(-t * tilt * 10) / 10 }
}

/** Recuo de uma linha numa lista curva: cresce até o meio e volta (0 → max → 0). */
export function bulge(i: number, n: number, max: number) {
  return n <= 1 ? 0 : Math.round(Math.sin((i / (n - 1)) * Math.PI) * max)
}
