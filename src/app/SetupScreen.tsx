// Aparece quando faltam as variáveis do Supabase, em vez do app quebrar sem explicar.
import { motion } from 'motion/react'
import { IslandIcon } from '../features/gardens/IslandIcon'
import { fadeUp, stagger } from '../lib/motion'
import styles from './SetupScreen.module.css'

export function SetupScreen() {
  return (
    <motion.main className={styles.page} variants={stagger(0.08)} initial="hidden" animate="show">
      <motion.div className={styles.art} variants={fadeUp}>
        <IslandIcon color="#f08fb0" biome="campo" />
      </motion.div>
      <motion.p className="kicker" variants={fadeUp}>
        Configuração
      </motion.p>
      <motion.h1 variants={fadeUp}>
        Falta configurar o <em>Supabase</em>
      </motion.h1>
      <motion.p variants={fadeUp}>
        Crie um arquivo <code>.env.local</code> na raiz do projeto (copie o <code>.env.example</code>) com a URL e a chave
        publicável do seu projeto, e reinicie o <code>npm run dev</code>.
      </motion.p>
      <motion.p className={styles.note} variants={fadeUp}>
        Pra testar sem conta no Supabase, rode <code>npm run dev:local</code>: ele sobe um banco Postgres local com as
        mesmas migrations.
      </motion.p>
    </motion.main>
  )
}
