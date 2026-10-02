/**
 * Row types mirroring supabase/migrations. Kept by hand (no Supabase CLI in the
 * build); the DB tests in supabase/tests exercise the same columns.
 */
import type { CampaignSettings, CampaignVariant } from './campaign';
import type { CampaignStatus, LeadSource, MessageStatus, RecipientStatus, Role, StageKind, WaAccountStatus } from './constants';

type Timestamp = string;
type UUID = string;

export type Profile = {
  id: UUID;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type WorkspaceSettings = {
  opt_out_keywords?: string[];
  capture_unknown_inbound?: boolean;
  auto_stage_on_send?: boolean;
  auto_stage_on_reply?: boolean;
  company_name?: string;
  currency?: string;
};

export type Workspace = {
  id: UUID;
  name: string;
  timezone: string;
  default_country: string;
  settings: WorkspaceSettings;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type WorkspaceMember = {
  workspace_id: UUID;
  user_id: UUID;
  role: Role;
  created_at: Timestamp;
};

export type WorkspaceInvite = {
  id: UUID;
  workspace_id: UUID;
  email: string | null;
  role: Exclude<Role, 'owner'>;
  token: string;
  invited_by: UUID | null;
  expires_at: Timestamp;
  accepted_at: Timestamp | null;
  accepted_by: UUID | null;
  created_at: Timestamp;
};

export type WorkspaceIntegrations = {
  workspace_id: UUID;
  google_places_api_key: string | null;
  updated_at: Timestamp;
};

export type PipelineStage = {
  id: UUID;
  workspace_id: UUID;
  name: string;
  color: string;
  position: number;
  kind: StageKind;
  created_at: Timestamp;
};

export type ScrapeLog = {
  t: string;
  level: 'info' | 'success' | 'warning' | 'error';
  text: string;
};

export type ScrapeStats = {
  found?: number;
  inserted?: number;
  duplicates?: number;
  no_phone?: number;
  with_website?: number;
  without_website?: number;
  enriched?: number;
  errors?: number;
};

export type ScrapeJob = {
  id: UUID;
  workspace_id: UUID;
  created_by: UUID | null;
  name: string;
  provider: 'places' | 'browser';
  keywords: string[];
  locations: string[];
  queries: string[];
  max_per_query: number;
  enrich: boolean;
  tags: string[];
  assign_to: UUID | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  cancel_requested: boolean;
  progress: { current?: number; total?: number; query?: string };
  stats: ScrapeStats;
  logs: ScrapeLog[];
  error: string | null;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type LeadSocials = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
};

export type Lead = {
  id: UUID;
  workspace_id: UUID;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  phone_raw: string | null;
  phone_type: 'mobile' | 'landline' | 'unknown';
  wa_status: 'unknown' | 'valid' | 'invalid';
  wa_checked_at: Timestamp | null;
  email: string | null;
  website: string | null;
  has_website: boolean;
  address: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  rating: number | null;
  reviews_count: number | null;
  google_maps_url: string | null;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  socials: LeadSocials;
  source: LeadSource;
  scrape_job_id: UUID | null;
  stage_id: UUID | null;
  owner_id: UUID | null;
  tags: string[];
  deal_value: number;
  opted_out: boolean;
  opted_out_at: Timestamp | null;
  last_contacted_at: Timestamp | null;
  last_replied_at: Timestamp | null;
  custom: Record<string, unknown>;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type LeadNote = {
  id: UUID;
  workspace_id: UUID;
  lead_id: UUID;
  author_id: UUID | null;
  body: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Task = {
  id: UUID;
  workspace_id: UUID;
  lead_id: UUID | null;
  title: string;
  due_at: Timestamp | null;
  assignee_id: UUID | null;
  completed_at: Timestamp | null;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Activity = {
  id: UUID;
  workspace_id: UUID;
  lead_id: UUID | null;
  actor_id: UUID | null;
  type: string;
  data: Record<string, unknown>;
  created_at: Timestamp;
};

export type WhatsappAccount = {
  id: UUID;
  workspace_id: UUID;
  owner_id: UUID | null;
  label: string;
  phone: string | null;
  display_name: string | null;
  status: WaAccountStatus;
  desired_state: 'connected' | 'disconnected' | 'logged_out';
  pairing_phone: string | null;
  last_error: string | null;
  connected_at: Timestamp | null;
  last_seen_at: Timestamp | null;
  daily_limit: number;
  warmup_started_at: Timestamp | null;
  shared: boolean;
  paused_until: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type WhatsappLinkCode = {
  account_id: UUID;
  workspace_id: UUID;
  qr: string | null;
  pairing_code: string | null;
  updated_at: Timestamp;
};

export type MessageTemplate = {
  id: UUID;
  workspace_id: UUID;
  name: string;
  category: string;
  body: string;
  media_url: string | null;
  media_type: 'image' | 'document' | 'video' | null;
  media_name: string | null;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CampaignAudience = {
  mode?: 'filters' | 'selection';
  filters?: LeadFilters;
  lead_count?: number;
};

export type Campaign = {
  id: UUID;
  workspace_id: UUID;
  name: string;
  description: string | null;
  status: CampaignStatus;
  created_by: UUID | null;
  audience: CampaignAudience;
  account_ids: UUID[];
  settings: Partial<CampaignSettings>;
  scheduled_at: Timestamp | null;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  paused_reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CampaignStep = {
  id: UUID;
  workspace_id: UUID;
  campaign_id: UUID;
  position: number;
  delay_hours: number;
  variants: CampaignVariant[];
  created_at: Timestamp;
};

export type CampaignRecipient = {
  id: UUID;
  workspace_id: UUID;
  campaign_id: UUID;
  lead_id: UUID;
  account_id: UUID | null;
  status: RecipientStatus;
  steps_sent: number;
  variant_index: number | null;
  delivery: 'none' | 'sent' | 'delivered' | 'read';
  next_send_at: Timestamp | null;
  last_sent_at: Timestamp | null;
  replied_at: Timestamp | null;
  error: string | null;
  attempts: number;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CampaignStats = {
  campaign_id: UUID;
  workspace_id: UUID;
  total: number;
  pending: number;
  waiting: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  skipped: number;
  completed: number;
  last_sent_at: Timestamp | null;
};

export type Conversation = {
  id: UUID;
  workspace_id: UUID;
  account_id: UUID;
  lead_id: UUID;
  assigned_to: UUID | null;
  last_message_at: Timestamp | null;
  last_message_preview: string | null;
  last_direction: 'in' | 'out' | null;
  unread_count: number;
  archived: boolean;
  created_at: Timestamp;
};

export type Message = {
  id: UUID;
  workspace_id: UUID;
  conversation_id: UUID | null;
  lead_id: UUID;
  account_id: UUID | null;
  campaign_id: UUID | null;
  recipient_id: UUID | null;
  step: number | null;
  direction: 'in' | 'out';
  body: string;
  media_url: string | null;
  media_type: 'image' | 'document' | 'video' | 'audio' | 'sticker' | 'other' | null;
  media_name: string | null;
  wa_message_id: string | null;
  status: MessageStatus;
  error: string | null;
  sent_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type EngineJob = {
  id: UUID;
  workspace_id: UUID;
  type: 'verify_whatsapp' | 'enrich_leads';
  payload: { lead_ids?: UUID[]; account_id?: UUID };
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { done?: number; total?: number };
  result: Record<string, number>;
  error: string | null;
  created_by: UUID | null;
  created_at: Timestamp;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
};

export type Notification = {
  id: UUID;
  workspace_id: UUID;
  user_id: UUID;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: Timestamp | null;
  created_at: Timestamp;
};

export type EngineStatus = {
  id: string;
  version: string | null;
  started_at: Timestamp | null;
  heartbeat_at: Timestamp | null;
  info: { sessions?: number; connected?: number; campaigns?: number; scraping?: boolean; browser?: boolean };
};

/** Filters understood by public.filtered_leads(). */
export type LeadFilters = {
  q?: string;
  stage_ids?: UUID[];
  has_website?: boolean;
  cities?: string[];
  categories?: string[];
  tags?: string[];
  owner_ids?: UUID[];
  unassigned?: boolean;
  wa_status?: Lead['wa_status'][];
  phone_types?: Lead['phone_type'][];
  sources?: LeadSource[];
  min_rating?: number;
  min_reviews?: number;
  opted_out?: boolean;
  contacted?: 'never' | 'contacted' | 'replied' | 'not_replied';
  not_contacted_days?: number;
  scrape_job_id?: UUID;
  created_from?: Timestamp;
  created_to?: Timestamp;
  has_phone?: boolean;
  has_email?: boolean;
  sendable?: boolean;
};

export type DashboardOverview = {
  timezone: string;
  days: number;
  leads: { total: number; new_7d: number; new_period: number; with_website: number; without_website: number; on_whatsapp: number; opted_out: number };
  messages: { sent_today: number; sent: number; delivered: number; read: number; failed: number; received: number; leads_messaged: number; leads_replied: number };
  campaigns_active: number;
  accounts_connected: number;
  accounts_total: number;
  won: { count: number; value: number };
  open_value: number;
  series: Array<{ day: string; sent: number; delivered: number; read: number; replies: number; leads: number }>;
  stages: Array<{ id: UUID; name: string; color: string; kind: StageKind; position: number; count: number; value: number }>;
  top_cities: Array<{ name: string; count: number }>;
  top_categories: Array<{ name: string; count: number }>;
};

export type TeamPerformanceRow = {
  user_id: UUID;
  full_name: string;
  email: string;
  role: Role;
  messages_sent: number;
  replies: number;
  leads_owned: number;
  won: number;
  won_value: number;
  accounts_connected: number;
};

export type LeadFacets = {
  cities: Array<{ value: string; count: number }>;
  categories: Array<{ value: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
};

// ---------------------------------------------------------------------------
// Supabase `Database` type for typed clients
// ---------------------------------------------------------------------------

type Rel<Name extends string, Cols extends string[], Ref extends string, RefCols extends string[] = ['id']> = {
  foreignKeyName: Name;
  columns: Cols;
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: RefCols;
};

/** Columns with DB defaults (or generated) are optional on insert. */
type TableDef<Row, Required extends keyof Row, Rels extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, 'id'>;
      workspaces: TableDef<Workspace, 'name'>;
      workspace_members: TableDef<
        WorkspaceMember,
        'workspace_id' | 'user_id',
        [
          Rel<'workspace_members_user_id_fkey', ['user_id'], 'profiles'>,
          Rel<'workspace_members_workspace_id_fkey', ['workspace_id'], 'workspaces'>,
        ]
      >;
      workspace_invites: TableDef<WorkspaceInvite, 'workspace_id'>;
      workspace_integrations: TableDef<WorkspaceIntegrations, 'workspace_id'>;
      pipeline_stages: TableDef<PipelineStage, 'workspace_id' | 'name'>;
      scrape_jobs: TableDef<ScrapeJob, 'workspace_id'>;
      leads: TableDef<Lead, 'workspace_id' | 'business_name'>;
      lead_notes: TableDef<LeadNote, 'workspace_id' | 'lead_id' | 'body'>;
      tasks: TableDef<
        Task,
        'workspace_id' | 'title',
        [Rel<'tasks_workspace_id_lead_id_fkey', ['workspace_id', 'lead_id'], 'leads', ['workspace_id', 'id']>]
      >;
      activities: TableDef<Activity, 'workspace_id' | 'type'>;
      whatsapp_accounts: TableDef<WhatsappAccount, 'workspace_id'>;
      whatsapp_link_codes: TableDef<WhatsappLinkCode, 'account_id' | 'workspace_id'>;
      message_templates: TableDef<MessageTemplate, 'workspace_id' | 'name' | 'body'>;
      campaigns: TableDef<Campaign, 'workspace_id' | 'name'>;
      campaign_steps: TableDef<CampaignStep, 'workspace_id' | 'campaign_id' | 'position'>;
      campaign_recipients: TableDef<
        CampaignRecipient,
        'workspace_id' | 'campaign_id' | 'lead_id',
        [Rel<'campaign_recipients_workspace_id_lead_id_fkey', ['workspace_id', 'lead_id'], 'leads', ['workspace_id', 'id']>]
      >;
      conversations: TableDef<
        Conversation,
        'workspace_id' | 'account_id' | 'lead_id',
        [
          Rel<'conversations_workspace_id_lead_id_fkey', ['workspace_id', 'lead_id'], 'leads', ['workspace_id', 'id']>,
          Rel<'conversations_workspace_id_account_id_fkey', ['workspace_id', 'account_id'], 'whatsapp_accounts', ['workspace_id', 'id']>,
        ]
      >;
      messages: TableDef<Message, 'workspace_id' | 'lead_id' | 'direction'>;
      engine_jobs: TableDef<EngineJob, 'workspace_id' | 'type'>;
      notifications: TableDef<Notification, 'workspace_id' | 'user_id' | 'type' | 'title'>;
      engine_status: TableDef<EngineStatus, 'id'>;
      wa_auth_keys: TableDef<{ account_id: UUID; key: string; value: string; updated_at: Timestamp }, 'account_id' | 'key' | 'value'>;
    };
    Views: {
      campaign_stats: { Row: CampaignStats; Relationships: [] };
    };
    Functions: {
      create_workspace: { Args: { p_name: string; p_timezone?: string; p_country?: string }; Returns: string };
      get_invite: {
        Args: { p_token: string };
        Returns: Array<{ workspace_name: string; role: Role; email: string | null; invited_by_name: string | null; expired: boolean; accepted: boolean }>;
      };
      accept_invite: { Args: { p_token: string }; Returns: string };
      filtered_leads: {
        Args: { p_workspace: string; p_filters?: LeadFilters };
        Returns: Lead[];
        SetofOptions: { from: '*'; to: 'leads'; isOneToOne: false; isSetofReturn: true };
      };
      lead_facets: { Args: { p_workspace: string }; Returns: LeadFacets };
      leads_bulk_action: {
        Args: { p_workspace: string; p_action: string; p_ids?: string[] | null; p_filters?: LeadFilters | null; p_value?: unknown };
        Returns: number;
      };
      delete_stage: { Args: { p_stage: string; p_move_to?: string | null }; Returns: undefined };
      campaign_add_recipients: { Args: { p_campaign: string; p_filters?: LeadFilters | null; p_lead_ids?: string[] | null }; Returns: number };
      campaign_variant_stats: {
        Args: { p_campaign: string };
        Returns: Array<{ step: number; variant_index: number; sent: number; delivered: number; read: number; replied: number }>;
      };
      claim_next_recipient: {
        Args: { p_campaign: string; p_account: string };
        Returns: CampaignRecipient[];
        SetofOptions: { from: '*'; to: 'campaign_recipients'; isOneToOne: false; isSetofReturn: true };
      };
      dashboard_overview: { Args: { p_workspace: string; p_days?: number }; Returns: DashboardOverview };
      team_performance: { Args: { p_workspace: string; p_days?: number }; Returns: TeamPerformanceRow[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
