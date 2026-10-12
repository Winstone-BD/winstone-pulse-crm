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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_accountability_reviews: {
        Row: {
          agent_id: string
          approval_note: string | null
          assigned_count: number
          business_date: string
          completed_count: number
          created_at: string
          eligible_count: number
          evidence: Json
          id: string
          missed_reports: number
          overdue_followups: number
          pending_count: number
          pending_percent: number
          review_history: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          trigger_reason: string
          unlock_for_date: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          approval_note?: string | null
          assigned_count?: number
          business_date: string
          completed_count?: number
          created_at?: string
          eligible_count?: number
          evidence?: Json
          id?: string
          missed_reports?: number
          overdue_followups?: number
          pending_count?: number
          pending_percent?: number
          review_history?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trigger_reason: string
          unlock_for_date: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          approval_note?: string | null
          assigned_count?: number
          business_date?: string
          completed_count?: number
          created_at?: string
          eligible_count?: number
          evidence?: Json
          id?: string
          missed_reports?: number
          overdue_followups?: number
          pending_count?: number
          pending_percent?: number
          review_history?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trigger_reason?: string
          unlock_for_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_accountability_reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_briefing_acknowledgements: {
        Row: {
          acknowledged_at: string
          agent_id: string
          business_date: string
          id: string
          policy_version: string
          source: string
        }
        Insert: {
          acknowledged_at?: string
          agent_id: string
          business_date: string
          id?: string
          policy_version: string
          source: string
        }
        Update: {
          acknowledged_at?: string
          agent_id?: string
          business_date?: string
          id?: string
          policy_version?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_briefing_acknowledgements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_contribution_reviews: {
        Row: {
          created_at: string
          id: string
          note: string | null
          report_id: string
          reviewer: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          report_id: string
          reviewer: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          report_id?: string
          reviewer?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_contribution_reviews_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agent_daily_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_daily_contributions: {
        Row: {
          agent_id: string
          business_date: string
          created_at: string
          id: string
          kind: string
          source: string
          summary: string
        }
        Insert: {
          agent_id: string
          business_date: string
          created_at?: string
          id?: string
          kind: string
          source?: string
          summary: string
        }
        Update: {
          agent_id?: string
          business_date?: string
          created_at?: string
          id?: string
          kind?: string
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_daily_contributions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_devices: {
        Row: {
          android_version: string | null
          app_version: string | null
          created_at: string
          device_label: string | null
          device_uid: string | null
          id: string
          last_seen_at: string
          manufacturer: string | null
          model: string | null
          phone_number: string | null
          platform: string
          profile_id: string
          recording_capable: boolean | null
          recording_checked_at: string | null
          recording_mode: string | null
          recording_note: string | null
          recording_tested: boolean
          revoked_at: string | null
          sim_verified_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          android_version?: string | null
          app_version?: string | null
          created_at?: string
          device_label?: string | null
          device_uid?: string | null
          id?: string
          last_seen_at?: string
          manufacturer?: string | null
          model?: string | null
          phone_number?: string | null
          platform?: string
          profile_id: string
          recording_capable?: boolean | null
          recording_checked_at?: string | null
          recording_mode?: string | null
          recording_note?: string | null
          recording_tested?: boolean
          revoked_at?: string | null
          sim_verified_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          android_version?: string | null
          app_version?: string | null
          created_at?: string
          device_label?: string | null
          device_uid?: string | null
          id?: string
          last_seen_at?: string
          manufacturer?: string | null
          model?: string | null
          phone_number?: string | null
          platform?: string
          profile_id?: string
          recording_capable?: boolean | null
          recording_checked_at?: string | null
          recording_mode?: string | null
          recording_note?: string | null
          recording_tested?: boolean
          revoked_at?: string | null
          sim_verified_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summary_cache: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          id: string
          kind: string
          model: string
          summary: Json
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          model: string
          summary: Json
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          model?: string
          summary?: Json
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          actor_profile_id: string | null
          category: string
          created_at: string
          detail: string | null
          est_credits: number
          id: string
          model: string | null
          units: number
        }
        Insert: {
          actor_profile_id?: string | null
          category: string
          created_at?: string
          detail?: string | null
          est_credits: number
          id?: string
          model?: string | null
          units?: number
        }
        Update: {
          actor_profile_id?: string | null
          category?: string
          created_at?: string
          detail?: string | null
          est_credits?: number
          id?: string
          model?: string | null
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_voice_sessions: {
        Row: {
          call_sid: string | null
          direction: string
          ended_at: string | null
          error_message: string | null
          from_number: string | null
          handoff_agent_id: string | null
          handoff_reason: string | null
          id: string
          language: string
          lead_id: string | null
          session_id: string | null
          started_at: string
          status: string
          to_number: string | null
          turn_count: number
          updated_at: string
        }
        Insert: {
          call_sid?: string | null
          direction?: string
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          handoff_agent_id?: string | null
          handoff_reason?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          session_id?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          turn_count?: number
          updated_at?: string
        }
        Update: {
          call_sid?: string | null
          direction?: string
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          handoff_agent_id?: string | null
          handoff_reason?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          session_id?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          turn_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_voice_sessions_handoff_agent_id_fkey"
            columns: ["handoff_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_voice_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_voice_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          interrupted: boolean
          language: string | null
          role: string
          session_row_id: string
          turn_index: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interrupted?: boolean
          language?: string | null
          role: string
          session_row_id: string
          turn_index: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interrupted?: boolean
          language?: string | null
          role?: string
          session_row_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_voice_turns_session_row_id_fkey"
            columns: ["session_row_id"]
            isOneToOne: false
            referencedRelation: "ai_voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          id: string
          is_mandatory: boolean
          release_notes: string | null
          released_at: string
          storage_path: string
          version_code: number
          version_name: string
        }
        Insert: {
          id?: string
          is_mandatory?: boolean
          release_notes?: string | null
          released_at?: string
          storage_path?: string
          version_code: number
          version_name: string
        }
        Update: {
          id?: string
          is_mandatory?: boolean
          release_notes?: string | null
          released_at?: string
          storage_path?: string
          version_code?: number
          version_name?: string
        }
        Relationships: []
      }
      architect_auth_attempts: {
        Row: {
          at: string
          email: string | null
          id: string
          ip: string | null
          stage: string
          success: boolean
        }
        Insert: {
          at?: string
          email?: string | null
          id?: string
          ip?: string | null
          stage: string
          success: boolean
        }
        Update: {
          at?: string
          email?: string | null
          id?: string
          ip?: string | null
          stage?: string
          success?: boolean
        }
        Relationships: []
      }
      audit_findings: {
        Row: {
          audit_commit: string
          audit_date: string
          captured_at: string
          captured_by: string
          doc_version: string
          evidence: string
          finding_key: string
          id: string
          item_no: string
          result: string
          title: string
        }
        Insert: {
          audit_commit: string
          audit_date: string
          captured_at?: string
          captured_by: string
          doc_version: string
          evidence: string
          finding_key: string
          id?: string
          item_no: string
          result: string
          title: string
        }
        Update: {
          audit_commit?: string
          audit_date?: string
          captured_at?: string
          captured_by?: string
          doc_version?: string
          evidence?: string
          finding_key?: string
          id?: string
          item_no?: string
          result?: string
          title?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_remediation_events: {
        Row: {
          action: string
          actor_name: string
          actor_scope: string
          created_at: string
          finding_key: string
          id: string
          note: string
        }
        Insert: {
          action: string
          actor_name: string
          actor_scope: string
          created_at?: string
          finding_key: string
          id?: string
          note: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_scope?: string
          created_at?: string
          finding_key?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_remediation_events_finding_key_fkey"
            columns: ["finding_key"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["finding_key"]
          },
        ]
      }
      bookings: {
        Row: {
          agent_id: string | null
          amount_usd: number | null
          approval_status: string
          area: string | null
          booked_at: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          notes: string | null
          project: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id?: string | null
          amount_usd?: number | null
          approval_status?: string
          area?: string | null
          booked_at?: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          notes?: string | null
          project?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string | null
          amount_usd?: number | null
          approval_status?: string
          area?: string | null
          booked_at?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          notes?: string | null
          project?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_processing_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          provider: string | null
          recording_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          provider?: string | null
          recording_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          provider?: string | null
          recording_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_processing_jobs_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          agent_id: string | null
          agent_phone: string | null
          ai_grade: string | null
          ai_intent: string | null
          ai_lead_category: string | null
          ai_next_action: string | null
          ai_summary: string | null
          ai_temperature: string | null
          analysis_attempts: number
          analysis_error: string | null
          analysis_status: string
          answered_at: string | null
          audio_url: string | null
          call_direction: Database["public"]["Enums"]["call_direction"]
          call_source: string
          call_status: string
          checksum: string | null
          client_upload_id: string | null
          created_at: string
          customer_objections: string[]
          deal_stage: string | null
          device_id: string | null
          duration_seconds: number
          external_call_id: string | null
          file_name: string | null
          file_size_bytes: number | null
          finished_at: string | null
          id: string
          is_two_sided: boolean
          lead_id: string | null
          mime_type: string | null
          phone_number: string
          recorder_source: string | null
          recording_status: string
          sentiment: Database["public"]["Enums"]["call_sentiment"] | null
          started_at: string | null
          storage_bucket: string | null
          storage_path: string | null
          stt_duration_ms: number | null
          stt_error_code: string | null
          stt_error_message: string | null
          stt_fallback_used: boolean
          stt_language: string | null
          stt_model: string | null
          stt_provider: string | null
          stt_request_id: string | null
          stt_status: string | null
          sync_status: Database["public"]["Enums"]["sync_status"]
          transcribed_at: string | null
          transcription_text: string | null
          updated_at: string
          upload_status: string
        }
        Insert: {
          agent_id?: string | null
          agent_phone?: string | null
          ai_grade?: string | null
          ai_intent?: string | null
          ai_lead_category?: string | null
          ai_next_action?: string | null
          ai_summary?: string | null
          ai_temperature?: string | null
          analysis_attempts?: number
          analysis_error?: string | null
          analysis_status?: string
          answered_at?: string | null
          audio_url?: string | null
          call_direction?: Database["public"]["Enums"]["call_direction"]
          call_source?: string
          call_status?: string
          checksum?: string | null
          client_upload_id?: string | null
          created_at?: string
          customer_objections?: string[]
          deal_stage?: string | null
          device_id?: string | null
          duration_seconds?: number
          external_call_id?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          is_two_sided?: boolean
          lead_id?: string | null
          mime_type?: string | null
          phone_number: string
          recorder_source?: string | null
          recording_status?: string
          sentiment?: Database["public"]["Enums"]["call_sentiment"] | null
          started_at?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          stt_duration_ms?: number | null
          stt_error_code?: string | null
          stt_error_message?: string | null
          stt_fallback_used?: boolean
          stt_language?: string | null
          stt_model?: string | null
          stt_provider?: string | null
          stt_request_id?: string | null
          stt_status?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          transcribed_at?: string | null
          transcription_text?: string | null
          updated_at?: string
          upload_status?: string
        }
        Update: {
          agent_id?: string | null
          agent_phone?: string | null
          ai_grade?: string | null
          ai_intent?: string | null
          ai_lead_category?: string | null
          ai_next_action?: string | null
          ai_summary?: string | null
          ai_temperature?: string | null
          analysis_attempts?: number
          analysis_error?: string | null
          analysis_status?: string
          answered_at?: string | null
          audio_url?: string | null
          call_direction?: Database["public"]["Enums"]["call_direction"]
          call_source?: string
          call_status?: string
          checksum?: string | null
          client_upload_id?: string | null
          created_at?: string
          customer_objections?: string[]
          deal_stage?: string | null
          device_id?: string | null
          duration_seconds?: number
          external_call_id?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          is_two_sided?: boolean
          lead_id?: string | null
          mime_type?: string | null
          phone_number?: string
          recorder_source?: string | null
          recording_status?: string
          sentiment?: Database["public"]["Enums"]["call_sentiment"] | null
          started_at?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          stt_duration_ms?: number | null
          stt_error_code?: string | null
          stt_error_message?: string | null
          stt_fallback_used?: boolean
          stt_language?: string | null
          stt_model?: string | null
          stt_provider?: string | null
          stt_request_id?: string | null
          stt_status?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          transcribed_at?: string | null
          transcription_text?: string | null
          updated_at?: string
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reports: {
        Row: {
          agent_id: string | null
          ai_brief: string | null
          ai_brief_at: string | null
          ai_decision: string | null
          ai_suggestion: Json | null
          call_ended_at: string
          call_started_at: string | null
          category: string | null
          connected: boolean
          connection_verified: boolean
          created_at: string
          customer_response: string | null
          device_id: string | null
          duration_seconds: number
          evaluation_answers: Json | null
          evaluation_model: string | null
          evaluation_score: number | null
          follow_up_at: string | null
          follow_up_priority: string | null
          grade: string | null
          id: string
          interest: string | null
          lead_id: string
          next_action: string | null
          next_best_action: string | null
          no_follow_up_note: string | null
          no_follow_up_reason: string | null
          note: string | null
          phone_number: string | null
          reason: string | null
          recording_id: string | null
          requirement: string | null
          smart_reasons: Json | null
          status: string
          submitted_at: string | null
          summary: string | null
          temperature: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          ai_brief?: string | null
          ai_brief_at?: string | null
          ai_decision?: string | null
          ai_suggestion?: Json | null
          call_ended_at?: string
          call_started_at?: string | null
          category?: string | null
          connected?: boolean
          connection_verified?: boolean
          created_at?: string
          customer_response?: string | null
          device_id?: string | null
          duration_seconds?: number
          evaluation_answers?: Json | null
          evaluation_model?: string | null
          evaluation_score?: number | null
          follow_up_at?: string | null
          follow_up_priority?: string | null
          grade?: string | null
          id?: string
          interest?: string | null
          lead_id: string
          next_action?: string | null
          next_best_action?: string | null
          no_follow_up_note?: string | null
          no_follow_up_reason?: string | null
          note?: string | null
          phone_number?: string | null
          reason?: string | null
          recording_id?: string | null
          requirement?: string | null
          smart_reasons?: Json | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          ai_brief?: string | null
          ai_brief_at?: string | null
          ai_decision?: string | null
          ai_suggestion?: Json | null
          call_ended_at?: string
          call_started_at?: string | null
          category?: string | null
          connected?: boolean
          connection_verified?: boolean
          created_at?: string
          customer_response?: string | null
          device_id?: string | null
          duration_seconds?: number
          evaluation_answers?: Json | null
          evaluation_model?: string | null
          evaluation_score?: number | null
          follow_up_at?: string | null
          follow_up_priority?: string | null
          grade?: string | null
          id?: string
          interest?: string | null
          lead_id?: string
          next_action?: string | null
          next_best_action?: string | null
          no_follow_up_note?: string | null
          no_follow_up_reason?: string | null
          note?: string | null
          phone_number?: string | null
          reason?: string | null
          recording_id?: string | null
          requirement?: string | null
          smart_reasons?: Json | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reports_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reports_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reports_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          channel: string
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          lead_id: string | null
          note: string | null
          phone_number: string
          recorded_by: string | null
          source: string
        }
        Insert: {
          channel?: string
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          lead_id?: string | null
          note?: string | null
          phone_number: string
          recorded_by?: string | null
          source?: string
        }
        Update: {
          channel?: string
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          lead_id?: string | null
          note?: string | null
          phone_number?: string
          recorded_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_backup_runs: {
        Row: {
          backup_date: string
          checksum: string | null
          counts: Json
          created_at: string
          error: string | null
          id: string
          size_bytes: number | null
          status: string
        }
        Insert: {
          backup_date: string
          checksum?: string | null
          counts?: Json
          created_at?: string
          error?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
        }
        Update: {
          backup_date?: string
          checksum?: string | null
          counts?: Json
          created_at?: string
          error?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
        }
        Relationships: []
      }
      custom_reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          status: string
          target_metrics: string
          target_range: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: string
          target_metrics: string
          target_range?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: string
          target_metrics?: string
          target_range?: string | null
          title?: string
        }
        Relationships: []
      }
      do_not_contact: {
        Row: {
          added_by: string | null
          channel: string
          created_at: string
          id: string
          phone_number: string
          reason: string | null
          source: string
        }
        Insert: {
          added_by?: string | null
          channel?: string
          created_at?: string
          id?: string
          phone_number: string
          reason?: string | null
          source?: string
        }
        Update: {
          added_by?: string | null
          channel?: string
          created_at?: string
          id?: string
          phone_number?: string
          reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "do_not_contact_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_pages: {
        Row: {
          body_markdown: string
          category: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          sort_order: number
          source: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_markdown?: string
          category?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          sort_order?: number
          source?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_markdown?: string
          category?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          sort_order?: number
          source?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_agent_folders: {
        Row: {
          created_at: string
          folder_id: string
          folder_name: string
          id: string
          last_synced_at: string
          parent_folder_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          folder_name: string
          id?: string
          last_synced_at?: string
          parent_folder_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          folder_name?: string
          id?: string
          last_synced_at?: string
          parent_folder_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_agent_folders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_documents: {
        Row: {
          content: string
          created_at: string
          file_id: string
          folder_id: string | null
          folder_name: string | null
          id: string
          indexed_at: string
          mime_type: string
          modified_time: string | null
          name: string
          updated_at: string
          web_view_link: string | null
          word_count: number
        }
        Insert: {
          content?: string
          created_at?: string
          file_id: string
          folder_id?: string | null
          folder_name?: string | null
          id?: string
          indexed_at?: string
          mime_type?: string
          modified_time?: string | null
          name: string
          updated_at?: string
          web_view_link?: string | null
          word_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          file_id?: string
          folder_id?: string | null
          folder_name?: string | null
          id?: string
          indexed_at?: string
          mime_type?: string
          modified_time?: string | null
          name?: string
          updated_at?: string
          web_view_link?: string | null
          word_count?: number
        }
        Relationships: []
      }
      email_event_receipts: {
        Row: {
          event_key: string
          event_type: string
          id: string
          mailbox: string | null
          payload_hash: string
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          event_key: string
          event_type: string
          id?: string
          mailbox?: string | null
          payload_hash: string
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          event_key?: string
          event_type?: string
          id?: string
          mailbox?: string | null
          payload_hash?: string
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      follow_up_changes: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          correlation_id: string
          follow_up_id: string
          id: string
          lead_id: string | null
          new_scheduled_at: string | null
          new_status: string | null
          note: string | null
          old_note: string | null
          old_reason_code: string | null
          old_scheduled_at: string | null
          old_status: string | null
          reason_code: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string
          follow_up_id: string
          id?: string
          lead_id?: string | null
          new_scheduled_at?: string | null
          new_status?: string | null
          note?: string | null
          old_note?: string | null
          old_reason_code?: string | null
          old_scheduled_at?: string | null
          old_status?: string | null
          reason_code?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string
          follow_up_id?: string
          id?: string
          lead_id?: string | null
          new_scheduled_at?: string | null
          new_status?: string | null
          note?: string | null
          old_note?: string | null
          old_reason_code?: string | null
          old_scheduled_at?: string | null
          old_status?: string | null
          reason_code?: string | null
        }
        Relationships: []
      }
      follow_up_events: {
        Row: {
          agent_id: string | null
          category: string
          completed_at: string | null
          created_at: string
          customer_name: string | null
          customer_response: string | null
          id: string
          lead_id: string
          next_action: string | null
          note: string | null
          notified_at: string | null
          phone_number: string | null
          previous_call_id: string | null
          priority: string
          reason_code: string | null
          recording_id: string | null
          reminder_minutes: number
          report_id: string | null
          reschedule_count: number
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          category: string
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_response?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          note?: string | null
          notified_at?: string | null
          phone_number?: string | null
          previous_call_id?: string | null
          priority?: string
          reason_code?: string | null
          recording_id?: string | null
          reminder_minutes?: number
          report_id?: string | null
          reschedule_count?: number
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_response?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          note?: string | null
          notified_at?: string | null
          phone_number?: string | null
          previous_call_id?: string | null
          priority?: string
          reason_code?: string | null
          recording_id?: string | null
          reminder_minutes?: number
          report_id?: string | null
          reschedule_count?: number
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_events_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "call_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_requirements: {
        Row: {
          active: boolean
          available_units: number | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          location: string | null
          sort_order: number
          total_units: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_units?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          location?: string | null
          sort_order?: number
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_units?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          location?: string | null
          sort_order?: number
          total_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_requirements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      it_notice_recipients: {
        Row: {
          created_at: string
          id: string
          notice_id: string
          profile_id: string
          read_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notice_id: string
          profile_id: string
          read_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notice_id?: string
          profile_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_notice_recipients_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "it_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_notice_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      it_notice_replies: {
        Row: {
          author_label: string
          body: string
          created_at: string
          id: string
          notice_id: string
          profile_id: string | null
        }
        Insert: {
          author_label: string
          body: string
          created_at?: string
          id?: string
          notice_id: string
          profile_id?: string | null
        }
        Update: {
          author_label?: string
          body?: string
          created_at?: string
          id?: string
          notice_id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_notice_replies_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "it_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_notice_replies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      it_notices: {
        Row: {
          audience_role: Database["public"]["Enums"]["app_role"] | null
          audience_type: string
          author_label: string
          author_profile_id: string | null
          body: string
          created_at: string
          expires_at: string | null
          id: string
          published_at: string
          severity: string
          title: string
        }
        Insert: {
          audience_role?: Database["public"]["Enums"]["app_role"] | null
          audience_type?: string
          author_label?: string
          author_profile_id?: string | null
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          published_at?: string
          severity?: string
          title: string
        }
        Update: {
          audience_role?: Database["public"]["Enums"]["app_role"] | null
          audience_type?: string
          author_label?: string
          author_profile_id?: string | null
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          published_at?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_notices_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_versions: {
        Row: {
          action: string
          actor: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          snapshot: Json
          version: number
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          snapshot: Json
          version: number
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      lead_assignments: {
        Row: {
          changed_by: string | null
          created_at: string
          from_agent_id: string | null
          id: string
          lead_id: string
          note: string | null
          source: string
          to_agent_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_agent_id?: string | null
          id?: string
          lead_id: string
          note?: string | null
          source?: string
          to_agent_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_agent_id?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          source?: string
          to_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_classifications: {
        Row: {
          agent_id: string | null
          classified_at: string
          grade: string
          id: string
          lead_id: string
          note: string | null
          report_id: string | null
          source: string
          temperature: string
        }
        Insert: {
          agent_id?: string | null
          classified_at?: string
          grade: string
          id?: string
          lead_id: string
          note?: string | null
          report_id?: string | null
          source?: string
          temperature: string
        }
        Update: {
          agent_id?: string | null
          classified_at?: string
          grade?: string
          id?: string
          lead_id?: string
          note?: string | null
          report_id?: string | null
          source?: string
          temperature?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_classifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_classifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_classifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "call_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_runs: {
        Row: {
          actor_label: string | null
          actor_profile_id: string | null
          created_at: string
          cursor_created_at: string | null
          cursor_lead_id: string | null
          duplicates_skipped: number
          moved: number
          per_agent: number
          status: string
          trigger: string
          updated_at: string
          work_date: string
        }
        Insert: {
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          cursor_created_at?: string | null
          cursor_lead_id?: string | null
          duplicates_skipped?: number
          moved?: number
          per_agent?: number
          status?: string
          trigger?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          cursor_created_at?: string | null
          cursor_lead_id?: string | null
          duplicates_skipped?: number
          moved?: number
          per_agent?: number
          status?: string
          trigger?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_runs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          agent_id: string | null
          created_at: string
          detail: string | null
          id: string
          kind: string
          lead_id: string | null
          recording_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          recording_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          recording_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_extra_grants: {
        Row: {
          agent_profile_id: string
          created_at: string
          granted_by: string | null
          granted_by_label: string | null
          id: string
          quantity: number
          reason: string | null
          source: string
          work_date: string
        }
        Insert: {
          agent_profile_id: string
          created_at?: string
          granted_by?: string | null
          granted_by_label?: string | null
          id?: string
          quantity: number
          reason?: string | null
          source?: string
          work_date: string
        }
        Update: {
          agent_profile_id?: string
          created_at?: string
          granted_by?: string | null
          granted_by_label?: string | null
          id?: string
          quantity?: number
          reason?: string | null
          source?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_extra_grants_agent_profile_id_fkey"
            columns: ["agent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_extra_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_neglect_notices: {
        Row: {
          agent_id: string
          assigned_at: string
          business_date: string
          created_at: string
          id: string
          lead_id: string
          notice_day: number
        }
        Insert: {
          agent_id: string
          assigned_at: string
          business_date: string
          created_at?: string
          id?: string
          lead_id: string
          notice_day: number
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          business_date?: string
          created_at?: string
          id?: string
          lead_id?: string
          notice_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_neglect_notices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_neglect_notices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_neglect_recalls: {
        Row: {
          agent_id: string
          assigned_at: string
          business_date: string
          evidence: Json
          id: string
          lead_id: string
          reason: string
          recalled_at: string
        }
        Insert: {
          agent_id: string
          assigned_at: string
          business_date: string
          evidence?: Json
          id?: string
          lead_id: string
          reason: string
          recalled_at?: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          business_date?: string
          evidence?: Json
          id?: string
          lead_id?: string
          reason?: string
          recalled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_neglect_recalls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_neglect_recalls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_personal_notes: {
        Row: {
          author_label: string | null
          author_profile_id: string | null
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          author_label?: string | null
          author_profile_id?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          author_label?: string | null
          author_profile_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_personal_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_personal_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_phone_keys: {
        Row: {
          canonical_phone: string
          created_at: string
          lead_id: string
        }
        Insert: {
          canonical_phone: string
          created_at?: string
          lead_id: string
        }
        Update: {
          canonical_phone?: string
          created_at?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_phone_keys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_state_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          correlation_id: string
          field: string
          id: string
          lead_id: string
          new_value: string | null
          old_value: string | null
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string
          field: string
          id?: string
          lead_id: string
          new_value?: string | null
          old_value?: string | null
          source?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string
          field?: string
          id?: string
          lead_id?: string
          new_value?: string | null
          old_value?: string | null
          source?: string
        }
        Relationships: []
      }
      lead_year_archives: {
        Row: {
          archive_year: number
          archived_at: string
          archived_by: string | null
          created_at: string
          id: string
          lead_count: number
          note: string | null
          report_count: number
          storage_location: string
        }
        Insert: {
          archive_year: number
          archived_at?: string
          archived_by?: string | null
          created_at?: string
          id?: string
          lead_count?: number
          note?: string | null
          report_count?: number
          storage_location: string
        }
        Update: {
          archive_year?: number
          archived_at?: string
          archived_by?: string | null
          created_at?: string
          id?: string
          lead_count?: number
          note?: string | null
          report_count?: number
          storage_location?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_year_archives_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          area: string | null
          assigned_agent_id: string | null
          assigned_to: string | null
          assignment_source: string | null
          call_attempts: number
          call_count: number | null
          carried_from_date: string | null
          classification_note: string | null
          classified_at: string | null
          classified_by: string | null
          company: string | null
          created_at: string
          grade: string | null
          id: string
          is_verified: boolean
          last_call_at: string | null
          name: string
          notes: string | null
          outcome_category: string | null
          phone_number: string
          reference_by: string | null
          retry_after: string | null
          serial_no: string | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          temperature: string | null
          unanswered_attempts: number
          updated_at: string
          work_date: string | null
          work_state: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          assigned_agent_id?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          call_attempts?: number
          call_count?: number | null
          carried_from_date?: string | null
          classification_note?: string | null
          classified_at?: string | null
          classified_by?: string | null
          company?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          is_verified?: boolean
          last_call_at?: string | null
          name: string
          notes?: string | null
          outcome_category?: string | null
          phone_number: string
          reference_by?: string | null
          retry_after?: string | null
          serial_no?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: string | null
          unanswered_attempts?: number
          updated_at?: string
          work_date?: string | null
          work_state?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          assigned_agent_id?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          call_attempts?: number
          call_count?: number | null
          carried_from_date?: string | null
          classification_note?: string | null
          classified_at?: string | null
          classified_by?: string | null
          company?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          is_verified?: boolean
          last_call_at?: string | null
          name?: string
          notes?: string | null
          outcome_category?: string | null
          phone_number?: string
          reference_by?: string | null
          retry_after?: string | null
          serial_no?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: string | null
          unanswered_attempts?: number
          updated_at?: string
          work_date?: string | null
          work_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_classified_by_fkey"
            columns: ["classified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_audit: {
        Row: {
          action: string
          actor: string
          actor_role: string
          at: string
          billing_period: string | null
          duration_minutes: number | null
          expires_at: string | null
          id: string
          metadata: Json
          new_state: string | null
          previous_state: string | null
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor: string
          actor_role: string
          at?: string
          billing_period?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          actor_role?: string
          at?: string
          billing_period?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
      maintenance_unlock_requests: {
        Row: {
          billing_period: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          duration_minutes: number | null
          id: string
          payment_status_at_request: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at_request: string | null
          reason: string | null
          requested_at: string
          requested_by: string
          requested_hours: number
          status: Database["public"]["Enums"]["maintenance_unlock_status"]
          unlock_expires_at: string | null
          unlock_started_at: string | null
        }
        Insert: {
          billing_period: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          duration_minutes?: number | null
          id?: string
          payment_status_at_request: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at_request?: string | null
          reason?: string | null
          requested_at?: string
          requested_by: string
          requested_hours?: number
          status?: Database["public"]["Enums"]["maintenance_unlock_status"]
          unlock_expires_at?: string | null
          unlock_started_at?: string | null
        }
        Update: {
          billing_period?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          duration_minutes?: number | null
          id?: string
          payment_status_at_request?: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at_request?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string
          requested_hours?: number
          status?: Database["public"]["Enums"]["maintenance_unlock_status"]
          unlock_expires_at?: string | null
          unlock_started_at?: string | null
        }
        Relationships: []
      }
      market_facts: {
        Row: {
          category: string
          created_at: string
          created_by: string
          effective_date: string
          expiry_date: string | null
          geography: string | null
          id: string
          metric: string
          notes: string | null
          review_date: string | null
          source_name: string
          source_url: string | null
          status: string
          unit: string | null
          updated_at: string
          value: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          effective_date: string
          expiry_date?: string | null
          geography?: string | null
          id?: string
          metric: string
          notes?: string | null
          review_date?: string | null
          source_name: string
          source_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          value: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          effective_date?: string
          expiry_date?: string | null
          geography?: string | null
          id?: string
          metric?: string
          notes?: string | null
          review_date?: string | null
          source_name?: string
          source_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          value?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: []
      }
      market_news: {
        Row: {
          ai_model: string | null
          category: string
          created_at: string
          created_by: string
          dedupe_key: string
          headline: string
          id: string
          key_points: Json
          origin: string
          retrieved_excerpt: string | null
          sales_insight: string | null
          source: string | null
          source_name: string | null
          source_published_at: string | null
          source_title: string | null
          source_url: string | null
          status: string
          summary: string
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_model?: string | null
          category?: string
          created_at?: string
          created_by: string
          dedupe_key: string
          headline: string
          id?: string
          key_points?: Json
          origin: string
          retrieved_excerpt?: string | null
          sales_insight?: string | null
          source?: string | null
          source_name?: string | null
          source_published_at?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          summary: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_model?: string | null
          category?: string
          created_at?: string
          created_by?: string
          dedupe_key?: string
          headline?: string
          id?: string
          key_points?: Json
          origin?: string
          retrieved_excerpt?: string | null
          sales_insight?: string | null
          source?: string | null
          source_name?: string | null
          source_published_at?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      market_news_audit: {
        Row: {
          action: string
          actor: string
          created_at: string
          detail: Json | null
          id: string
          news_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          detail?: Json | null
          id?: string
          news_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          detail?: Json | null
          id?: string
          news_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_news_audit_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "market_news"
            referencedColumns: ["id"]
          },
        ]
      }
      market_news_runs: {
        Row: {
          added: number | null
          error: string | null
          fetched: number | null
          finished_at: string | null
          id: string
          lease_until: string
          skipped: number | null
          started_at: string
          status: string
        }
        Insert: {
          added?: number | null
          error?: string | null
          fetched?: number | null
          finished_at?: string | null
          id?: string
          lease_until: string
          skipped?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          added?: number | null
          error?: string | null
          fetched?: number | null
          finished_at?: string | null
          id?: string
          lease_until?: string
          skipped?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      os_event_receipts: {
        Row: {
          api_version: string | null
          attempts: number
          booking_id: string | null
          event_id: string
          event_type: string
          idempotency_key: string
          lead_id: string | null
          outcome: string | null
          payload_sha256: string
          processed_at: string | null
          received_at: string
          status: string
        }
        Insert: {
          api_version?: string | null
          attempts?: number
          booking_id?: string | null
          event_id: string
          event_type: string
          idempotency_key: string
          lead_id?: string | null
          outcome?: string | null
          payload_sha256: string
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          api_version?: string | null
          attempts?: number
          booking_id?: string | null
          event_id?: string
          event_type?: string
          idempotency_key?: string
          lead_id?: string | null
          outcome?: string | null
          payload_sha256?: string
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      pin_rotations: {
        Row: {
          actor_label: string | null
          actor_profile_id: string | null
          hint: string
          id: string
          note: string | null
          reason: string | null
          rotated_at: string
          surface: string
        }
        Insert: {
          actor_label?: string | null
          actor_profile_id?: string | null
          hint: string
          id?: string
          note?: string | null
          reason?: string | null
          rotated_at?: string
          surface: string
        }
        Update: {
          actor_label?: string | null
          actor_profile_id?: string | null
          hint?: string
          id?: string
          note?: string | null
          reason?: string | null
          rotated_at?: string
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_rotations_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_vault: {
        Row: {
          created_at: string
          hint: string
          note: string | null
          secret_cipher: string
          surface: string
          updated_at: string
          updated_by_label: string | null
        }
        Insert: {
          created_at?: string
          hint: string
          note?: string | null
          secret_cipher: string
          surface: string
          updated_at?: string
          updated_by_label?: string | null
        }
        Update: {
          created_at?: string
          hint?: string
          note?: string | null
          secret_cipher?: string
          surface?: string
          updated_at?: string
          updated_by_label?: string | null
        }
        Relationships: []
      }
      pitch_events: {
        Row: {
          action: string
          agent_id: string
          ai_grounded: boolean
          call_id: string | null
          correlation_key: string
          created_at: string
          fact_ids: string[]
          final_text: string | null
          follow_up_id: string | null
          generated_text: string | null
          id: string
          lead_id: string
          objection_code: string
          project: string | null
          template_id: string | null
        }
        Insert: {
          action: string
          agent_id: string
          ai_grounded?: boolean
          call_id?: string | null
          correlation_key: string
          created_at?: string
          fact_ids?: string[]
          final_text?: string | null
          follow_up_id?: string | null
          generated_text?: string | null
          id?: string
          lead_id: string
          objection_code: string
          project?: string | null
          template_id?: string | null
        }
        Update: {
          action?: string
          agent_id?: string
          ai_grounded?: boolean
          call_id?: string | null
          correlation_key?: string
          created_at?: string
          fact_ids?: string[]
          final_text?: string | null
          follow_up_id?: string | null
          generated_text?: string | null
          id?: string
          lead_id?: string
          objection_code?: string
          project?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pitch_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          objection_code: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          objection_code: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          objection_code?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          avatar_hue: number
          created_at: string
          current_call_started_at: string | null
          email: string | null
          employee_id: string | null
          id: string
          is_active: boolean
          last_active_at: string | null
          legal_name: string | null
          name: string
          phone: string | null
          photo_path: string | null
          photo_updated_at: string | null
          pin_hash: string | null
          presence: Database["public"]["Enums"]["agent_presence"]
          requested_role: Database["public"]["Enums"]["app_role"]
          role: Database["public"]["Enums"]["app_role"]
          sim_bound_at: string | null
          sim_number: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          avatar_hue?: number
          created_at?: string
          current_call_started_at?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          legal_name?: string | null
          name: string
          phone?: string | null
          photo_path?: string | null
          photo_updated_at?: string | null
          pin_hash?: string | null
          presence?: Database["public"]["Enums"]["agent_presence"]
          requested_role?: Database["public"]["Enums"]["app_role"]
          role?: Database["public"]["Enums"]["app_role"]
          sim_bound_at?: string | null
          sim_number?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string
          avatar_hue?: number
          created_at?: string
          current_call_started_at?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          legal_name?: string | null
          name?: string
          phone?: string | null
          photo_path?: string | null
          photo_updated_at?: string | null
          pin_hash?: string | null
          presence?: Database["public"]["Enums"]["agent_presence"]
          requested_role?: Database["public"]["Enums"]["app_role"]
          role?: Database["public"]["Enums"]["app_role"]
          sim_bound_at?: string | null
          sim_number?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      project_catalog: {
        Row: {
          created_at: string
          down_payment: string | null
          extra_charges: string | null
          id: string
          image_url: string | null
          installment_plan: string | null
          location: string | null
          name: string
          notes: string | null
          parking_charge: string | null
          price_per_sqft: number | null
          status: string
          total_price: string | null
          unit_sizes: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          down_payment?: string | null
          extra_charges?: string | null
          id?: string
          image_url?: string | null
          installment_plan?: string | null
          location?: string | null
          name: string
          notes?: string | null
          parking_charge?: string | null
          price_per_sqft?: number | null
          status?: string
          total_price?: string | null
          unit_sizes?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          down_payment?: string | null
          extra_charges?: string | null
          id?: string
          image_url?: string | null
          installment_plan?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          parking_charge?: string | null
          price_per_sqft?: number | null
          status?: string
          total_price?: string | null
          unit_sizes?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      project_discussion_notes: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string | null
          note: string
          party: string
          project_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id?: string | null
          note: string
          party: string
          project_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string | null
          note?: string
          party?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_discussion_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_discussion_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sales_updates: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          id: string
          interest: string
          lead_id: string
          note: string | null
          offered_price: number | null
          project_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          interest: string
          lead_id: string
          note?: string | null
          offered_price?: number | null
          project_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interest?: string
          lead_id?: string
          note?: string | null
          offered_price?: number | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sales_updates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sales_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      push_deliveries: {
        Row: {
          created_at: string
          delivered: number
          entity_id: string | null
          error_message: string | null
          event_key: string
          failed: number
          id: string
          kind: string
          provider: string | null
          recipients: number
        }
        Insert: {
          created_at?: string
          delivered?: number
          entity_id?: string | null
          error_message?: string | null
          event_key: string
          failed?: number
          id?: string
          kind: string
          provider?: string | null
          recipients?: number
        }
        Update: {
          created_at?: string
          delivered?: number
          entity_id?: string | null
          error_message?: string | null
          event_key?: string
          failed?: number
          id?: string
          kind?: string
          provider?: string | null
          recipients?: number
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          label: string | null
          last_seen_at: string
          platform: string
          profile_id: string
          revoked_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string
          platform?: string
          profile_id: string
          revoked_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string
          platform?: string
          profile_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      record_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          changes: Json
          id: number
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          changes?: Json
          id?: never
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          changes?: Json
          id?: never
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      recording_doc_backups: {
        Row: {
          created_at: string
          date_key: string
          doc_id: string | null
          drive_file_id: string | null
          drive_file_name: string | null
          drive_file_url: string | null
          drive_folder_id: string | null
          error_message: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_key: string
          doc_id?: string | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_url?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_key?: string
          doc_id?: string | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_url?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      recording_drive_backups: {
        Row: {
          bytes: number | null
          call_recording_id: string | null
          created_at: string
          drive_file_id: string | null
          drive_file_name: string | null
          drive_file_url: string | null
          drive_folder_id: string | null
          error_message: string | null
          id: string
          mime_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bytes?: number | null
          call_recording_id?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_url?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          id?: string
          mime_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bytes?: number | null
          call_recording_id?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_url?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          id?: string
          mime_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_drive_backups_call_recording_id_fkey"
            columns: ["call_recording_id"]
            isOneToOne: true
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_error_issues: {
        Row: {
          fingerprint: string
          first_seen: string
          id: string
          kind: string
          last_seen: string
          message: string
          occurrences: number
          reopened_count: number
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          routes: string[]
          source: string
          status: string
        }
        Insert: {
          fingerprint: string
          first_seen?: string
          id?: string
          kind: string
          last_seen?: string
          message: string
          occurrences?: number
          reopened_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          routes?: string[]
          source?: string
          status?: string
        }
        Update: {
          fingerprint?: string
          first_seen?: string
          id?: string
          kind?: string
          last_seen?: string
          message?: string
          occurrences?: number
          reopened_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          routes?: string[]
          source?: string
          status?: string
        }
        Relationships: []
      }
      runtime_error_occurrences: {
        Row: {
          browser: string | null
          detail: string | null
          id: number
          issue_id: string
          occurred_at: string
          route: string
        }
        Insert: {
          browser?: string | null
          detail?: string | null
          id?: never
          issue_id: string
          occurred_at?: string
          route: string
        }
        Update: {
          browser?: string | null
          detail?: string | null
          id?: never
          issue_id?: string
          occurred_at?: string
          route?: string
        }
        Relationships: [
          {
            foreignKeyName: "runtime_error_occurrences_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "runtime_error_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bill_review_attempts: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          attempted_at: string
          id: string
          ip_hash: string
          reason_code: string
          success: boolean
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          attempted_at?: string
          id?: string
          ip_hash: string
          reason_code: string
          success: boolean
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          attempted_at?: string
          id?: string
          ip_hash?: string
          reason_code?: string
          success?: boolean
        }
        Relationships: []
      }
      service_invoices: {
        Row: {
          amount_bdt: number
          architect_share_bdt: number
          created_at: string
          due_at: string
          grace_until: string
          note: string | null
          paid_at: string | null
          payment_method: string | null
          payment_ref: string | null
          payout_at: string | null
          payout_ref: string | null
          payout_status: string
          period: string
          service_active_until: string | null
          split_at: string | null
          status: string
          system_share_bdt: number
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_by_label: string | null
        }
        Insert: {
          amount_bdt?: number
          architect_share_bdt?: number
          created_at?: string
          due_at: string
          grace_until: string
          note?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          payout_at?: string | null
          payout_ref?: string | null
          payout_status?: string
          period: string
          service_active_until?: string | null
          split_at?: string | null
          status?: string
          system_share_bdt?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_label?: string | null
        }
        Update: {
          amount_bdt?: number
          architect_share_bdt?: number
          created_at?: string
          due_at?: string
          grace_until?: string
          note?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          payout_at?: string | null
          payout_ref?: string | null
          payout_status?: string
          period?: string
          service_active_until?: string | null
          split_at?: string | null
          status?: string
          system_share_bdt?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_invoices_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_sync_events: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          error_text: string | null
          http_status: number | null
          id: string
          operation: string
          outcome: string
          retry_wait_ms: number | null
          surface: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error_text?: string | null
          http_status?: number | null
          id?: string
          operation?: string
          outcome: string
          retry_wait_ms?: number | null
          surface: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error_text?: string | null
          http_status?: number | null
          id?: string
          operation?: string
          outcome?: string
          retry_wait_ms?: number | null
          surface?: string
        }
        Relationships: []
      }
      shift_summaries: {
        Row: {
          agents: Json
          created_at: string
          generated_at: string
          hq_visible: boolean
          id: string
          shift_key: string
          shift_label: string
          totals: Json
          window_end: string
          window_start: string
        }
        Insert: {
          agents?: Json
          created_at?: string
          generated_at?: string
          hq_visible?: boolean
          id?: string
          shift_key: string
          shift_label: string
          totals?: Json
          window_end: string
          window_start: string
        }
        Update: {
          agents?: Json
          created_at?: string
          generated_at?: string
          hq_visible?: boolean
          id?: string
          shift_key?: string
          shift_label?: string
          totals?: Json
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          notes: string | null
          project: string | null
          status: string
          team_calendar_added_at: string | null
          team_calendar_added_by: string | null
          team_calendar_event_id: string | null
          updated_at: string
          updated_by: string | null
          visit_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          notes?: string | null
          project?: string | null
          status?: string
          team_calendar_added_at?: string | null
          team_calendar_added_by?: string | null
          team_calendar_event_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visit_at: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          notes?: string | null
          project?: string | null
          status?: string
          team_calendar_added_at?: string | null
          team_calendar_added_by?: string | null
          team_calendar_event_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visit_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      social_activity_logs: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          link: string | null
          note: string | null
          page_id: string | null
          reply_count: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          link?: string | null
          note?: string | null
          page_id?: string | null
          reply_count?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          link?: string | null
          note?: string | null
          page_id?: string | null
          reply_count?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_activity_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activity_logs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "social_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_pages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          url?: string | null
        }
        Relationships: []
      }
      social_reply_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          buyer_email: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          last_webhook_event_id: string | null
          last_webhook_occurred_at: string | null
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          seats: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_webhook_event_id?: string | null
          last_webhook_occurred_at?: string | null
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          seats?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_webhook_event_id?: string | null
          last_webhook_occurred_at?: string | null
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          seats?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_article_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      support_articles: {
        Row: {
          author_profile_id: string | null
          body_markdown: string
          category_id: string | null
          created_at: string
          id: string
          published_at: string | null
          search_tsv: unknown
          slug: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_profile_id?: string | null
          body_markdown: string
          category_id?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          search_tsv?: unknown
          slug: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_profile_id?: string | null
          body_markdown?: string
          category_id?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          search_tsv?: unknown
          slug?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_articles_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_article_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_canned_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          shortcut: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          shortcut: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          shortcut?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          access_token: string
          ai_handled: boolean
          assignee_profile_id: string | null
          category: string | null
          channel: string
          created_at: string
          customer_id: string
          escalated_at: string | null
          escalation_reason: string | null
          first_customer_message_at: string | null
          first_human_response_at: string | null
          id: string
          intent: string | null
          last_message_at: string
          message_count: number
          priority: string
          resolved_at: string | null
          sentiment: string | null
          sla_due_at: string | null
          status: string
          subject: string | null
          summary: string | null
          tags: string[]
          unread_for_agent: boolean
          unread_for_customer: boolean
          updated_at: string
        }
        Insert: {
          access_token: string
          ai_handled?: boolean
          assignee_profile_id?: string | null
          category?: string | null
          channel?: string
          created_at?: string
          customer_id: string
          escalated_at?: string | null
          escalation_reason?: string | null
          first_customer_message_at?: string | null
          first_human_response_at?: string | null
          id?: string
          intent?: string | null
          last_message_at?: string
          message_count?: number
          priority?: string
          resolved_at?: string | null
          sentiment?: string | null
          sla_due_at?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          tags?: string[]
          unread_for_agent?: boolean
          unread_for_customer?: boolean
          updated_at?: string
        }
        Update: {
          access_token?: string
          ai_handled?: boolean
          assignee_profile_id?: string | null
          category?: string | null
          channel?: string
          created_at?: string
          customer_id?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          first_customer_message_at?: string | null
          first_human_response_at?: string | null
          id?: string
          intent?: string | null
          last_message_at?: string
          message_count?: number
          priority?: string
          resolved_at?: string | null
          sentiment?: string | null
          sla_due_at?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          tags?: string[]
          unread_for_agent?: boolean
          unread_for_customer?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_assignee_profile_id_fkey"
            columns: ["assignee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_csat: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string
          id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          rating: number
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_csat_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_customers: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          name: string | null
          notes: string | null
          phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          ai_citations: Json
          ai_confidence: number | null
          ai_model: string | null
          ai_needs_human: boolean | null
          attachments: Json
          author_kind: string
          author_label: string | null
          author_profile_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          ai_citations?: Json
          ai_confidence?: number | null
          ai_model?: string | null
          ai_needs_human?: boolean | null
          attachments?: Json
          author_kind: string
          author_label?: string | null
          author_profile_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          ai_citations?: Json
          ai_confidence?: number | null
          ai_model?: string | null
          ai_needs_human?: boolean | null
          attachments?: Json
          author_kind?: string
          author_label?: string | null
          author_profile_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notes: {
        Row: {
          author_label: string | null
          author_profile_id: string | null
          body: string
          conversation_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          ticket_id: string | null
        }
        Insert: {
          author_label?: string | null
          author_profile_id?: string | null
          body: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ticket_id?: string | null
        }
        Update: {
          author_label?: string | null
          author_profile_id?: string | null
          body?: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_events: {
        Row: {
          actor_kind: string
          actor_label: string | null
          actor_profile_id: string | null
          created_at: string
          detail: string | null
          id: string
          kind: string
          ticket_id: string
        }
        Insert: {
          actor_kind?: string
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          ticket_id: string
        }
        Update: {
          actor_kind?: string
          actor_label?: string | null
          actor_profile_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_profile_id: string | null
          category: string | null
          conversation_id: string | null
          created_at: string
          created_by_kind: string
          created_by_profile_id: string | null
          customer_id: string
          description: string | null
          id: string
          priority: string
          ref: string
          resolved_at: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_profile_id?: string | null
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_kind?: string
          created_by_profile_id?: string | null
          customer_id: string
          description?: string | null
          id?: string
          priority?: string
          ref?: string
          resolved_at?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_profile_id?: string | null
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_kind?: string
          created_by_profile_id?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          priority?: string
          ref?: string
          resolved_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_profile_id_fkey"
            columns: ["assignee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          agent_id: string | null
          created_at: string
          device_id: string | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json
          processed_at: string | null
          retry_count: number
          status: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action: string | null
          code: string
          created_at: string
          detail: string | null
          id: string
          severity: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action?: string | null
          code: string
          created_at?: string
          detail?: string | null
          id?: string
          severity?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action?: string | null
          code?: string
          created_at?: string
          detail?: string | null
          id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_maintenance: {
        Row: {
          approval_reason: string | null
          approved_by: string | null
          billing_period: string
          created_at: string
          due_date: string
          fee_usd: number
          id: string
          lock_at: string
          lock_status: string
          locked_logged_at: string | null
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at: string | null
          payment_verified_by: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          unlock_expires_at: string | null
          unlock_started_at: string | null
          unlock_status: Database["public"]["Enums"]["maintenance_unlock_status"]
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approved_by?: string | null
          billing_period: string
          created_at?: string
          due_date: string
          fee_usd?: number
          id?: string
          lock_at: string
          lock_status?: string
          locked_logged_at?: string | null
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          unlock_expires_at?: string | null
          unlock_started_at?: string | null
          unlock_status?: Database["public"]["Enums"]["maintenance_unlock_status"]
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approved_by?: string | null
          billing_period?: string
          created_at?: string
          due_date?: string
          fee_usd?: number
          id?: string
          lock_at?: string
          lock_status?: string
          locked_logged_at?: string | null
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["maintenance_payment_status"]
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          unlock_expires_at?: string | null
          unlock_started_at?: string | null
          unlock_status?: Database["public"]["Enums"]["maintenance_unlock_status"]
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      team_support_admins: {
        Row: {
          created_at: string
          profile_id: string
          role_label: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role_label?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_support_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_support_replies: {
        Row: {
          author_kind: string
          author_label: string | null
          author_profile_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_kind: string
          author_label?: string | null
          author_profile_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_kind?: string
          author_label?: string | null
          author_profile_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_support_replies_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_support_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "team_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      team_support_tickets: {
        Row: {
          agent_name: string
          agent_profile_id: string
          agent_role: string
          assigned_profile_id: string | null
          assigned_role: string
          attachment_url: string | null
          category: string
          created_at: string
          device_label: string | null
          id: string
          last_message_at: string
          message: string
          platform: string
          priority: string
          ref: string
          reply_count: number
          resolution_note: string | null
          resolved_at: string | null
          status: string
          subject: string
          unread_for_admin: boolean
          unread_for_agent: boolean
          updated_at: string
        }
        Insert: {
          agent_name: string
          agent_profile_id: string
          agent_role?: string
          assigned_profile_id?: string | null
          assigned_role?: string
          attachment_url?: string | null
          category: string
          created_at?: string
          device_label?: string | null
          id?: string
          last_message_at?: string
          message: string
          platform?: string
          priority?: string
          ref: string
          reply_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          unread_for_admin?: boolean
          unread_for_agent?: boolean
          updated_at?: string
        }
        Update: {
          agent_name?: string
          agent_profile_id?: string
          agent_role?: string
          assigned_profile_id?: string | null
          assigned_role?: string
          attachment_url?: string | null
          category?: string
          created_at?: string
          device_label?: string | null
          id?: string
          last_message_at?: string
          message?: string
          platform?: string
          priority?: string
          ref?: string
          reply_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          unread_for_admin?: boolean
          unread_for_agent?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_support_tickets_agent_profile_id_fkey"
            columns: ["agent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_support_tickets_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      version_data_ledger: {
        Row: {
          agent_id: string | null
          app_version: string | null
          captured_offline: boolean
          client_ref: string | null
          created_offline_at: string | null
          device_id: string | null
          employee_id: string | null
          entity_id: string
          entity_type: string
          id: string
          payload: Json
          restored_at: string | null
          restored_version_code: number | null
          synced_at: string
          version_code: number | null
        }
        Insert: {
          agent_id?: string | null
          app_version?: string | null
          captured_offline?: boolean
          client_ref?: string | null
          created_offline_at?: string | null
          device_id?: string | null
          employee_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json
          restored_at?: string | null
          restored_version_code?: number | null
          synced_at?: string
          version_code?: number | null
        }
        Update: {
          agent_id?: string | null
          app_version?: string | null
          captured_offline?: boolean
          client_ref?: string | null
          created_offline_at?: string | null
          device_id?: string | null
          employee_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json
          restored_at?: string | null
          restored_version_code?: number | null
          synced_at?: string
          version_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "version_data_ledger_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          payload_sha256: string | null
          processed_at: string | null
          provider: string
          signature_valid: boolean
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          payload_sha256?: string | null
          processed_at?: string | null
          provider: string
          signature_valid?: boolean
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payload_sha256?: string | null
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
          status?: string
        }
        Relationships: []
      }
      website_pages: {
        Row: {
          content: string
          created_at: string
          fetched_at: string
          id: string
          title: string | null
          updated_at: string
          url: string
          word_count: number
        }
        Insert: {
          content?: string
          created_at?: string
          fetched_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          url: string
          word_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          fetched_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          url?: string
          word_count?: number
        }
        Relationships: []
      }
      website_visit_requests: {
        Row: {
          created_at: string
          customer_name: string | null
          decided_at: string | null
          decided_by: string | null
          hub_request_id: string
          id: string
          lead_id: string | null
          notes: string | null
          phone: string
          preferred_date: string | null
          preferred_time: string | null
          project: string | null
          site_visit_id: string | null
          status: string
          visitors: number | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          decided_at?: string | null
          decided_by?: string | null
          hub_request_id: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone: string
          preferred_date?: string | null
          preferred_time?: string | null
          project?: string | null
          site_visit_id?: string | null
          status?: string
          visitors?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          decided_at?: string | null
          decided_by?: string | null
          hub_request_id?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone?: string
          preferred_date?: string | null
          preferred_time?: string | null
          project?: string | null
          site_visit_id?: string | null
          status?: string
          visitors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "website_visit_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_visit_requests_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_interactions: {
        Row: {
          agent_id: string | null
          created_at: string
          delivered_at: string | null
          duration_seconds: number | null
          error_detail: string | null
          id: string
          lead_id: string | null
          media_url: string | null
          message_content: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          provider: string
          provider_message_id: string | null
          read_at: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: string
          status_updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          duration_seconds?: number | null
          error_detail?: string | null
          id?: string
          lead_id?: string | null
          media_url?: string | null
          message_content?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: string
          status_updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          duration_seconds?: number | null
          error_detail?: string | null
          id?: string
          lead_id?: string | null
          media_url?: string | null
          message_content?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          status?: string
          status_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_interactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clean_person_name: { Args: { _raw: string }; Returns: string }
      extract_bd_phones: { Args: { _raw: string }; Returns: string[] }
      filter_eligible_lead_ids: {
        Args: { _lead_ids: string[] }
        Returns: {
          lead_id: string
        }[]
      }
      has_active_license: { Args: { check_env?: string }; Returns: boolean }
      has_pending_call_report: { Args: { _agent_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lead_has_work_history: { Args: { _lead_id: string }; Returns: boolean }
      lead_is_recalled_untouched: {
        Args: { _lead_id: string }
        Returns: boolean
      }
      lead_phone_status: {
        Args: { _raw: string }
        Returns: {
          already_worked: boolean
          canonical_phones: string[]
          existing_lead_id: string
        }[]
      }
      lead_phone_was_ever_worked: { Args: { _raw: string }; Returns: boolean }
      normalize_bd_phone: { Args: { _raw: string }; Returns: string }
    }
    Enums: {
      agent_presence: "on_call" | "idle" | "offline"
      app_role: "admin" | "team_leader" | "agent"
      call_direction: "outgoing" | "incoming_callback"
      call_sentiment: "positive" | "neutral" | "negative" | "critical"
      lead_status: "pending" | "contacted" | "follow_up" | "closed"
      maintenance_payment_status: "unpaid" | "pending" | "verified"
      maintenance_unlock_status:
        | "none"
        | "requested"
        | "approved"
        | "denied"
        | "expired"
      message_type: "text" | "voice_note" | "image" | "document"
      sender_type: "agent" | "customer"
      sync_status: "uploaded" | "verified" | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agent_presence: ["on_call", "idle", "offline"],
      app_role: ["admin", "team_leader", "agent"],
      call_direction: ["outgoing", "incoming_callback"],
      call_sentiment: ["positive", "neutral", "negative", "critical"],
      lead_status: ["pending", "contacted", "follow_up", "closed"],
      maintenance_payment_status: ["unpaid", "pending", "verified"],
      maintenance_unlock_status: [
        "none",
        "requested",
        "approved",
        "denied",
        "expired",
      ],
      message_type: ["text", "voice_note", "image", "document"],
      sender_type: ["agent", "customer"],
      sync_status: ["uploaded", "verified", "failed"],
    },
  },
} as const
