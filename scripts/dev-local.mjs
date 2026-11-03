// npm run dev:local — sobe o Supabase local (banco em .local-db/) e o app apontando pra ele.
// Bom pra testar sem criar projeto na nuvem. Os dados ficam só nesta máquina.
import { createServer } from 'vite'
import { startLocalSupabase } from './local-supabase.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const api = await startLocalSupabase({ port: 54321, dataDir: join(ROOT, '.local-db') })
console.log(`Supabase local em ${api.url} (banco em .local-db/, apague a pasta pra zerar)`)

// mode "localdb" carrega o .env.localdb, que aponta o app pro Supabase local
const vite = await createServer({ root: ROOT, mode: 'localdb' })
await vite.listen()
vite.printUrls()
