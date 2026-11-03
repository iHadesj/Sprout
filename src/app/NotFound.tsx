// Página que não existe: a frase grande e torta, sobre uma mancha de papel, e o caminho de volta.
import { ButtonLink } from '../components/Button'
import { Blob } from '../components/organic/Blob'
import styles from './NotFound.module.css'

export function NotFound() {
  return (
    <div className={styles.page}>
      <Blob className={styles.blob} />
      <div className={styles.body}>
        <p className="kicker">Página 404</p>
        <h1>Essa página foi arrancada do caderno</h1>
        <p className={styles.lead}>O endereço não existe, ou nunca existiu.</p>
        <ButtonLink to="/" variant="secondary">
          Voltar ao início
        </ButtonLink>
      </div>
    </div>
  )
}
