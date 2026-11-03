// Funções tipadas que conversam com o Supabase. As telas usam estas funções, nunca o
// supabase direto: nomes de tabela e de RPC ficam num lugar só.
// Repare que nada aqui calcula recompensa: o front pede, o banco decide.
import type { Database, Tables, TablesInsert, TablesUpdate, Views } from './database.types'
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'
import type { DistractionTag, FocusRating } from '../features/focus/labels'

export type Garden = Tables<'gardens'>
export type GardenInput = Pick<TablesInsert<'gardens'>, 'name' | 'color' | 'biome' | 'focus_minutes' | 'break_minutes'>
export type Plant = Tables<'plants'>
export type FocusSession = Tables<'sessions'>
export type Profile = Tables<'profiles'>
export type RatingResult = Database['public']['CompositeTypes']['rating_result']
export type GardenStats = Views<'garden_stats'>
export type FocusDay = Views<'focus_days'>
export type UserStreak = Views<'user_streaks'>
export type DistractionStat = Views<'distraction_stats'>
type Fn<F extends keyof Database['public']['Functions']> = Database['public']['Functions'][F]['Returns']
export type FriendEntry = Fn<'list_friends'>[number]
export type RankingEntry = Fn<'friend_ranking'>[number]
export type UnseenGift = Fn<'unseen_gifts'>[number]
export type GiftKind = 'water' | 'heart' | 'seed'
export type GardenFlower = Fn<'garden_flowers'>[number]
export type FeedEvent = Fn<'friend_feed'>[number]
export type NudgeReply = Fn<'nudge_replies'>[number]

/** Motivos que o navegador pode relatar ao falhar uma sessão. */
export type ReportedFailReason = 'gave_up' | 'page_closed'

/** Erro do Supabase com o código (ex.: SP002) pra tela decidir o que mostrar. */
export class ApiError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (error) throw new ApiError(error.message, error.code)
  return data as T
}

// ---------- jardins ----------

export async function listGardens(): Promise<Garden[]> {
  return unwrap(await supabase.from('gardens').select('*').is('archived_at', null).order('created_at'))
}

export async function getGarden(id: string): Promise<Garden> {
  return unwrap(await supabase.from('gardens').select('*').eq('id', id).single())
}

export async function createGarden(input: GardenInput): Promise<Garden> {
  return unwrap(await supabase.from('gardens').insert(input).select().single())
}

export async function updateGarden(id: string, patch: TablesUpdate<'gardens'>): Promise<Garden> {
  return unwrap(await supabase.from('gardens').update(patch).eq('id', id).select().single())
}

export async function archiveGarden(id: string): Promise<Garden> {
  return updateGarden(id, { archived_at: new Date().toISOString() })
}

// ---------- plantas e sessões (só leitura: escrever é com as RPCs) ----------

/** Plantas de um jardim, ou de todos os jardins do usuário. */
export async function listPlants(gardenId?: string): Promise<Plant[]> {
  let query = supabase.from('plants').select('*').order('planted_at')
  if (gardenId) query = query.eq('garden_id', gardenId)
  return unwrap(await query)
}

export async function getActiveSession(): Promise<FocusSession | null> {
  return unwrap(await supabase.from('sessions').select('*').eq('status', 'active').maybeSingle())
}

/** Sessão concluída nas últimas 24 h que ficou sem resposta (a aba fechou na revisão). */
export async function getPendingReview(gardenId: string): Promise<FocusSession | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return unwrap(
    await supabase
      .from('sessions')
      .select('*')
      .eq('garden_id', gardenId)
      .eq('status', 'completed')
      .is('focus_rating', null)
      .gte('ended_at', since)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

/** Sessões encerradas de um jardim, da mais nova pra mais velha. */
export async function listSessions(gardenId?: string, limit = 200): Promise<FocusSession[]> {
  let query = supabase.from('sessions').select('*').neq('status', 'active').order('ended_at', { ascending: false }).limit(limit)
  if (gardenId) query = query.eq('garden_id', gardenId)
  return unwrap(await query)
}

// ---------- RPCs do ciclo da sessão ----------

export async function startSession(gardenId: string): Promise<FocusSession> {
  return unwrap(await supabase.rpc('start_session', { p_garden_id: gardenId }))
}

/** false = a sessão não está mais ativa no servidor. */
export async function sendHeartbeat(sessionId: string): Promise<boolean> {
  return unwrap(await supabase.rpc('session_heartbeat', { p_session_id: sessionId }))
}

/** `p_exits` ficou no banco por compatibilidade; sair da aba não conta mais, então vai 0. */
export async function finishSession(sessionId: string): Promise<FocusSession> {
  return unwrap(await supabase.rpc('finish_session', { p_session_id: sessionId, p_exits: 0 }))
}

export async function rateSession(
  sessionId: string,
  rating: FocusRating,
  distraction: DistractionTag | null,
): Promise<RatingResult> {
  return unwrap(
    await supabase.rpc('rate_session', {
      p_session_id: sessionId,
      p_focus_rating: rating,
      p_distraction: distraction,
    }),
  )
}

export async function failSession(sessionId: string, reason: ReportedFailReason): Promise<void> {
  unwrap(await supabase.rpc('fail_session', { p_session_id: sessionId, p_reason: reason }))
}

export async function invalidateSession(sessionId: string): Promise<void> {
  unwrap(await supabase.rpc('invalidate_session', { p_session_id: sessionId }))
}

export async function expireStaleSessions(): Promise<number> {
  return unwrap(await supabase.rpc('expire_stale_sessions'))
}

/**
 * Avisa o servidor que a aba fechou no meio do foco. `fetch` com keepalive termina de
 * enviar mesmo com a página fechando e, ao contrário do sendBeacon, manda os headers
 * que o Supabase exige. Se não chegar, o servidor abandona a sessão sozinho em 90 s.
 */
export function failSessionOnPageClose(sessionId: string, accessToken: string): void {
  void fetch(`${SUPABASE_URL}/rest/v1/rpc/fail_session`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_session_id: sessionId, p_reason: 'page_closed' }),
  }).catch(() => {})
}

// ---------- estatísticas (views no banco; o front só desenha) ----------

export async function listGardenStats(): Promise<GardenStats[]> {
  return unwrap(await supabase.from('garden_stats').select('*'))
}

/** Dias com foco a partir de `since` (AAAA-MM-DD, no fuso do usuário). */
export async function listFocusDays(since: string): Promise<FocusDay[]> {
  return unwrap(await supabase.from('focus_days').select('*').gte('day', since).order('day'))
}

export async function getStreaks(): Promise<UserStreak | null> {
  return unwrap(await supabase.from('user_streaks').select('*').maybeSingle())
}

export async function listDistractions(): Promise<DistractionStat[]> {
  return unwrap(await supabase.from('distraction_stats').select('*'))
}

// ---------- perfil ----------

export async function getProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single())
}

export async function updateProfile(userId: string, patch: TablesUpdate<'profiles'>): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select().single())
}

// ---------- amigos (tudo por funções do servidor, que conferem a amizade) ----------

export async function listFriends(): Promise<FriendEntry[]> {
  return unwrap(await supabase.rpc('list_friends'))
}

/** 'requested' (pedido enviado), 'accepted' (o outro já tinha pedido) ou 'already'. */
export async function sendFriendRequest(username: string): Promise<string> {
  return unwrap(await supabase.rpc('send_friend_request', { p_username: username }))
}

export async function respondFriendRequest(userId: string, accept: boolean): Promise<void> {
  unwrap(await supabase.rpc('respond_friend_request', { p_user: userId, p_accept: accept }))
}

export async function removeFriend(userId: string): Promise<void> {
  unwrap(await supabase.rpc('remove_friend', { p_user: userId }))
}

/** Nome de quem mandou o convite. */
export async function inviteInfo(code: string): Promise<string> {
  return unwrap(await supabase.rpc('invite_info', { p_code: code }))
}

export async function joinByInvite(code: string): Promise<string> {
  return unwrap(await supabase.rpc('join_by_invite', { p_code: code }))
}

export async function friendRanking(): Promise<RankingEntry[]> {
  return unwrap(await supabase.rpc('friend_ranking'))
}

export async function friendGardens(userId: string): Promise<Garden[]> {
  return unwrap(await supabase.rpc('friend_gardens', { p_user: userId }))
}

export async function friendPlants(userId: string): Promise<Plant[]> {
  return unwrap(await supabase.rpc('friend_plants', { p_user: userId }))
}

export async function sendGift(to: string, kind: GiftKind, amount = 1): Promise<void> {
  unwrap(await supabase.rpc('send_gift', { p_to: to, p_kind: kind, p_amount: amount }))
}

/** Quando foi o último presente desse tipo que eu mandei pra esse amigo (null = nunca). */
export async function lastGiftTo(userId: string, kind: GiftKind): Promise<string | null> {
  const rows = unwrap(
    await supabase.from('gifts').select('created_at').eq('to_id', userId).eq('kind', kind).order('created_at', { ascending: false }).limit(1),
  )
  return rows[0]?.created_at ?? null
}

/** Quando eu plantei a última flor pra esse amigo (em qualquer jardim dele). */
export async function lastFlowerFor(gardenIds: string[]): Promise<string | null> {
  if (gardenIds.length === 0) return null
  const rows = unwrap(
    await supabase.from('flowers').select('planted_at').in('garden_id', gardenIds).order('planted_at', { ascending: false }).limit(1),
  )
  return rows[0]?.planted_at ?? null
}

export async function unseenGifts(): Promise<UnseenGift[]> {
  return unwrap(await supabase.rpc('unseen_gifts'))
}

export async function markGiftsSeen(): Promise<number> {
  return unwrap(await supabase.rpc('mark_gifts_seen'))
}

// ---------- flores, mural e chamados ----------

/** Planta uma flor num jardim de amigo (o servidor escolhe o lugar e confere o limite semanal). */
export async function plantFlower(gardenId: string, color: string): Promise<Tables<'flowers'>> {
  return unwrap(await supabase.rpc('plant_flower', { p_garden: gardenId, p_color: color }))
}

export async function gardenFlowers(gardenId: string): Promise<GardenFlower[]> {
  return unwrap(await supabase.rpc('garden_flowers', { p_garden: gardenId }))
}

export async function friendFeed(): Promise<FeedEvent[]> {
  return unwrap(await supabase.rpc('friend_feed'))
}

/** true = aplauso novo; false = você já tinha aplaudido essa conquista. */
export async function clapEvent(to: string, eventKey: string): Promise<boolean> {
  return unwrap(await supabase.rpc('clap', { p_to: to, p_event_key: eventKey }))
}

export async function nudgeReplies(): Promise<NudgeReply[]> {
  return unwrap(await supabase.rpc('nudge_replies'))
}

export async function markNudgeRepliesSeen(): Promise<number> {
  return unwrap(await supabase.rpc('mark_nudge_replies_seen'))
}
