// Tipos do banco no mesmo formato do `supabase gen types typescript`.
// Escrito a partir das migrations. Com um projeto Supabase ligado, dá pra regenerar:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type SessionRow = {
  distraction_tag: string | null
  ended_at: string | null
  exits_count: number
  fail_reason: string | null
  focus_rating: string | null
  garden_id: string
  growth_points: number | null
  id: string
  last_heartbeat_at: string
  plant_id: string
  planned_minutes: number
  started_at: string
  status: string
  user_id: string
}

/** RPC que devolve uma linha de sessions. */
type ReturnsSession = {
  Returns: SessionRow
  SetofOptions: { from: '*'; to: 'sessions'; isOneToOne: true; isSetofReturn: false }
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13'
  }
  public: {
    Tables: {
      gardens: {
        Row: {
          archived_at: string | null
          biome: string
          break_minutes: number
          color: string
          created_at: string
          focus_minutes: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          biome?: string
          break_minutes?: number
          color?: string
          created_at?: string
          focus_minutes?: number
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          biome?: string
          break_minutes?: number
          color?: string
          created_at?: string
          focus_minutes?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      plants: {
        Row: {
          ended_at: string | null
          garden_id: string
          growth: number
          id: string
          planted_at: string
          position_x: number
          position_z: number
          species: string
          status: string
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'plants_garden_id_fkey'
            columns: ['garden_id']
            isOneToOne: false
            referencedRelation: 'gardens'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          requester_id: string
          status: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      gifts: {
        Row: {
          amount: number
          created_at: string
          from_id: string
          id: string
          kind: string
          note: string | null
          reply_seen_at: string | null
          seen_at: string | null
          to_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      flowers: {
        Row: {
          color: string
          from_id: string
          garden_id: string
          id: string
          planted_at: string
          position_x: number
          position_z: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      claps: {
        Row: { created_at: string; event_key: string; from_id: string; to_id: string }
        Insert: never
        Update: never
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          timezone: string
          username: string | null
        }
        Insert: never
        Update: {
          timezone?: string
          username?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: SessionRow
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'sessions_garden_id_fkey'
            columns: ['garden_id']
            isOneToOne: false
            referencedRelation: 'gardens'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_plant_id_fkey'
            columns: ['plant_id']
            isOneToOne: false
            referencedRelation: 'plants'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      distraction_stats: {
        Row: { count: number | null; hour: number | null; tag: string | null; user_id: string | null }
        Relationships: []
      }
      focus_days: {
        Row: { day: string | null; minutes: number | null; sessions: number | null; user_id: string | null }
        Relationships: []
      }
      garden_stats: {
        Row: {
          completed: number | null
          failed: number | null
          garden_id: string | null
          honest_nos: number | null
          invalid: number | null
          last_completed_at: string | null
          minutes: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_streaks: {
        Row: { best_streak: number | null; current_streak: number | null; user_id: string | null }
        Relationships: []
      }
    }
    Functions: {
      expire_stale_sessions: { Args: never; Returns: number }
      fail_session: { Args: { p_reason: string; p_session_id: string }; Returns: undefined }
      finish_session: { Args: { p_exits: number; p_session_id: string } } & ReturnsSession
      invalidate_session: { Args: { p_session_id: string }; Returns: undefined }
      rate_session: {
        Args: { p_distraction?: string | null; p_focus_rating: string; p_session_id: string }
        Returns: Database['public']['CompositeTypes']['rating_result']
      }
      session_heartbeat: { Args: { p_session_id: string }; Returns: boolean }
      start_session: { Args: { p_garden_id: string } } & ReturnsSession
      send_friend_request: { Args: { p_username: string }; Returns: string }
      respond_friend_request: { Args: { p_accept: boolean; p_user: string }; Returns: undefined }
      remove_friend: { Args: { p_user: string }; Returns: undefined }
      invite_info: { Args: { p_code: string }; Returns: string }
      join_by_invite: { Args: { p_code: string }; Returns: string }
      list_friends: {
        Args: never
        Returns: { direction: string; since: string; status: string; user_id: string; username: string | null }[]
      }
      friend_ranking: {
        Args: never
        Returns: { is_me: boolean; minutes: number; sessions: number; user_id: string; username: string | null }[]
      }
      friend_gardens: { Args: { p_user: string }; Returns: Database['public']['Tables']['gardens']['Row'][] }
      friend_plants: { Args: { p_user: string }; Returns: Database['public']['Tables']['plants']['Row'][] }
      send_gift: { Args: { p_amount?: number; p_kind: string; p_to: string }; Returns: undefined }
      unseen_gifts: {
        Args: never
        Returns: { amount: number; from_id: string; from_username: string | null; kind: string; notes: string[]; last_at: string }[]
      }
      plant_flower: { Args: { p_color: string; p_garden: string }; Returns: Database['public']['Tables']['flowers']['Row'] }
      garden_flowers: {
        Args: { p_garden: string }
        Returns: { color: string; from_username: string | null; id: string; planted_at: string; position_x: number; position_z: number }[]
      }
      friend_feed: {
        Args: never
        Returns: {
          clapped: boolean
          claps: number
          detail: string | null
          event_key: string
          garden_name: string | null
          happened_at: string
          is_me: boolean
          kind: string
          user_id: string
          username: string | null
        }[]
      }
      clap: { Args: { p_event_key: string; p_to: string }; Returns: boolean }
      nudge_replies: { Args: never; Returns: { gift_id: string; minutes: number; to_id: string; to_username: string | null }[] }
      mark_nudge_replies_seen: { Args: never; Returns: number }
      mark_gifts_seen: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      rating_result: {
        outcome: string | null
        plant_growth: number | null
        plant_status: string | null
        points: number | null
      }
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
