// Amigos, sem tabela nem caixas:
// - o quadro da semana: uma lista curva, cada pessoa com avatar e um traço do tamanho dos minutos;
// - pedidos e seus amigos: um cacho de avatares (pedrinhas coloridas) com nome, minutos da
//   semana e "Visitar jardim";
// - depois de uma onda: adicionar pelo nome, o link de convite em cápsula e as conquistas.
// Os números vêm do servidor (friend_ranking); aqui só se desenha.
import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { CopyIcon } from '../../components/icons/copy'
import { SendIcon } from '../../components/icons/send'
import { UserPlusIcon } from '../../components/icons/user-plus'
import { Link } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { bulge } from '../../components/organic/curve'
import { Wave } from '../../components/organic/Wave'
import type { FriendEntry } from '../../lib/api'
import { fadeUp, hoverTilt, popIn, spring, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useProfile } from '../account/queries'
import { formatMinutes } from '../stats/insights'
import { Avatar } from './Avatar'
import { Mural } from './Mural'
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
  const rows = ranking.data ?? []
  const top = Math.max(1, ...rows.map((r) => r.minutes))
  const weekOf = (id: string) => rows.find((r) => r.user_id === id)?.minutes ?? 0
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
    <motion.div className={styles.page} variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.header className={styles.header} variants={fadeUp}>
        <h1>Amigos</h1>
      </motion.header>

      <motion.section className={styles.section} variants={fadeUp} aria-labelledby="semana">
        <div className={styles.sectionHead}>
          <h2 id="semana">Esta semana</h2>
          <p className={styles.lead}>minutos de foco desde segunda</p>
        </div>
        <ol className={styles.ranking} aria-label="Ranking da semana">
          {rows.map((row, i) => {
            const content = (
              <>
                <span className={`mono ${styles.position}`}>{i + 1}</span>
                <Avatar name={row.username} size={i === 0 ? 52 : 42} me={row.is_me} />
                <span className={styles.who}>
                  {at(row.username)}
                  {row.is_me && <span className={styles.me}>você</span>}
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <motion.span
                    className={styles.barFill}
                    data-me={row.is_me || undefined}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.max(0.03, row.minutes / top) }}
                    transition={{ ...spring.soft, delay: 0.25 + i * 0.07 }}
                  />
                </span>
                <span className={`mono ${styles.minutes}`}>{formatMinutes(row.minutes)}</span>
              </>
            )
            // a lista faz uma curva: o recuo cresce até o meio e volta
            const indent = { marginInlineStart: bulge(i, rows.length, 48) }
            return (
              <li key={row.user_id} style={indent}>
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
        </ol>
        {ranking.isSuccess && rows.length <= 1 && (
          <p className={styles.empty}>Por enquanto o quadro é só seu. Mande o link de convite pra alguém focar junto.</p>
        )}
      </motion.section>

      {incoming.length > 0 && (
        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="pedidos">
          <h2 id="pedidos">Pedidos de amizade</h2>
          <motion.ul className={styles.people} variants={stagger(0.07)}>
            {incoming.map((f, i) => (
              <motion.li key={f.user_id} className={styles.person} variants={popIn} data-i={i % 3}>
                <Avatar name={f.username} size={64} />
                <span className={styles.name}>{at(f.username)}</span>
                <span className={styles.personActions}>
                  <Button size="sm" busy={respond.isPending} onClick={() => respond.mutate({ userId: f.user_id, accept: true })}>
                    Aceitar
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => respond.mutate({ userId: f.user_id, accept: false })}>
                    Recusar
                  </Button>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.section>
      )}

      {accepted.length > 0 && (
        <motion.section className={styles.section} variants={fadeUp} aria-labelledby="lista">
          <h2 id="lista">Seus amigos</h2>
          <motion.ul className={styles.people} variants={stagger(0.07)}>
            {accepted.map((f, i) => (
              <motion.li key={f.user_id} className={styles.person} variants={popIn} data-i={i % 3}>
                {/* o avatar também abre o jardim (fora do Tab: o link de texto embaixo é o mesmo) */}
                <motion.span whileHover={hoverTilt(i)} className={styles.avatarLink}>
                  <Link to={`/amigos/${f.user_id}`} tabIndex={-1} aria-hidden="true">
                    <Avatar name={f.username} size={76} />
                  </Link>
                </motion.span>
                <span className={styles.name}>{at(f.username)}</span>
                <span className={`mono ${styles.week}`}>{formatMinutes(weekOf(f.user_id))} esta semana</span>
                <span className={styles.personActions}>
                  <ButtonLink to={`/amigos/${f.user_id}`} size="sm" variant="secondary">
                    Visitar jardim
                  </ButtonLink>
                  <button type="button" className={styles.linkButton} onClick={() => setRemoving(f)}>
                    desfazer
                  </button>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.section>
      )}

      <Wave className={styles.wave} variant={1} />

      <div className={styles.columns}>
        <motion.section className={`${styles.section} ${styles.addCol}`} variants={fadeUp} aria-labelledby="adicionar">
          <h2 id="adicionar">Adicionar pelo nome</h2>
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

        <motion.section className={`${styles.section} ${styles.inviteCol}`} variants={fadeUp} aria-labelledby="convite">
          <h2 id="convite">Seu link de convite</h2>
          <div className={styles.invite}>
            <span className={`mono ${styles.inviteUrl}`}>{inviteUrl || '…'}</span>
            <Button size="sm" icon={<CopyIcon size={15} strokeWidth={1.7} />} onClick={copy} disabled={!inviteUrl}>
              Copiar link
            </Button>
          </div>
          {'share' in navigator && (
            <div>
              <Button size="sm" variant="quiet" icon={<SendIcon size={15} strokeWidth={1.7} />} onClick={share} disabled={!inviteUrl}>
                Compartilhar
              </Button>
            </div>
          )}
        </motion.section>
      </div>

      <motion.section className={styles.section} variants={fadeUp} aria-labelledby="conquistas">
        <h2 id="conquistas">Conquistas</h2>
        <Mural limit={12} emptyText="Quando você ou um amigo deixar uma árvore adulta ou bater um marco de dias seguidos, aparece aqui." />
      </motion.section>


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
