// Avatar de amigo: um raminho desenhado a traço dentro de uma pedrinha, diferente pra cada
// pessoa e sempre o mesmo pra ela (o desenho sai do id em `sprig.ts`). A pedrinha fica num tom
// claro da cor da pessoa, pra dar pra diferenciar de longe.
//
// Só enfeite: o nome vem escrito ao lado, então o desenho é aria-hidden. Sem id (um convite
// ainda sem dono, por exemplo), cai no nome como semente.
import type { CSSProperties } from 'react'
import { sprigOf } from './sprig'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string | null
  /** id da pessoa: o que decide o desenho (o nome pode mudar, o id não) */
  seed?: string | null
  size?: number
  /** você: a pedrinha fica no verde de herbário, como o resto das suas coisas */
  me?: boolean
}

export function Avatar({ name, seed, size = 56, me = false }: AvatarProps) {
  const sprig = sprigOf(seed ?? name ?? '?')
  const style = {
    '--avatar': `${size}px`,
    '--sprig-accent': sprig.accent,
  } as CSSProperties

  return (
    <span className={styles.avatar} data-me={me || undefined} style={style} aria-hidden="true">
      <svg className={styles.sprig} viewBox="0 0 24 32" focusable="false">
        <path d={sprig.stem} className={styles.stem} />
        {sprig.leaves.map((d, i) => (
          <path key={i} d={d} className={styles.leaf} fill={sprig.leafColor} />
        ))}
        <path d={sprig.tip.d} className={styles.tip} fill={sprig.tip.kind === 'cacho' ? 'none' : sprig.accent} />
      </svg>
    </span>
  )
}
