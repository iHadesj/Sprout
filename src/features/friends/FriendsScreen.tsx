// Amigos: o quadro da semana (ranking por minutos de foco), pedidos, adicionar pelo nome,
// o link de convite e a lista de amigos (cada um com "visitar jardim").
// Os números vêm do servidor (friend_ranking); aqui só se desenha.
import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { CopyIcon } from '../../components/icons/copy'
import { SendIcon } from '../../components/icons/send'
import { UserPlusIcon } from '../../components/icons/user-plus'
import { Link } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import type { FriendEntry } from '../../lib/api'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useProfile } from '../account/queries'
import { formatMinutes } from '../stats/insights'
import { useFriends, useRanking, useRemoveFriend, useRespondFriendRequest, useSendFriendRequest } from './queries'
import styles from './FriendsScreen.module.css'

const at = (name: string | null) => (name ? `@${name}` : 'sem nome')

export function FriendsScreen() {
  const profile = useProfile()
  const friends = useFriends()
  const ranking = useRanking()
  const sendRequest = useSendFriendRequest()
  const respond = useRespondFriendRequest()
  const remove = useRemoveFriend()
  const [username, setUsername] = useState('')
  const [removing, setRemoving] = useState<FriendEntry | null>(null)

  const list = friends.data ?? []
  const incoming = list.filter((f) => f.direction === 'incoming')
  const outgoing = list.filter((f) => f.direction === 'outgoing')
  const accepted = list.filter((f) => f.direction === 'friend')
  const top = Math.max(1, ...(ranking.data ?? []).map((r) => r.minutes))
  const inviteUrl = profile.data ? `${window.location.origin}/amigo/${profile.data.invite_code}` : ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const name = username.trim().replace(/^@/, '')
    if (!name) return
    sendRequest.mutate(name, {
      onSuccess: (result) => {
        setUsername('')
        if (result === 'accepted') toast.success(`Agora você e @${name} são amigos`)
        else if (result === 'already') toast.success(`Você e @${name} já estão conectados`)
        else toast.success(`Pedido enviado pra @${name}`)
      },
      onError: (error) => toast.error(error.message),
    })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Link copiado')
    } catch {
      toast.error('Não deu pra copiar: selecione o link e copie')
    }
  }

  const share = () => {
    navigator.share?.({ title: 'Sprout', text: 'Bora focar junto no Sprout?', url: inviteUrl }).catch(() => {})
  }

  return (
    <motion.div className={styles.page} variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.header className={styles.header} variants={fadeUp}>
        <p className="kicker">Amigos</p>
        <h1>Quadro da semana</h1>
        <p className={styles.lead}>Minutos de foco desde segunda. Conta só sessão concluída, até 10 por dia.</p>
      </motion.header>

      <motion.ol className={styles.ranking} variants={fadeUp} aria-label="Ranking da semana">
        {(ranking.data ?? []).map((row, i) => {
          const content = (
            <>
              <span className={`mono ${styles.position}`}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.who}>
                {at(row.username)}
                {row.is_me && <span className={styles.me}>você</span>}
              </span>
              <span className={styles.bar} aria-hidden="true">
                <motion.span
                  className={styles.barFill}
                  data-me={row.is_me || undefined}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: row.minutes / top }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                />
              </span>
              <span className={`mono ${styles.minutes}`}>{formatMinutes(row.minutes)}</span>
            </>
          )
          return (
            <li key={row.user_id}>
              {row.is_me ? (
                <div className={styles.row}>{content}</div>
              ) : (
                <Link to={`/amigos/${row.user_id}`} className={styles.row}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </motion.ol>
      {ranking.isSuccess && ranking.data.length <= 1 && (
        <motion.p className={styles.empty} variants={fadeUp}>
          Por enquanto o quadro é só seu. Mande o link de convite pra alguém focar junto.
        </motion.p>
      )}

      {incoming.length > 0 && (
        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="pedidos">
          <h2 id="pedidos" className="kicker">
            Pedidos de amizade
          </h2>
          <ul className={styles.people}>
            {incoming.map((f) => (
              <li key={f.user_id} className={styles.person}>
                <span className={styles.name}>{at(f.username)}</span>
                <span className={styles.actions}>
                  <Button size="sm" busy={respond.isPending} onClick={() => respond.mutate({ userId: f.user_id, accept: true })}>
                    Aceitar
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => respond.mutate({ userId: f.user_id, accept: false })}>
                    Recusar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <div className={styles.columns}>
        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="adicionar">
          <h2 id="adicionar" className="kicker">
            Adicionar pelo nome
          </h2>
          <form className={styles.add} onSubmit={submit}>
            <input
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nome de usuário"
              aria-label="Nome de usuário do amigo"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button type="submit" variant="secondary" busy={sendRequest.isPending} icon={<UserPlusIcon size={16} strokeWidth={1.7} />}>
              Mandar pedido
            </Button>
          </form>
          {outgoing.length > 0 && (
            <ul className={styles.pending}>
              {outgoing.map((f) => (
                <li key={f.user_id}>
                  Pedido enviado pra {at(f.username)} ·{' '}
                  <button type="button" className={styles.linkButton} onClick={() => remove.mutate(f.user_id)}>
                    cancelar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="convite">
          <h2 id="convite" className="kicker">
            Seu link de convite
          </h2>
          <p className={`mono ${styles.invite}`}>{inviteUrl || '…'}</p>
          <div className={styles.actions}>
            <Button size="sm" variant="secondary" icon={<CopyIcon size={15} strokeWidth={1.7} />} onClick={copy} disabled={!inviteUrl}>
              Copiar link
            </Button>
            {'share' in navigator && (
              <Button size="sm" variant="quiet" icon={<SendIcon size={15} strokeWidth={1.7} />} onClick={share} disabled={!inviteUrl}>
                Compartilhar
              </Button>
            )}
          </div>
          <p className={styles.hint}>Quem abrir o link e aceitar vira seu amigo na hora.</p>
        </motion.section>
      </div>

      {accepted.length > 0 && (
        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="lista">
          <h2 id="lista" className="kicker">
            Seus amigos
          </h2>
          <ul className={styles.people}>
            {accepted.map((f) => (
              <li key={f.user_id} className={styles.person}>
                <span className={styles.name}>{at(f.username)}</span>
                <span className={styles.actions}>
                  <ButtonLink to={`/amigos/${f.user_id}`} size="sm" variant="secondary">
                    Visitar jardim
                  </ButtonLink>
                  <Button size="sm" variant="quiet" onClick={() => setRemoving(f)}>
                    Desfazer
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <Dialog open={!!removing} title="Desfazer amizade?" onClose={() => setRemoving(null)}>
        <p className={styles.dialogText}>
          Vocês saem do quadro um do outro e param de ver os jardins. Dá pra virar amigo de novo depois.
        </p>
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            busy={remove.isPending}
            onClick={() =>
              removing &&
              remove.mutate(removing.user_id, {
                onSuccess: () => setRemoving(null),
              })
            }
          >
            Desfazer amizade
          </Button>
        </div>
      </Dialog>
    </motion.div>
  )
}
