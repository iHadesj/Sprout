// Mola amortecida pra animar valores dentro do useFrame (folha brotando, pétala abrindo).
// Diferente de um lerp, a mola tem velocidade: com pouco amortecimento ela passa do alvo
// e volta (o "overshoot"), e se o alvo muda no meio do caminho ela não dá tranco.

export interface SpringConfig {
  /** rigidez: quanto maior, mais rápido chega */
  stiffness: number
  /** amortecimento: abaixo de 2 * sqrt(stiffness) passa do alvo antes de assentar */
  damping: number
}

export class Spring {
  value: number
  velocity = 0
  config: SpringConfig

  constructor(value: number, config: SpringConfig) {
    this.value = value
    this.config = config
  }

  /** Avança `dt` segundos em direção a `target` e devolve o valor novo. */
  step(target: number, dt: number): number {
    // passos de no máximo 1/60 s: com quadros longos (aba em segundo plano) a mola não explode
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)))
    const h = Math.min(dt, 0.25) / steps
    for (let i = 0; i < steps; i++) {
      const force = this.config.stiffness * (target - this.value) - this.config.damping * this.velocity
      this.velocity += force * h
      this.value += this.velocity * h
    }
    return this.value
  }
}
