// Criar conta. Username e fuso vão nos metadados; o trigger do banco cria o profile com eles.
import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthForm } from './authForm'
import { AuthField, AuthSubmit, FormMessage, SwitchLink } from './AuthFormParts'
import styles from './AuthForm.module.css'

export function SignupScreen() {
  const form = useAuthForm()
  const [username, setUsername] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    form.submit(async () => {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { username: username.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
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
      <AuthField
        label="Nome de usuário (opcional)"
        autoComplete="username"
        pattern="[a-zA-Z0-9_]{3,24}"
        title="De 3 a 24 letras, números ou _"
        value={username}
        onValueChange={setUsername}
      />
      <FormMessage />
      <AuthSubmit label="Criar conta" />
      <SwitchLink to="/entrar">já tem conta? entra</SwitchLink>
    </form>
  )
}
