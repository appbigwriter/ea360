/**
 * Tipos básicos do banco de dados Supabase (Story 1.2 — AC).
 *
 * Este arquivo fornece um tipo `Database` mínimo, compatível com a forma
 * esperada por `@supabase/supabase-js` (`Database['public']['Tables'][T]`),
 * cobrindo explicitamente as tabelas de identidade do MVP (`profiles`,
 * `businesses`) e os enums do schema base (`20260101000000_init_ea360.sql`).
 *
 * Para o schema completo e estritamente tipado, gere via:
 *   `supabase gen types typescript --local > src/types/supabase.ts`
 * Este arquivo serve como base estável até a geração automatizada estar
 * disponível no ambiente com credenciais (ver docs/architecture/database.md).
 */

// --- Enums (espelham `create type ... as enum` da migração base) ---
export type PillarType = "ads" | "afiliacoes" | "parcerias";
export type PaybackLevel = "imediato" | "curto" | "medio" | "longo";
export type ControlLevel = "alto" | "medio" | "baixo";
export type ScaleLevel = "baixa" | "media" | "alta" | "muito_alta";
export type EffortMode = "cash" | "effort" | "mixed";
export type AllocationTier = "nucleo" | "crescimento" | "experimento";
export type InterviewStatus = "rascunho" | "em_andamento" | "concluida";
export type RecommendationStatus = "gerada" | "revisada" | "arquivada";
export type FlagLevel = "verde" | "amarelo" | "vermelho";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// --- Linhas de tabela explicitamente tipadas (identidade) ---
export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  segment: string | null;
  stage: string | null;
  philosophy: Json;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Forma genérica de tabela usada para as demais tabelas do schema (catálogo
 * GOM, entrevistas, recomendações, alocações, etc.) ainda não tipadas
 * estritamente. Permite uso seguro do client sem `any` enquanto a geração
 * automática de tipos não está ativa.
 */
interface GenericTable {
  Row: Record<string, Json>;
  Insert: Record<string, Json>;
  Update: Record<string, Json>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      businesses: {
        Row: BusinessRow;
        Insert: Omit<BusinessRow, "id" | "created_at" | "updated_at"> &
          Partial<Pick<BusinessRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<BusinessRow>;
        Relationships: [];
      };
      gom_pillars: GenericTable;
      gom_categories: GenericTable;
      gom_channels: GenericTable;
      interview_questions: GenericTable;
      interviews: GenericTable;
      interview_answers: GenericTable;
      monetization_profiles: GenericTable;
      recommendations: GenericTable;
      recommendation_items: GenericTable;
      allocations: GenericTable;
      allocation_items: GenericTable;
      experiments: GenericTable;
      risk_flags: GenericTable;
      channel_metrics: GenericTable;
      allocation_reviews: GenericTable;
      oracle_documents: GenericTable;
      compliance_checks: GenericTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      pillar_type: PillarType;
      payback_level: PaybackLevel;
      control_level: ControlLevel;
      scale_level: ScaleLevel;
      effort_mode: EffortMode;
      allocation_tier: AllocationTier;
      interview_status: InterviewStatus;
      recommendation_status: RecommendationStatus;
      flag_level: FlagLevel;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
