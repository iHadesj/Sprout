// Criar conta. Username e fuso vão nos metadados; o trigger do banco cria o profile com eles.
// Antes de enviar: as duas senhas precisam bater e o nome precisa seguir a regra (a mesma do
// banco). Erro aqui vira a mensagem do form (com o balanço do card), não o balão do navegador.
import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizeUsername, USERNAME_HINT, usernameError } from '../account/username'
import { useAuthForm } from './authForm'
import { AuthField, AuthSubmit, FormMessage, SwitchLink } from './AuthFormParts'
import styles from './AuthForm.module.css'

export function SignupScreen() {
  const form = useAuthForm()
  const [confirm, setConfirm] = useState('')
  const [username, setUsername] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    form.submit(async () => {
      if (form.password !== confirm) throw new Error('As senhas não são iguais.')
      const nameProblem = usernameError(username)
      if (nameProblem) throw new Error(nameProblem)
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { username, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
      })
      if (error) throw error
      // projeto com confirmação de e-mail ligada: a conta existe, mas só entra depois de confirmar
      if (!data.session) return { kind: 'info', text: 'Conta criada! Confirme pelo link que enviamos pro seu e-mail.' }
      return { kind: 'signed-in' }
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label="Criar conta">
      <AuthField label="E-mail" type="email" autoComplete="email" required value={form.email} onValueChange={form.setEmail} />
      <AuthField label="Senha" type="password" autoComplete="new-password" minLength={6} required value={form.password} onValueChange={form.setPassword} />
      <AuthField label="Confirmar senha" type="password" autoComplete="new-password" minLength={6} required value={confirm} onValueChange={setConfirm} />
      <AuthField
        label="Nome de usuário (opcional)"
        autoComplete="username"
        hint={USERNAME_HINT}
        value={username}
        onValueChange={(value) => setUsername(normalizeUsername(value))}
      />
      <FormMessage />
      <AuthSubmit label="Criar conta" />
      <SwitchLink to="/entrar">já tem conta? entra</SwitchLink>
    </form>
  )
}
