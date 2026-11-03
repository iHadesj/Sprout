// Lista "solta": os itens recuam alternadamente (0, 18, 8 px...), então a coluna não fica
// reta. Só margem: não muda a ordem nem cria rolagem lateral.
import type { HTMLAttributes } from 'react'
import styles from './Drift.module.css'

interface DriftProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'ul' | 'ol'
}

export function Drift({ as: Tag = 'div', className, ...rest }: DriftProps) {
  return <Tag className={[styles.drift, className].filter(Boolean).join(' ')} {...rest} />
}
