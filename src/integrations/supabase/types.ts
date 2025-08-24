export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          bpm: number | null
          created_at: string | null
          id: string
          name: string | null
          rhythm_value: number | null
          scale_id: string
          sequence_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          rhythm_value?: number | null
          scale_id: string
          sequence_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bpm?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          rhythm_value?: number | null
          scale_id?: string
          sequence_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_exercises: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          Difficulty: number | null
          id: string
          is_public: boolean
          name: string
          notes: Json
          notes_per_beat: number | null
          Parent: string | null
          Position: number | null
          Tonality: string
          Tonic: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          Difficulty?: number | null
          id?: string
          is_public?: boolean
          name: string
          notes: Json
          notes_per_beat?: number | null
          Parent?: string | null
          Position?: number | null
          Tonality?: string
          Tonic?: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          Difficulty?: number | null
          id?: string
          is_public?: boolean
          name?: string
          notes?: Json
          notes_per_beat?: number | null
          Parent?: string | null
          Position?: number | null
          Tonality?: string
          Tonic?: string
          type?: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
        }
        Relationships: []
      }
      practice_log: {
        Row: {
          created_at: string
          duration: number
          exercise_id: string
          id: number
          max_bpm: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration: number
          exercise_id: string
          id?: number
          max_bpm?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number
          exercise_id?: string
          id?: number
          max_bpm?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_log_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          band: string | null
          id: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          band?: string | null
          id: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          band?: string | null
          id?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      scale_shapes: {
        Row: {
          id: string
          intervals: number[] | null
          name: string
          shape_json: Json
        }
        Insert: {
          id?: string
          intervals?: number[] | null
          name: string
          shape_json: Json
        }
        Update: {
          id?: string
          intervals?: number[] | null
          name?: string
          shape_json?: Json
        }
        Relationships: []
      }
      scales: {
        Row: {
          created_at: string | null
          created_by: string | null
          difficulty: number | null
          id: string
          is_public: boolean | null
          name: string
          notes_json: Json
          position: number | null
          tonality: string | null
          tonic: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          id?: string
          is_public?: boolean | null
          name: string
          notes_json: Json
          position?: number | null
          tonality?: string | null
          tonic?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          id?: string
          is_public?: boolean | null
          name?: string
          notes_json?: Json
          position?: number | null
          tonality?: string | null
          tonic?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sequences: {
        Row: {
          id: string
          name: string
          pattern_string: string
          repetition_style: string
        }
        Insert: {
          id?: string
          name: string
          pattern_string: string
          repetition_style: string
        }
        Update: {
          id?: string
          name?: string
          pattern_string?: string
          repetition_style?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      exercise_difficulty: "beginner" | "intermediate" | "advanced"
      exercise_type: "riff" | "scale" | "arpeggio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      exercise_difficulty: ["beginner", "intermediate", "advanced"],
      exercise_type: ["riff", "scale", "arpeggio"],
    },
  },
} as const
