// Supabase Database Types
// This file contains types that match the Supabase database schema

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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          username: string | null
          avatar_url: string | null
          bio: string | null
          website: string | null
          twitter_handle: string | null
          linkedin_url: string | null
          followers_count: number
          following_count: number
          pitches_count: number
          companies_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          followers_count?: number
          following_count?: number
          pitches_count?: number
          companies_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          followers_count?: number
          following_count?: number
          pitches_count?: number
          companies_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          founder_id: string
          name: string
          slug: string
          tagline: string | null
          description: string | null
          industry: string
          stage: string
          website: string | null
          twitter_handle: string | null
          linkedin_url: string | null
          pitches_count: number
          total_views: number
          total_roasts: number
          total_toasts: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          founder_id: string
          name: string
          slug?: string
          tagline?: string | null
          description?: string | null
          industry: string
          stage: string
          website?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          pitches_count?: number
          total_views?: number
          total_roasts?: number
          total_toasts?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          founder_id?: string
          name?: string
          slug?: string
          tagline?: string | null
          description?: string | null
          industry?: string
          stage?: string
          website?: string | null
          twitter_handle?: string | null
          linkedin_url?: string | null
          pitches_count?: number
          total_views?: number
          total_roasts?: number
          total_toasts?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      pitches: {
        Row: {
          id: string
          user_id: string
          company_id: string
          hook: string
          description: string | null
          video_url: string
          video_provider: string
          video_id: string | null
          thumbnail_url: string | null
          duration: number | null
          version_number: number
          views_count: number
          roast_count: number
          toast_count: number
          interest_score: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          hook: string
          description?: string | null
          video_url: string
          video_provider?: string
          video_id?: string | null
          thumbnail_url?: string | null
          duration?: number | null
          version_number?: number
          views_count?: number
          roast_count?: number
          toast_count?: number
          interest_score?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          hook?: string
          description?: string | null
          video_url?: string
          video_provider?: string
          video_id?: string | null
          thumbnail_url?: string | null
          duration?: number | null
          version_number?: number
          views_count?: number
          roast_count?: number
          toast_count?: number
          interest_score?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          pitch_id: string
          user_id: string
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          pitch_id: string
          user_id: string
          type: string
          created_at?: string
        }
        Update: {
          id?: string
          pitch_id?: string
          user_id?: string
          type?: string
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          pitch_id: string
          user_id: string
          type: string
          content: string
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pitch_id: string
          user_id: string
          type: string
          content: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pitch_id?: string
          user_id?: string
          type?: string
          content?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      pitch_views: {
        Row: {
          id: string
          pitch_id: string
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pitch_id: string
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          pitch_id?: string
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
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
  }
}

// Type helpers for Supabase queries
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
