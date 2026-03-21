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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      device_commands: {
        Row: {
          acknowledged_at: string | null
          command: string
          completed_at: string | null
          created_at: string
          device_id: string
          id: string
          payload: Json | null
          result: Json | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          command: string
          completed_at?: string | null
          created_at?: string
          device_id: string
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          command?: string
          completed_at?: string | null
          created_at?: string
          device_id?: string
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          api_key: string | null
          created_at: string
          firmware_type: string | null
          id: string
          name: string
          tenant_id: number
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          firmware_type?: string | null
          id?: string
          name: string
          tenant_id?: number
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          firmware_type?: string | null
          id?: string
          name?: string
          tenant_id?: number
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          tenant_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          tenant_id?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          tenant_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          days_of_week: number[]
          device_id: string
          enabled: boolean
          end_time: string
          id: string
          start_time: string
          tenant_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          device_id: string
          enabled?: boolean
          end_time: string
          id?: string
          start_time: string
          tenant_id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          device_id?: string
          enabled?: boolean
          end_time?: string
          id?: string
          start_time?: string
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cost: number | null
          device_id: string
          ended_at: string | null
          energy_kwh: number | null
          id: string
          started_at: string
          tenant_id: number
        }
        Insert: {
          cost?: number | null
          device_id: string
          ended_at?: string | null
          energy_kwh?: number | null
          id?: string
          started_at?: string
          tenant_id?: number
        }
        Update: {
          cost?: number | null
          device_id?: string
          ended_at?: string | null
          energy_kwh?: number | null
          id?: string
          started_at?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_rates: {
        Row: {
          cost_per_kwh: number
          created_at: string
          end_time: string
          id: string
          is_default: boolean
          name: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_per_kwh?: number
          created_at?: string
          end_time: string
          id?: string
          is_default?: boolean
          name: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_per_kwh?: number
          created_at?: string
          end_time?: string
          id?: string
          is_default?: boolean
          name?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telemetry: {
        Row: {
          amps: number | null
          device_id: string
          id: string
          recorded_at: string
          temperature: number | null
          voltage: number | null
          wh: number | null
        }
        Insert: {
          amps?: number | null
          device_id: string
          id?: string
          recorded_at?: string
          temperature?: number | null
          voltage?: number | null
          wh?: number | null
        }
        Update: {
          amps?: number | null
          device_id?: string
          id?: string
          recorded_at?: string
          temperature?: number | null
          voltage?: number | null
          wh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          currency: string
          currency_symbol: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          currency_symbol?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          currency_symbol?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
