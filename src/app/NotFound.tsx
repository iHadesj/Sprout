// Página que não existe: um pedaço de folha arrancada do caderno (borda de cima rasgada).
import { ButtonLink } from '../components/Button'
import styles from './NotFound.module.css'

export function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.torn}>
        <p className="kicker">Página 404</p>
        <h1>Essa página foi arrancada do caderno</h1>
        <p className={styles.lead}>O endereço não existe, ou nunca existiu.</p>
        <ButtonLink to="/" variant="secondary">
          Voltar ao índice
        </ButtonLink>
      </div>
    </div>
  )
}
