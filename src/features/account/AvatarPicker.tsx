// Ficha · foto de perfil: a pedrinha com a foto (ou o raminho) é o próprio botão de trocar, com
// um "+" no canto. Abaixo, se tiver foto, "voltar pro raminho". Quem envia e apaga é o api.ts;
// quem garante que cada um só mexe na própria foto são as regras do Storage (migration
// 20261118120000_foto_de_perfil.sql).
import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { PlusIcon } from '../../components/icons/plus'
import { clearAvatar, setAvatar, type Profile } from '../../lib/api'
import { toast } from '../../lib/toast'
import { Avatar } from '../friends/Avatar'
import { AvatarCropper } from './AvatarCropper'
import { profileKey } from './queries'
import styles from './AccountScreen.module.css'

/** Foto do celular passa fácil de 10 MB; acima disso nem tenta abrir. */
const MAX_FILE = 30 * 1024 * 1024

export function AvatarPicker({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const done = async (next: Profile, message: string) => {
    queryClient.setQueryData(profileKey(profile.id), next)
    // amigos e ranking mostram a foto: busca de novo
    await queryClient.invalidateQueries({ queryKey: ['friends'] })
    toast.success(message)
  }

  const save = useMutation({
    mutationFn: (photo: Blob) => setAvatar(profile.id, photo, profile.avatar_path),
    onSuccess: async (next) => {
      setFile(null)
      await done(next, 'Foto salva')
    },
    onError: (error) => toast.error(`Não deu pra salvar a foto. ${error.message}`),
  })

  const clear = useMutation({
    mutationFn: () => clearAvatar(profile.id, profile.avatar_path),
    onSuccess: (next) => done(next, 'De volta ao raminho'),
    onError: (error) => toast.error(error.message),
  })

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = '' // escolher a mesma foto de novo também abre a telinha
    if (!picked) return
    if (!picked.type.startsWith('image/')) return toast.error('Escolha uma imagem (JPG, PNG ou WebP).')
    if (picked.size > MAX_FILE) return toast.error('Essa imagem é grande demais. Tente uma de até 30 MB.')
    setFile(picked)
  }

  const unreadable = useCallback(() => {
    setFile(null)
    toast.error('Não deu pra abrir essa imagem. Tente uma foto JPG ou PNG.')
  }, [])

  const hasPhoto = !!profile.avatar_path

  return (
    <div className={styles.photo}>
      <button
        type="button"
        className={styles.photoButton}
        onClick={() => input.current?.click()}
        disabled={save.isPending}
        aria-label={hasPhoto ? 'Trocar foto' : 'Escolher foto'}
        title={hasPhoto ? 'Trocar foto' : 'Escolher foto'}
      >
        <Avatar name={profile.username} seed={profile.id} photo={profile.avatar_path} size={120} me />
        <span className={styles.photoBadge} aria-hidden="true">
          <PlusIcon size={18} strokeWidth={2} />
        </span>
      </button>
      {hasPhoto && (
        <Button variant="quiet" size="sm" onClick={() => clear.mutate()} busy={clear.isPending}>
          voltar pro raminho
        </Button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={choose} />

      <Dialog open={!!file} title="Ajustar foto" onClose={() => !save.isPending && setFile(null)}>
        {file && (
          <AvatarCropper
            file={file}
            busy={save.isPending}
            onCancel={() => setFile(null)}
            onSave={(photo) => save.mutate(photo)}
            onUnreadable={unreadable}
          />
        )}
      </Dialog>
    </div>
  )
}
