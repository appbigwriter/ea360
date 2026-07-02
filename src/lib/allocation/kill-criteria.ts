/**
 * Validação PURA de kill-criteria por experimento (Story 5.6).
 *
 * Toda alocação que contenha canais na faixa "experiment" (Story 5.2 / `risk_band`)
 * exige, OBRIGATORIAMENTE, um kill-criteria preenchido por canal experimental
 * (PRD R4 — "todo experimento com kill-criteria"; F3.2). Sem isso, a submissão é
 * bloqueada com erro descritivo (AC1, AC3).
 *
 * Este módulo contém SOMENTE lógica pura (sem SDK/IO/segredos) para teste
 * determinístico. A persistência em `experiments` (Story 5.1 / AC4) e a leitura dos
 * itens de experimento vivem nas Server Actions (`@/app/app/allocation/actions`).
 *
 * IDS: CREATE (justificado) — gating de submissão por kill-criteria é capacidade nova.
 * Reusar `@/lib/allocation/engine` foi avaliado: aquele módulo distribui verba; o
 * kill-criteria é etapa POSTERIOR à confirmação da alocação (AC5). Compartilham apenas
 * o conceito de faixa "experiment".
 */

/**
 * Dados de kill-criteria de um único canal de experimento (AC2).
 *
 * - `hypothesis`   — o que está sendo testado (obrigatório / NOT NULL na tabela).
 * - `killCriteria` — condição de corte (obrigatório). Ex.: "CPA > R$50 após 30 dias".
 * - `targetMetric` — métrica-alvo (opcional na tabela; coluna nullable da 0015).
 * - `targetValue`  — valor-alvo numérico (opcional).
 * - `deadline`     — data limite ISO `YYYY-MM-DD`; quando presente, deve ser futura.
 */
export type KillCriteriaInput = {
  hypothesis: string;
  killCriteria: string;
  targetMetric?: string | null;
  targetValue?: number | null;
  deadline?: string | null;
};

/** Entrada de kill-criteria associada ao seu `allocation_item` (canal experimental). */
export type KillCriteriaEntry = KillCriteriaInput & {
  /** id do `allocation_items` (FK destino em `experiments`, Story 5.1 AC3). */
  allocationItemId: string;
};

/** Erro de validação de kill-criteria (mensagens descritivas — AC3). */
export class KillCriteriaError extends Error {
  /** ids dos `allocation_items` de experimento sem kill-criteria válido. */
  readonly missingItemIds: string[];
  constructor(message: string, missingItemIds: string[] = []) {
    super(message);
    this.name = "KillCriteriaError";
    this.missingItemIds = missingItemIds;
  }
}

/** `true` quando o texto está preenchido (não vazio após trim). */
export function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida o conteúdo de UM kill-criteria (AC2, AC3). Lança `KillCriteriaError`
 * descritivo se `hypothesis` ou `killCriteria` estiverem vazios, ou se `deadline`,
 * quando informado, não for uma data válida e futura (Dev Note 5.6).
 *
 * `targetMetric`/`targetValue` são opcionais na persistência (colunas nullable da
 * migração 0015); não inventamos obrigatoriedade onde o schema não exige (No
 * Invention — Article IV). A regra de bloqueio do AC3 recai sobre `hypothesis` e
 * `killCriteria`, que são NOT NULL na tabela `experiments`.
 *
 * @param now data de referência para validar `deadline` (default: agora) — injetável
 *            para testes determinísticos.
 */
export function validateKillCriteria(data: KillCriteriaInput, now: Date = new Date()): void {
  if (!isFilled(data.hypothesis)) {
    throw new KillCriteriaError(
      "Hipótese do experimento é obrigatória (o que você está testando)."
    );
  }
  if (!isFilled(data.killCriteria)) {
    throw new KillCriteriaError(
      'Critério de corte (kill-criteria) é obrigatório. Ex.: "CPA > R$50 após 30 dias".'
    );
  }

  if (data.deadline !== undefined && data.deadline !== null && data.deadline !== "") {
    const parsed = new Date(`${data.deadline}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new KillCriteriaError(
        `Deadline inválido: "${String(data.deadline)}". Use uma data no formato AAAA-MM-DD.`
      );
    }
    // Compara apenas a data (zera a hora de `now`) — deadline deve ser futura.
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (parsed.getTime() <= today.getTime()) {
      throw new KillCriteriaError(`Deadline deve ser uma data futura. Recebido: ${data.deadline}.`);
    }
  }

  if (
    data.targetValue !== undefined &&
    data.targetValue !== null &&
    (!Number.isFinite(data.targetValue) || (data.targetValue as number) < 0)
  ) {
    throw new KillCriteriaError(
      `Valor-alvo inválido: ${String(data.targetValue)}. Use um número >= 0.`
    );
  }
}

/**
 * Verifica, ANTES de confirmar a alocação, que TODOS os canais de experimento
 * informados têm kill-criteria preenchido (AC1, AC3). Recebe:
 *   - `experimentItemIds`: ids dos `allocation_items` cuja `risk_band = 'experiment'`.
 *   - `entries`: kill-criteria enviados pelo formulário (AC5), por `allocationItemId`.
 *
 * Lança `KillCriteriaError` listando os ids sem kill-criteria válido (AC3). Canais de
 * faixa "core"/"growth" NÃO entram em `experimentItemIds` e portanto não são exigidos
 * (AC6).
 *
 * @returns as entradas validadas (uma por canal de experimento), prontas para persistir.
 */
export function assertExperimentsHaveKillCriteria(
  experimentItemIds: string[],
  entries: KillCriteriaEntry[],
  now: Date = new Date()
): KillCriteriaEntry[] {
  const byItem = new Map<string, KillCriteriaEntry>();
  for (const entry of entries) {
    if (entry.allocationItemId) byItem.set(entry.allocationItemId, entry);
  }

  const missing: string[] = [];
  const valid: KillCriteriaEntry[] = [];

  for (const itemId of experimentItemIds) {
    const entry = byItem.get(itemId);
    if (!entry) {
      missing.push(itemId);
      continue;
    }
    try {
      validateKillCriteria(entry, now);
      valid.push(entry);
    } catch {
      missing.push(itemId);
    }
  }

  if (missing.length > 0) {
    throw new KillCriteriaError(
      `Submissão bloqueada: ${missing.length} canal(is) de experimento sem kill-criteria preenchido. ` +
        "Defina hipótese e critério de corte para cada experimento antes de confirmar a alocação.",
      missing
    );
  }

  return valid;
}

/** Linha pronta para INSERT em `experiments` (Story 5.1 AC3). */
export type ExperimentRow = {
  allocation_item_id: string;
  hypothesis: string;
  kill_criteria: string;
  target_metric: string | null;
  target_value: number | null;
  deadline: string | null;
  status: "active";
};

/** Normaliza o payload para o formato da tabela `experiments` (Story 5.1 AC3). */
export function toExperimentRow(entry: KillCriteriaEntry): ExperimentRow {
  return {
    allocation_item_id: entry.allocationItemId,
    hypothesis: entry.hypothesis.trim(),
    kill_criteria: entry.killCriteria.trim(),
    target_metric: isFilled(entry.targetMetric) ? entry.targetMetric.trim() : null,
    target_value:
      entry.targetValue !== undefined &&
      entry.targetValue !== null &&
      Number.isFinite(entry.targetValue)
        ? entry.targetValue
        : null,
    deadline:
      entry.deadline !== undefined && entry.deadline !== null && entry.deadline !== ""
        ? entry.deadline
        : null,
    status: "active",
  };
}
