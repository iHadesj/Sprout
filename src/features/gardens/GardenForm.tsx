// Formulário de criar/editar jardim. Os limites (foco de 15 a 60 min, pausa de 3 a 15)
// repetem os CHECKs do banco só pra avisar antes; quem garante é o banco.
import { useState, type CSSProperties, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '../../components/Button'
import type { GardenInput } from '../../lib/api'
import { BIOMES, GARDEN_COLORS } from './gardenOptions'
import styles from './GardenForm.module.css'

interface GardenFormProps {
  initial?: Partial<GardenInput>
  submitLabel: string
  busy?: boolean
  error?: string | null
  onSubmit: (input: GardenInput) => void
}

export function GardenForm({ initial, submitLabel, busy = false, error, onSubmit }: GardenFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? GARDEN_COLORS[0].value)
  const [biome, setBiome] = useState(initial?.biome ?? 'campo')
  const [focus, setFocus] = useState(initial?.focus_minutes ?? 25)
  const [rest, setRest] = useState(initial?.break_minutes ?? 5)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ name: name.trim(), color, biome, focus_minutes: focus, break_minutes: rest })
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span className="kicker">Nome</span>
        <input
          className="field-input"
          required
          maxLength={40}
          placeholder="Faculdade, treino, inglês…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <fieldset className={styles.field}>
        <legend className="kicker">Cor dos frutos e flores</legend>
        <div className={styles.swatches}>
          {GARDEN_COLORS.map((c) => (
            <input
              key={c.value}
              type="radio"
              name="color"
              className={styles.swatch}
              style={{ '--swatch': c.value } as CSSProperties}
              value={c.value}
              checked={color === c.value}
              aria-label={c.label}
              onChange={() => setColor(c.value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.field}>
        <legend className="kicker">Bioma da ilha</legend>
        <div className={styles.biomes}>
          {BIOMES.map((b) => (
            <label key={b.value} className={styles.biome}>
              <input type="radio" name="biome" value={b.value} checked={biome === b.value} onChange={() => setBiome(b.value)} />
              <span>{b.label}</span>
              <small>{b.hint}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.times}>
        <label className={styles.field}>
          <span className={styles.rangeLabel}>
            <span className="kicker">Foco</span>
            <span className="mono">{focus} min</span>
          </span>
          <input type="range" min={15} max={60} step={5} value={focus} onChange={(e) => setFocus(Number(e.target.value))} />
        </label>

        <label className={styles.field}>
          <span className={styles.rangeLabel}>
            <span className="kicker">Pausa</span>
            <span className="mono">{rest} min</span>
          </span>
          <input type="range" min={3} max={15} step={1} value={rest} onChange={(e) => setRest(Number(e.target.value))} />
        </label>
      </div>
      <small className={styles.hint}>A cada 4 focos, a pausa é longa: 15 min.</small>

      <AnimatePresence>
        {error && (
          <motion.p className={styles.error} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button type="submit" size="lg" busy={busy} disabled={!name.trim()}>
        {submitLabel}
      </Button>
    </form>
  )
}
