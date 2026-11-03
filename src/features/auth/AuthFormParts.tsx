// Peças dos forms de login e cadastro: campo com label que sobe (senha com o olho pra
// mostrar), botão com os três pontinhos, mensagem de erro e o link pra trocar de tela.
// As animações vêm do loginVariants.
import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { EyeIcon } from '../../components/icons/eye'
import { EyeOffIcon } from '../../components/icons/eye-off'
import { useAuthForm } from './authForm'
import {
  button,
  buttonContent,
  dotsVariants,
  dotVariants,
  fieldBorder,
  itemVariants,
  labelLayout,
  messageVariants,
} from './motion/loginVariants'
import styles from './AuthForm.module.css'

interface AuthFieldProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  type?: 'email' | 'password' | 'text'
  autoComplete: string
  required?: boolean
  minLength?: number
  /** linha pequena embaixo do campo (ex.: a regra do nome de usuário) */
  hint?: string
}

/** Campo com borda inteira. A label fica dentro do campo vazio e sobe (encolhendo) no foco. */
export function AuthField({ label, value, onValueChange, type = 'text', hint, ...input }: AuthFieldProps) {
  const id = useId()
  const hintId = useId()
  const [focused, setFocused] = useState(false)
  // senha: o olho alterna entre esconder (password) e mostrar (text)
  const [shown, setShown] = useState(false)
  const secret = type === 'password'
  return (
    <motion.div className={styles.field} variants={itemVariants} data-raised={focused || value !== ''} data-focused={focused} data-secret={secret || undefined}>
      <motion.input
        id={id}
        type={secret && shown ? 'text' : type}
        aria-describedby={hint ? hintId : undefined}
        className={styles.input}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        variants={fieldBorder}
        initial={false}
        animate={focused ? 'focus' : 'rest'}
        {...input}
      />
      {/* layout: a troca de posição e tamanho (via CSS) vira animação, sem pulo */}
      <motion.label layout transition={labelLayout} htmlFor={id} className={styles.label}>
        {label}
      </motion.label>
      {secret && (
        <button
          type="button"
          className={styles.reveal}
          aria-label={shown ? 'Esconder senha' : 'Mostrar senha'}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </motion.div>
  )
}

/** Botão de enviar. Enviando, o texto vira três pontinhos no mesmo lugar (a largura não muda). */
export function AuthSubmit({ label }: { label: string }) {
  const { busy } = useAuthForm()
  return (
    <motion.button
      type="submit"
      className={styles.submit}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      variants={itemVariants}
      style={button.rest}
      whileHover={busy ? undefined : button.hover}
      whileTap={busy ? undefined : button.tap}
    >
      <AnimatePresence initial={false}>
        {busy ? (
          <motion.span key="dots" className={styles.dots} variants={dotsVariants} initial="hidden" animate="show" exit="exit" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className={styles.dot} variants={dotVariants} />
            ))}
          </motion.span>
        ) : (
          <motion.span key="label" variants={buttonContent} initial="hidden" animate="show" exit="exit">
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/**
 * Erro ou aviso do envio. A região aria-live existe sempre (vazia), pra o leitor de tela
 * anunciar quando a mensagem aparecer.
 */
export function FormMessage() {
  const { message } = useAuthForm()
  return (
    <div className={styles.messageSlot} aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false}>
        {message && (
          <motion.div key={message.kind} className={styles.message} variants={messageVariants} initial="hidden" animate="show" exit="hidden">
            <p className={message.kind === 'error' ? styles.error : styles.info}>{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const MotionLink = motion.create(Link)

/** Link discreto entre login e cadastro (leva junto o "pra onde ia"). */
export function SwitchLink({ to, children }: { to: string; children: ReactNode }) {
  const { busy, linkState } = useAuthForm()
  return (
    <MotionLink
      to={to}
      state={linkState}
      className={styles.switch}
      variants={itemVariants}
      aria-disabled={busy || undefined}
      onClick={(event) => busy && event.preventDefault()}
    >
      {children}
    </MotionLink>
  )
}
