// Entrar com e-mail e senha (Supabase Auth). A moldura (cena, card, sucesso/erro) é do AuthLayout.
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthForm } from './authForm'
import { AuthField, AuthSubmit, FormMessage, SwitchLink } from './AuthFormParts'
import styles from './AuthForm.module.css'

export function LoginScreen() {
  const form = useAuthForm()

  function submit(event: FormEvent) {
    event.preventDefault()
    form.submit(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
      if (error) throw error
      return { kind: 'signed-in' }
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label="Entrar">
      <AuthField label="E-mail" type="email" autoComplete="email" required value={form.email} onValueChange={form.setEmail} />
      <AuthField label="Senha" type="password" autoComplete="current-password" required value={form.password} onValueChange={form.setPassword} />
      <FormMessage />
      <AuthSubmit label="Entrar" />
      <SwitchLink to="/criar-conta">não tem conta? cria uma</SwitchLink>
    </form>
  )
}
