export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }

  public: {
    Tables: {
      event_votes: {
        Row: {
          created_at: string
          event_id: string
          kind: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          kind: string
          voter_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          kind?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }

      event_reports: {
        Row: {
          created_at: string
          event_id: string
          note: string | null
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          note?: string | null
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          note?: string | null
          reason?: string
          reporter_id?: string
        }
        Relationships: []
      }

      event_feedback: {
        Row: {
          id: string
          event_id: string
          author_id: string
          type: string
          reason: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          author_id: string
          type: string
          reason: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          author_id?: string
          type?: string
          reason?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }

      events: {
        Row: {
          category: string
          contact: string | null
          created_at: string
          date: string
          description: string
          district: string
          downvotes: number
          end_date: string | null
          end_time: string | null
          ends_at: string
          entry_fee: string | null
          entry_status: string
          id: string
          image_url: string | null
          instagram: string | null
          lat: number
          link: string | null
          lng: number
          locality: string
          other_url: string | null
          reports: number
          start_time: string
          starts_at: string
          status: string
          subcategory: string
          ticket_url: string | null
          time: string
          title: string
          upvotes: number
          venue: string
          website: string | null
        }

        Insert: {
          category: string
          contact?: string | null
          created_at?: string
          date: string
          description: string
          district: string
          downvotes?: number
          end_date?: string | null
          end_time?: string | null
          entry_fee?: string | null
          entry_status?: string
          id: string
          image_url?: string | null
          instagram?: string | null
          lat: number
          link?: string | null
          lng: number
          locality: string
          other_url?: string | null
          reports?: number
          start_time: string
          subcategory: string
          ticket_url?: string | null
          time: string
          title: string
          upvotes?: number
          venue: string
          website?: string | null
        }

        Update: {
          [K in never]?: never
        }

        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      cast_vote: {
        Args: {
          _event_id: string
          _kind: string
          _voter_id: string
        }
        Returns: undefined
      }

      report_event: {
        Args: {
          _event_id: string
          _note?: string
          _reason: string
          _reporter_id: string
        }
        Returns: undefined
      }

      vote_event: {
        Args: {
          _event_id: string
          _kind: string
          _voter_id: string
        }
        Returns: undefined
      }

      submit_downvote: {
        Args: {
          _event_id: string
          _author_id: string
          _reason: string
          _note?: string
        }
        Returns: undefined
      }

      submit_event_report: {
        Args: {
          _event_id: string
          _author_id: string
          _reason: string
          _note?: string
        }
        Returns: undefined
      }
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
  TableName extends (
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals
    }
      ? keyof (
          DatabaseWithoutInternals[
            DefaultSchemaTableNameOrOptions["schema"]
          ]["Tables"] &
            DatabaseWithoutInternals[
              DefaultSchemaTableNameOrOptions["schema"]
            ]["Views"]
        )
      : never
  ) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (
      DatabaseWithoutInternals[
        DefaultSchemaTableNameOrOptions["schema"]
      ]["Tables"] &
        DatabaseWithoutInternals[
          DefaultSchemaTableNameOrOptions["schema"]
        ]["Views"]
    )[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (
        DefaultSchema["Tables"] &
          DefaultSchema["Views"]
      )
    ? (
        DefaultSchema["Tables"] &
          DefaultSchema["Views"]
      )[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaTableNameOrOptions["schema"]
        ]["Tables"]
      : never
  ) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[
      DefaultSchemaTableNameOrOptions["schema"]
    ]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][
        DefaultSchemaTableNameOrOptions
      ] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (
    DefaultSchemaTableNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaTableNameOrOptions["schema"]
        ]["Tables"]
      : never
  ) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[
      DefaultSchemaTableNameOrOptions["schema"]
    ]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][
        DefaultSchemaTableNameOrOptions
      ] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (
    DefaultSchemaEnumNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals
    }
      ? keyof DatabaseWithoutInternals[
          DefaultSchemaEnumNameOrOptions["schema"]
        ]["Enums"]
      : never
  ) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[
      DefaultSchemaEnumNameOrOptions["schema"]
    ]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (
    PublicCompositeTypeNameOrOptions extends {
      schema: keyof DatabaseWithoutInternals
    }
      ? keyof DatabaseWithoutInternals[
          PublicCompositeTypeNameOrOptions["schema"]
        ]["CompositeTypes"]
      : never
  ) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][
        PublicCompositeTypeNameOrOptions
      ]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const