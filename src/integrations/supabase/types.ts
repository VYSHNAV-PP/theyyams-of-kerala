/* Hand-written to match supabase/schema (theyyams_schema.sql). Regenerate with the Supabase CLI when convenient. */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      kavus: {
        Row: {
          id: string;
          name: string;
          locality: string;
          district: string;
          lat: number;
          lng: number;
          description: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          locality: string;
          district: string;
          lat: number;
          lng: number;
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          locality?: string;
          district?: string;
          lat?: number;
          lng?: number;
          description?: string | null;
          image_url?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          category: string;
          subcategory: string;
          description: string;
          date: string;
          end_date: string;
          start_time: string;
          end_time: string | null;
          time: string | null;
          starts_at: string;
          ends_at: string;
          venue: string;
          locality: string;
          district: string;
          lat: number;
          lng: number;
          kavu_id: string | null;
          entry_status: string;
          entry_fee: string | null;
          registration_start: string | null;
          registration_end: string | null;
          contact: string | null;
          ticket_url: string | null;
          instagram: string | null;
          website: string | null;
          other_url: string | null;
          source_types: string[];
          image_url: string | null;
          image_candidates: Json;
          upvotes: number;
          downvotes: number;
          reports: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id: string;
          title: string;
          category: string;
          subcategory: string;
          description: string;
          date: string;
          end_date: string;
          start_time: string;
          end_time?: string | null;
          time?: string | null;
          venue: string;
          locality: string;
          district: string;
          lat: number;
          lng: number;
          kavu_id?: string | null;
          entry_status?: string;
          entry_fee?: string | null;
          registration_start?: string | null;
          registration_end?: string | null;
          contact?: string | null;
          ticket_url?: string | null;
          instagram?: string | null;
          website?: string | null;
          other_url?: string | null;
          source_types?: string[];
          image_url?: string | null;
          image_candidates?: Json;
          upvotes?: number;
          downvotes?: number;
          reports?: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          category?: string;
          subcategory?: string;
          description?: string;
          date?: string;
          end_date?: string;
          start_time?: string;
          end_time?: string | null;
          time?: string | null;
          venue?: string;
          locality?: string;
          district?: string;
          lat?: number;
          lng?: number;
          kavu_id?: string | null;
          entry_status?: string;
          entry_fee?: string | null;
          registration_start?: string | null;
          registration_end?: string | null;
          contact?: string | null;
          ticket_url?: string | null;
          instagram?: string | null;
          website?: string | null;
          other_url?: string | null;
          source_types?: string[];
          image_url?: string | null;
          image_candidates?: Json;
          upvotes?: number;
          downvotes?: number;
          reports?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_kavu_id_fkey";
            columns: ["kavu_id"];
            isOneToOne: false;
            referencedRelation: "kavus";
            referencedColumns: ["id"];
          },
        ];
      };
      event_votes: {
        Row: { event_id: string; voter_id: string; kind: string; created_at: string };
        Insert: { event_id: string; voter_id: string; kind: string; created_at?: string };
        Update: { event_id?: string; voter_id?: string; kind?: string; created_at?: string };
        Relationships: [];
      };
      event_feedback: {
        Row: {
          id: string;
          event_id: string;
          author_id: string;
          type: string;
          reason: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          author_id: string;
          type: string;
          reason: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          author_id?: string;
          type?: string;
          reason?: string;
          note?: string | null;
        };
        Relationships: [];
      };
      event_reports: {
        Row: {
          event_id: string;
          reporter_id: string;
          reason: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          reporter_id: string;
          reason: string;
          note?: string | null;
          created_at?: string;
        };
        Update: { event_id?: string; reporter_id?: string; reason?: string; note?: string | null };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      vote_event: {
        Args: { _event_id: string; _voter_id: string; _kind: string };
        Returns: undefined;
      };
      submit_downvote: {
        Args: { _event_id: string; _author_id: string; _reason: string; _note?: string | null };
        Returns: undefined;
      };
      report_event: {
        Args: { _event_id: string; _reporter_id: string; _reason: string; _note?: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
