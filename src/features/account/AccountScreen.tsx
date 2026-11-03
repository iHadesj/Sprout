// Ficha (conta): o @ grande, os registros soltos (e-mail, desde quando), o perfil (nome de
// usuário, que é como os amigos te acham, e fuso, que define o "hoje" do limite diário) e,
// discreto no fim, sair.
import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogoutIcon } from '../../components/icons/logout'
import { Button } from '../../components/Button'
import { updateProfile } from '../../lib/api'
import { fadeUp, stagger } from '../../lib/motion'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { useFocusStore } from '../../stores/focusStore'
import { useAuth } from '../auth/authContext'
import { profileKey, useProfile } from './queries'
import { normalizeUsername, USERNAME_HINT, usernameError } from './username'
import styles from './AccountScreen.module.css'

const TIMEZONES = Intl.supportedValuesOf('timeZone')

export function AccountScreen() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const profile = useProfile()

  return (
    <motion.div className={styles.page} variants={stagger(0.08)} initial="hidden" animate="show">
      <motion.header className={styles.header} variants={fadeUp}>
        <h1>{profile.data?.username ? `@${profile.data.username}` : 'Sua ficha'}</h1>
      </motion.header>

      <motion.dl className={styles.records} variants={fadeUp}>
        <div>
          <dt>E-mail</dt>
          <dd>{user?.email}</dd>
        </div>
        {profile.data && (
          <div>
            <dt>No caderno desde</dt>
            <dd>{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.data.created_at))}</dd>
          </div>
        )}
      </motion.dl>

      {profile.data && (
        <ProfileForm key={profile.data.id} userId={userId} username={profile.data.username} timezone={profile.data.timezone} />
      )}

      <motion.div variants={fadeUp}>
        <Button
          variant="quiet"
          icon={<LogoutIcon size={16} strokeWidth={1.7} />}
          onClick={async () => {
            useFocusStore.getState().reset()
            await supabase.auth.signOut()
          }}
        >
          Sair da conta
        </Button>
      </motion.div>
    </motion.div>
  )
}

function ProfileForm(props: { userId: string; username: string | null; timezone: string }) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(props.username ?? '')
  const [timezone, setTimezone] = useState(props.timezone)
  const save = useMutation({
    mutationFn: () => {
      const problem = usernameError(username)
      if (problem) return Promise.reject(new Error(problem))
      return updateProfile(props.userId, { username: username || null, timezone })
    },
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKey(props.userId), profile)
      toast.success('Perfil salvo')
      await queryClient.invalidateQueries({ queryKey: ['stats'] }) // o "hoje" depende do fuso
    },
    onError: (error) =>
      toast.error(
        error.message.includes('profiles_username_key')
          ? 'Esse nome de usuário já existe.'
          : error.message.includes('username_format')
            ? `Nome de usuário inválido. ${USERNAME_HINT}`
            : error.message,
      ),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <motion.section className={styles.section} variants={fadeUp} aria-labelledby="perfil">
      <h2 id="perfil">Perfil</h2>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Nome de usuário</span>
          <input
            className="field-input"
            value={username}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
          />
          <small>É por ele que seus amigos te acham. {USERNAME_HINT}</small>
        </label>
        <label>
          <span>Fuso horário</span>
          <select className="field-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Button type="submit" busy={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </motion.section>
  )
}
