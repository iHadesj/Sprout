// Página do link de convite (/amigo/<código>). Sem login, o RequireAuth manda pra entrar ou
// criar conta e depois volta pra cá. Aceitar vira amizade na hora (o link já é o pedido).
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { inviteInfo } from '../../lib/api'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useProfile } from '../account/queries'
import { useJoinByInvite } from './queries'
import styles from './InviteScreen.module.css'

export function InviteScreen() {
  const { code = '' } = useParams()
  const profile = useProfile()
  const owner = useQuery({ queryKey: ['invite', code], queryFn: () => inviteInfo(code), retry: false })
  const join = useJoinByInvite()
  const navigate = useNavigate()
  const mine = profile.data?.invite_code === code

  const accept = () =>
    join.mutate(code, {
      onSuccess: (name) => {
        toast.success(`Agora você e @${name} são amigos`)
        navigate('/amigos')
      },
      onError: (error) => toast.error(error.message),
    })

  return (
    <motion.section className={styles.page} variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.p className="kicker" variants={fadeUp}>
        Convite
      </motion.p>
      {owner.isPending && <p className={styles.muted}>Abrindo o convite…</p>}
      {owner.isError && (
        <motion.div className={styles.body} variants={fadeUp}>
          <h1>Esse convite não existe</h1>
          <p className={styles.lead}>Confira o link com quem mandou.</p>
          <ButtonLink to="/" variant="secondary">
            Ir pro índice
          </ButtonLink>
        </motion.div>
      )}
      {owner.isSuccess && mine && (
        <motion.div className={styles.body} variants={fadeUp}>
          <h1>Esse é o seu link</h1>
          <p className={styles.lead}>Mande pra um amigo: quem abrir e aceitar entra no seu quadro da semana.</p>
          <ButtonLink to="/amigos" variant="secondary">
            Ver amigos
          </ButtonLink>
        </motion.div>
      )}
      {owner.isSuccess && !mine && (
        <motion.div className={styles.body} variants={fadeUp}>
          <h1>@{owner.data} te chamou pro Sprout</h1>
          <p className={styles.lead}>
            Aceitando, vocês aparecem no quadro da semana um do outro e podem visitar os jardins, regar e mandar corações.
          </p>
          <Button size="lg" busy={join.isPending} onClick={accept}>
            Aceitar convite
          </Button>
        </motion.div>
      )}
    </motion.section>
  )
}
