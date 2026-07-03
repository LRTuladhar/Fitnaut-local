export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      exercise_definitions: {
        Row: {
          id: string;
          name: string;
          alternate_names: string[];
          type: string;
          muscle_groups: string[];
          category: string;
          expected_parameters: string[];
        };
        Insert: {
          id?: string;
          name: string;
          alternate_names?: string[];
          type: string;
          muscle_groups?: string[];
          category: string;
          expected_parameters?: string[];
        };
        Update: Partial<{
          id: string;
          name: string;
          alternate_names: string[];
          type: string;
          muscle_groups: string[];
          category: string;
          expected_parameters: string[];
        }>;
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          user_id: string;
          timestamp: string;
          exercise_definition_id: string;
          exercise_name: string;
          reps: number | null;
          weight_kg: number | null;
          distance_m: number | null;
          duration_s: number | null;
          notes: string | null;
          session_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          timestamp?: string;
          exercise_definition_id: string;
          exercise_name: string;
          reps?: number | null;
          weight_kg?: number | null;
          distance_m?: number | null;
          duration_s?: number | null;
          notes?: string | null;
          session_id?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          timestamp: string;
          exercise_definition_id: string;
          exercise_name: string;
          reps: number | null;
          weight_kg: number | null;
          distance_m: number | null;
          duration_s: number | null;
          notes: string | null;
          session_id: string | null;
        }>;
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time: string;
          notes?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          notes: string | null;
        }>;
        Relationships: [];
      };
      health_metrics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight_kg: number | null;
          heart_rate: number | null;
          systolic_bp: number | null;
          diastolic_bp: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          weight_kg?: number | null;
          heart_rate?: number | null;
          systolic_bp?: number | null;
          diastolic_bp?: number | null;
          notes?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          date: string;
          weight_kg: number | null;
          heart_rate: number | null;
          systolic_bp: number | null;
          diastolic_bp: number | null;
          notes: string | null;
        }>;
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          weight_unit: string;
          distance_unit: string;
          session_gap_seconds: number;
          default_time_range: string;
          ai_provider: string;
          openrouter_model: string | null;
        };
        Insert: {
          user_id: string;
          weight_unit?: string;
          distance_unit?: string;
          session_gap_seconds?: number;
          default_time_range?: string;
          ai_provider?: string;
          openrouter_model?: string | null;
        };
        Update: Partial<{
          user_id: string;
          weight_unit: string;
          distance_unit: string;
          session_gap_seconds: number;
          default_time_range: string;
          ai_provider: string;
          openrouter_model: string | null;
        }>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          name: string | null;
          year_of_birth: number | null;
          gender: string | null;
          fitness_goals: string[];
        };
        Insert: {
          user_id: string;
          name?: string | null;
          year_of_birth?: number | null;
          gender?: string | null;
          fitness_goals?: string[];
        };
        Update: Partial<{
          user_id: string;
          name: string | null;
          year_of_birth: number | null;
          gender: string | null;
          fitness_goals: string[];
        }>;
        Relationships: [];
      };
      user_api_keys: {
        Row: {
          user_id: string;
          openrouter_key_encrypted: string | null;
          anthropic_key_encrypted: string | null;
        };
        Insert: {
          user_id: string;
          openrouter_key_encrypted?: string | null;
          anthropic_key_encrypted?: string | null;
        };
        Update: Partial<{
          user_id: string;
          openrouter_key_encrypted: string | null;
          anthropic_key_encrypted: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
