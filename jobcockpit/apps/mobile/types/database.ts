/**
 * Handgeschriebene Typen passend zu supabase/migrations/*_initial_schema.sql.
 * VORSCHLAG: Sobald das Supabase-Projekt existiert, mit
 * `npx supabase gen types typescript --linked > types/database.generated.ts` ersetzen.
 */
export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';
export type AppLanguage = 'de' | 'en';
export type ApplicationStatus = 'draft' | 'sent' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
export type ApplicationSource =
  | 'linkedin'
  | 'stepstone'
  | 'indeed'
  | 'xing'
  | 'company_website'
  | 'referral'
  | 'direct'
  | 'other';
export type UsageActionType = 'letter_generated' | 'pdf_exported' | 'cv_uploaded';
export type CoachingStatus = 'scheduled' | 'completed' | 'cancelled';
export type CvFileType = 'pdf' | 'docx';
export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native';

export interface LanguageSkill {
  language: string;
  level: LanguageLevel;
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export interface UserRow extends Timestamps {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  preferred_language: AppLanguage;
  gdpr_consent_at: string | null;
  last_active_at: string;
  deletion_requested_at: string | null;
}

export interface ProfileRow extends Timestamps {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  linkedin_url: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  pitch: string | null;
  current_position: string | null;
  availability: string | null;
  languages: LanguageSkill[];
  skills: string[];
  mobility: string | null;
  phd_topic: string | null;
  highest_degree: string | null;
  university: string | null;
}

export interface CvVersionRow {
  id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_type: CvFileType;
  parsed_content: Json | null;
  is_default: boolean;
  created_at: string;
}

export interface ApplicationRow extends Timestamps {
  id: string;
  user_id: string;
  company_name: string;
  position_title: string;
  location: string | null;
  job_description: string | null;
  company_info: string | null;
  contact_person: string | null;
  reference_number: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  source: ApplicationSource | null;
  salary_offered: number | null;
  next_action_at: string | null;
}

export interface CoverLetterRow {
  id: string;
  application_id: string | null;
  user_id: string;
  cv_version_id: string | null;
  language: AppLanguage;
  content: string;
  generation_prompt: string | null;
  request_hash: string | null;
  model_used: string | null;
  tokens_used: number | null;
  user_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface UsageTrackingRow {
  id: string;
  user_id: string;
  action_type: UsageActionType;
  metadata: Json;
  cost_cents: number;
  created_at: string;
}

export interface CoachRow extends Timestamps {
  id: string;
  user_id: string;
  bio: string | null;
  specialization: string | null;
  hourly_rate_cents: number | null;
  rating_avg: number;
  review_count: number;
  is_verified: boolean;
}

export interface CoachingSessionRow extends Timestamps {
  id: string;
  user_id: string;
  coach_id: string;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: CoachingStatus;
  notes: string | null;
}

export interface CareerCompanyRow {
  id: string;
  name: string;
  category: string;
  careers_url: string;
  headquarters: string | null;
  created_at: string;
}

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow, 'id'>;
      profiles: Table<ProfileRow, 'id'>;
      cv_versions: Table<CvVersionRow, 'user_id' | 'title' | 'file_url' | 'file_type'>;
      applications: Table<ApplicationRow, 'user_id' | 'company_name' | 'position_title'>;
      cover_letters: Table<CoverLetterRow, 'user_id' | 'language' | 'content'>;
      usage_tracking: Table<UsageTrackingRow, 'user_id' | 'action_type'>;
      coaches: Table<CoachRow, 'user_id'>;
      coaching_sessions: Table<CoachingSessionRow, 'user_id' | 'coach_id' | 'scheduled_at'>;
      career_companies: Table<CareerCompanyRow, 'name' | 'category' | 'careers_url'>;
      favorite_companies: Table<
        { user_id: string; company_id: string; created_at: string },
        'user_id' | 'company_id'
      >;
    };
    Views: Record<string, never>;
    Functions: {
      letters_used_this_month: { Args: Record<string, never>; Returns: number };
      request_account_deletion: { Args: Record<string, never>; Returns: string };
      cancel_account_deletion: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      subscription_tier: SubscriptionTier;
      app_language: AppLanguage;
      application_status: ApplicationStatus;
      usage_action_type: UsageActionType;
      coaching_status: CoachingStatus;
      cv_file_type: CvFileType;
    };
    CompositeTypes: Record<string, never>;
  };
}
