// Avatar de amigo: uma pedrinha colorida com a inicial. A cor sai do nome (sempre a mesma pra
// mesma pessoa), da paleta dos jardins. Só enfeite: o nome vem escrito ao lado.
import type { CSSProperties } from 'react'
import { GARDEN_COLORS } from '../gardens/gardenOptions'
import styles from './Avatar.module.css'

function colorOf(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return GARDEN_COLORS[hash % GARDEN_COLORS.length].value
}

export function Avatar({ name, size = 56, me = false }: { name: string | null; size?: number; me?: boolean }) {
  const label = name ?? '?'
  const style = { '--avatar': `${size}px`, background: me ? 'var(--herb)' : colorOf(label) } as CSSProperties
  return (
    <span className={styles.avatar} data-me={me || undefined} style={style} aria-hidden="true">
      {label.charAt(0).toUpperCase()}
    </span>
  )
}
