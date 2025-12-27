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
            user_priorities: {
                Row: {
                    id: string
                    user_id: string
                    type: string
                    weight: number
                    module_type: string | null
                    exercise_id: string | null
                    target_metric: Json | null
                    last_practiced: string | null
                    current_progress: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: string
                    weight: number
                    module_type?: string | null
                    exercise_id?: string | null
                    target_metric?: Json | null
                    last_practiced?: string | null
                    current_progress?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: string
                    weight?: number
                    module_type?: string | null
                    exercise_id?: string | null
                    target_metric?: Json | null
                    last_practiced?: string | null
                    current_progress?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
        }
    }
}

// Helper types
export type Tables<TableName extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][TableName]['Row']
export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][TableName]['Insert']
export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][TableName]['Update']
