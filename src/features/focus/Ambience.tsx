// Escolha do som ambiente, na ficha do foco: silêncio, chuva, vento ou folhas.
// O som vem de `lib/ambience.ts` (chuva e folhas são gravações em loop, vento é gerado), começa
// e para junto com esta peça, e a escolha fica guardada neste navegador. Desligado por padrão.
//
// É um controle parado: não anima sozinho, como o resto da tela de foco.
import { useEffect, useState } from 'react'
import { AMBIENCE_OPTIONS, ambiencePreference, rememberAmbience, startAmbience, stopAmbience, type AmbienceKind } from '../../lib/ambience'
import styles from './Ambience.module.css'

export function Ambience() {
  const [kind, setKind] = useState<AmbienceKind>(ambiencePreference)

  useEffect(() => {
    startAmbience(kind)
    return () => stopAmbience()
  }, [kind])

  const choose = (value: AmbienceKind) => {
    setKind(value)
    rememberAmbience(value)
  }

  return (
    <div className={styles.row} role="radiogroup" aria-label="Som ambiente">
      {AMBIENCE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={kind === option.value}
          className={styles.chip}
          data-on={kind === option.value || undefined}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
