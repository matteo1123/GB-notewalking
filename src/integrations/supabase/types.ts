export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chord_progression_progress: {
        Row: {
          id: string
          last_practiced: string
          mastery_level: number
          max_clean_bpm: number
          progression_id: string
          time_practiced_seconds: number
          user_id: string
        }
        Insert: {
          id?: string
          last_practiced: string
          mastery_level?: number
          max_clean_bpm?: number
          progression_id: string
          time_practiced_seconds?: number
          user_id: string
        }
        Update: {
          id?: string
          last_practiced?: string
          mastery_level?: number
          max_clean_bpm?: number
          progression_id?: string
          time_practiced_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chord_progression_progress_progression_id_fkey"
            columns: ["progression_id"]
            isOneToOne: false
            referencedRelation: "chord_progressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chord_progression_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chord_progressions: {
        Row: {
          category: string
          chords: Json
          created_at: string
          description: string | null
          difficulty: string
          id: string
          is_custom: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          category: string
          chords: Json
          created_at?: string
          description?: string | null
          difficulty: string
          id?: string
          is_custom?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string
          chords?: Json
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          is_custom?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chord_progressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chords: {
        Row: {
          chord_name: string
          chord_quality: string
          chord_shape: string | null
          created_at: string
          id: string
          intervals: string | null
          is_movable: boolean
          position: number
          root_note: string
          user_id: string | null
        }
        Insert: {
          chord_name: string
          chord_quality: string
          chord_shape?: string | null
          created_at?: string
          id?: string
          intervals?: string | null
          is_movable?: boolean
          position: number
          root_note: string
          user_id?: string | null
        }
        Update: {
          chord_name?: string
          chord_quality?: string
          chord_shape?: string | null
          created_at?: string
          id?: string
          intervals?: string | null
          is_movable?: boolean
          position?: number
          root_note?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chords_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difficulty: number
          id: string
          name: string
          tab_content: string | null
          video_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          difficulty?: number
          id?: string
          name: string
          tab_content?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: number
          id?: string
          name?: string
          tab_content?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      notewalking_comfort: {
        Row: {
          chord_pair: string
          comfort_data: Json
          created_at: string
          id: string
          session_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chord_pair: string
          comfort_data?: Json
          created_at?: string
          id?: string
          session_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chord_pair?: string
          comfort_data?: Json
          created_at?: string
          id?: string
          session_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notewalking_comfort_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      practice_log: {
        Row: {
          created_at: string
          duration: number
          id: string
          mastery_level: number | null
          max_bpm: number | null
          module_config: Json | null
          module_type: string
          notes: string | null
          scale_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration: number
          id?: string
          mastery_level?: number | null
          max_bpm?: number | null
          module_config?: Json | null
          module_type: string
          notes?: string | null
          scale_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number
          id?: string
          mastery_level?: number | null
          max_bpm?: number | null
          module_config?: Json | null
          module_type?: string
          notes?: string | null
          scale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_log_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      practice_routines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          modules: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          modules?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          modules?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      scale_shapes: {
        Row: {
          created_at: string
          description: string | null
          fingering_pattern: string | null
          id: string
          image_url: string | null
          intervals: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fingering_pattern?: string | null
          id?: string
          image_url?: string | null
          intervals: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fingering_pattern?: string | null
          id?: string
          image_url?: string | null
          intervals?: string
          name?: string
        }
        Relationships: []
      }
      scales: {
        Row: {
          created_at: string
          id: string
          major_key: string | null
          name: string
          Position: number | null
          root_note: string
          scale_shape: string | null
          tonality: string
          Type: string
        }
        Insert: {
          created_at?: string
          id?: string
          major_key?: string | null
          name: string
          Position?: number | null
          root_note: string
          scale_shape?: string | null
          tonality: string
          Type: string
        }
        Update: {
          created_at?: string
          id?: string
          major_key?: string | null
          name?: string
          Position?: number | null
          root_note?: string
          scale_shape?: string | null
          tonality?: string
          Type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scales_scale_shape_fkey"
            columns: ["scale_shape"]
            isOneToOne: false
            referencedRelation: "scale_shapes"
            referencedColumns: ["id"]
          }
        ]
      }
      suggestions: {
        Row: {
          content: string
          created_at: string
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      recital_schedule: {
        Row: {
          id: string
          title: string
          scheduled_for: string
          notes: string | null
          created_by: string
          auto_started: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          scheduled_for: string
          notes?: string | null
          created_by: string
          auto_started?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          scheduled_for?: string
          notes?: string | null
          created_by?: string
          auto_started?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recital_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      recitals: {
        Row: {
          id: string
          created_by: string
          schedule_id: string | null
          status: 'active' | 'ended'
          daily_room_url: string | null
          daily_room_name: string | null
          current_performer_id: string | null
          performer_slot_started_at: string | null
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          created_by: string
          schedule_id?: string | null
          status?: 'active' | 'ended'
          daily_room_url?: string | null
          daily_room_name?: string | null
          current_performer_id?: string | null
          performer_slot_started_at?: string | null
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          created_by?: string
          schedule_id?: string | null
          status?: 'active' | 'ended'
          daily_room_url?: string | null
          daily_room_name?: string | null
          current_performer_id?: string | null
          performer_slot_started_at?: string | null
          started_at?: string
          ended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recitals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recitals_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recital_schedule"
            referencedColumns: ["id"]
          }
        ]
      }
      recital_queue: {
        Row: {
          id: string
          recital_id: string
          user_id: string
          display_name: string
          ready: boolean
          chat_banned_this_session: boolean
          video_banned: boolean
          joined_at: string
          performed_at: string | null
        }
        Insert: {
          id?: string
          recital_id: string
          user_id: string
          display_name: string
          ready?: boolean
          chat_banned_this_session?: boolean
          video_banned?: boolean
          joined_at?: string
          performed_at?: string | null
        }
        Update: {
          id?: string
          recital_id?: string
          user_id?: string
          display_name?: string
          ready?: boolean
          chat_banned_this_session?: boolean
          video_banned?: boolean
          joined_at?: string
          performed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recital_queue_recital_id_fkey"
            columns: ["recital_id"]
            isOneToOne: false
            referencedRelation: "recitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recital_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      recital_chat: {
        Row: {
          id: string
          recital_id: string
          user_id: string
          display_name: string
          body: string
          deleted_by_admin: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recital_id: string
          user_id: string
          display_name: string
          body: string
          deleted_by_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recital_id?: string
          user_id?: string
          display_name?: string
          body?: string
          deleted_by_admin?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recital_chat_recital_id_fkey"
            columns: ["recital_id"]
            isOneToOne: false
            referencedRelation: "recitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recital_chat_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
