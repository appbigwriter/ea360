export const meta = {
  name: "start-project-fbr",
  description:
    "Padrão global FBR: Módulo 0 (deps+modelagem+release, assistido) → autônomo M1 entregáveis (pm) → M2 stories (sm) → M3 conformidade stories×PRD (qa, loop→M2) → M4 implementação (dev) → M5 conformidade da implementação (qa, loop→M4) → M6 revisão final (architect, fixes até versão final). Executores = subagentes Claude aiox-*.",
  phases: [
    { title: "M0-AIOX" },
    { title: "M0-Deps" },
    { title: "M0-Data" },
    { title: "M0-Review" },
    { title: "M1-Entregaveis" },
    { title: "M2-Stories" },
    { title: "M3-QA-Stories" },
    { title: "M4-Implementacao" },
    { title: "M5-QA-Implementacao" },
    { title: "M6-Final" },
  ],
};

// ===========================================================================
// Parametrização (genérico — funciona em qualquer projeto)
// ===========================================================================
const PRD = (args && args.prd) || "prd/prd.md";
const PHASE = (args && args.phase) || "zero"; // 'zero' (assistido) | 'auto' (M1-M6)
const DELIVERABLES = (args && args.deliverablesFile) || "docs/deliverables/MVP-DELIVERABLES.md";
const STORIES_DIR = (args && args.storiesDir) || "docs/stories";
const MAX_STORY_QA_ROUNDS = (args && args.maxStoryQaRounds) || 3;
const MAX_IMPL_ROUNDS = (args && args.maxImplRounds) || 3;
const MAX_FINAL_ROUNDS = (args && args.maxFinalRounds) || 3;

const BASE_RULES = [
  "AUTONOMIA TOTAL: NUNCA pare para perguntar ao humano nem espere confirmação. Decida sozinho e registre como [AUTO-DECISION]: {questão} → {decisão} (motivo). A ÚNICA interação humana do fluxo é a liberação do Módulo Zero — depois dela, execute todas as tarefas em sequência até o fim sem interação.",
  "GESTÃO DE AGENTES É SEMPRE VIA AIOX (aiox-*). Se as skills/agents AIOX não existirem no projeto, provisioná-las faz parte do Módulo Zero. Não modifique o framework L1/L2.",
  `Fonte de verdade: ${PRD} e a seção "Dependências" dele. Não invente requisitos (AIOX Article IV — No Invention).`,
  "Use a stack e as dependências declaradas no PRD / instaladas no Módulo Zero. Não troque de stack por conta própria.",
  "Rode os quality gates do projeto quando existirem (lint, typecheck, test, build).",
  "NÃO rode git push (bloqueado/exclusivo @devops). Commits locais apenas se o projeto pedir.",
  "Diretório compartilhado: trabalho SEQUENCIAL, não paralelize escrita de arquivos.",
  "Nunca exponha segredos no client, logs ou artefatos.",
  ...((args && args.rules) || []),
];
const RULES = BASE_RULES.join("\n- ");

// ===========================================================================
// Schemas
// ===========================================================================
const AIOX_SCHEMA = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["ok", "failed"] },
    aioxPresent: { type: "boolean" },
    skillsPresent: { type: "boolean" },
    provisioned: { type: "boolean" },
    missing: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};
const DEPS_SCHEMA = {
  type: "object",
  required: ["installed"],
  properties: {
    dependencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          type: { type: "string" },
          purpose: { type: "string" },
        },
      },
    },
    installed: { type: "boolean" },
    missingFromPrd: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};
const DATA_SCHEMA = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string" },
    tables: { type: "array", items: { type: "string" } },
    migrations: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};
const RELEASE_SCHEMA = {
  type: "object",
  required: ["verdict"],
  properties: {
    verdict: { type: "string", enum: ["GO", "NO-GO"] },
    blockers: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};
const DELIV_SCHEMA = {
  type: "object",
  required: ["deliverables"],
  properties: {
    deliverables: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, title: { type: "string" }, epic: { type: "string" } },
      },
    },
    file: { type: "string" },
    notes: { type: "string" },
  },
};
const STORY_LIST_SCHEMA = {
  type: "object",
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "file"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          file: { type: "string" },
        },
      },
    },
  },
};
const QA_STORIES_SCHEMA = {
  type: "object",
  required: ["verdict"],
  properties: {
    verdict: { type: "string", enum: ["OK", "NOT-OK"] },
    coveragePct: { type: "number" },
    gaps: { type: "array", items: { type: "string" } },
  },
};
const DEV_SCHEMA = {
  type: "object",
  required: ["storyId", "status"],
  properties: {
    storyId: { type: "string" },
    status: { type: "string", enum: ["done", "partial", "blocked"] },
    filesTouched: { type: "array", items: { type: "string" } },
    lintOk: { type: "boolean" },
    typecheckOk: { type: "boolean" },
    notes: { type: "string" },
  },
};
const QA_IMPL_SCHEMA = {
  type: "object",
  required: ["storyId", "conformant"],
  properties: {
    storyId: { type: "string" },
    conformant: { type: "string", enum: ["YES", "NO"] },
    issues: { type: "array", items: { type: "string" } },
    mustFix: { type: "array", items: { type: "string" } },
  },
};
const FINAL_SCHEMA = {
  type: "object",
  required: ["verdict"],
  properties: {
    verdict: { type: "string", enum: ["CONFORME", "NAO-CONFORME"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string" },
          desc: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
};

// ===========================================================================
// MÓDULO ZERO (assistido) — só roda quando phase='zero'
// ===========================================================================
if (PHASE === "zero") {
  // M0.0 — Bootstrap AIOX: gestão de agentes é sempre via AIOX. Garante o framework e as
  // skills/agents aiox-* ANTES de tudo (o resto do workflow depende deles). Agente genérico,
  // pois aiox-* pode ainda não existir.
  phase("M0-AIOX");
  const aiox = await agent(
    `Você é o SELF-BOOTSTRAP do AIOX. TODA gestão de agentes usa AIOX, então garanta o framework ANTES de qualquer outra coisa — este projeto pode estar VAZIO (só prd/prd.md).\n` +
      `STEP 1 (RESTAURAR): se a pasta .aiox-core/ NÃO existir no diretório atual, restaure do seed global AGORA, executando exatamente: \`bash /c/Users/OEM/.aiox-seed/restore.sh "$(pwd)"\`. Isso repõe .aiox-core, os agentes aiox-* (.claude/agents/), o workflow e a config portável — sem tocar em prd/.\n` +
      `STEP 2 (VERIFICAR): confirme que .aiox-core/ existe e que .claude/agents/aiox-{sm,pm,qa,dev,architect,data-engineer}.md existem. Se ainda faltar e não houver seed (\`/c/Users/OEM/.aiox-seed\`) nem instalador, status=failed.\n` +
      `NÃO modifique L1/L2 do framework.\n` +
      `Retorne status(ok|failed), aioxPresent, skillsPresent, provisioned, missing[], notes.`,
    {
      label: "M0:aiox-bootstrap",
      phase: "M0-AIOX",
      schema: AIOX_SCHEMA,
      agentType: "general-purpose",
    }
  );
  log(
    `M0 AIOX: status=${aiox?.status} | provisioned=${aiox?.provisioned} | faltando=${(aiox?.missing || []).length}`
  );
  if (!aiox || aiox.status !== "ok") {
    return {
      phase: "zero",
      moduleZero: { aiox },
      next: `Módulo Zero BLOQUEADO: AIOX/skills aiox-* ausentes e não provisionáveis automaticamente. Resolver antes de prosseguir: ${(aiox?.missing || []).join("; ")}`,
    };
  }

  phase("M0-Deps");
  const deps = await agent(
    `Você é @architect (Aria). Leia ${PRD} (especialmente a seção "Dependências") e o repositório.\n` +
      `Tarefa: identificar TODAS as dependências do sistema (runtime, libs de produção, devDeps, ferramentas CLI, serviços) necessárias para implementar o PRD, e INSTALAR tudo agora (ex.: criar/atualizar package.json e rodar a instalação).\n` +
      `Se o PRD não listar uma dependência necessária, anote em missingFromPrd e instale mesmo assim, justificando.\n` +
      `REGRAS:\n- ${RULES}\n` +
      `Retorne a lista de dependências, se installed=true, missingFromPrd e notes.`,
    {
      label: "M0:architect-deps",
      phase: "M0-Deps",
      schema: DEPS_SCHEMA,
      agentType: "aiox-architect",
    }
  );
  log(
    `M0 deps: installed=${deps?.installed} | faltando no PRD: ${(deps?.missingFromPrd || []).length}`
  );

  phase("M0-Data");
  const data = await agent(
    `Você é @data-engineer (Dara). Leia ${PRD} (modelo de dados, RLS, índices).\n` +
      `Tarefa: modelagem de dados completa — migrations/schema, políticas RLS e índices, conforme o PRD. Escreva os arquivos de migration no local padrão do projeto.\n` +
      `REGRAS:\n- ${RULES}\n` +
      `Retorne status, tables, migrations e notes.`,
    {
      label: "M0:data-modeling",
      phase: "M0-Data",
      schema: DATA_SCHEMA,
      agentType: "aiox-data-engineer",
    }
  );
  log(`M0 data: status=${data?.status} | tabelas=${(data?.tables || []).length}`);

  phase("M0-Review");
  const release = await agent(
    `Você é @architect atuando como revisor/master de liberação. Revise o resultado do Módulo Zero:\n` +
      `AIOX: ${JSON.stringify(aiox)}\n\nDEPS: ${JSON.stringify(deps)}\n\nDATA: ${JSON.stringify(data)}\n\n` +
      `Verifique: AIOX e agents aiox-* prontos; dependências instaladas e suficientes para o PRD; modelagem de dados coerente com o PRD; nada crítico faltando para iniciar o desenvolvimento.\n` +
      `Escreva um relatório em docs/MODULE-ZERO-RELEASE.md. Decida verdict GO (libera Módulo 1) ou NO-GO (lista blockers).`,
    {
      label: "M0:release-review",
      phase: "M0-Review",
      schema: RELEASE_SCHEMA,
      agentType: "aiox-architect",
    }
  );
  log(`M0 release: ${release?.verdict}`);
  return {
    phase: "zero",
    moduleZero: { aiox, deps, data, release },
    next:
      release?.verdict === "GO"
        ? `Módulo Zero OK. Para iniciar o processo autônomo: Workflow({ name: 'start-project-fbr', args: { phase: 'auto', prd: '${PRD}' } })`
        : `Módulo Zero NO-GO — resolver blockers antes de liberar M1: ${(release?.blockers || []).join("; ")}`,
  };
}

// ===========================================================================
// PROCESSO AUTÔNOMO (phase='auto') — M1 a M6
// ===========================================================================

// --- MÓDULO 1: Entregáveis (aiox-pm) ---
phase("M1-Entregaveis");
const deliv = await agent(
  `Você é @pm (autônomo). Leia ${PRD}. Identifique e LISTE todos os entregáveis mínimos para o sistema estar em conformidade com o PRD, agrupados por épico, cada um rastreável aos critérios de aceite do PRD.\n` +
    `Escreva em ${DELIVERABLES}. REGRAS:\n- ${RULES}\n` +
    `Retorne a lista de deliverables (id/title/epic) e o file.`,
  {
    label: "M1:pm-deliverables",
    phase: "M1-Entregaveis",
    schema: DELIV_SCHEMA,
    agentType: "aiox-pm",
  }
);
log(`M1: ${deliv?.deliverables?.length ?? 0} entregáveis`);

// --- MÓDULO 2 + 3: Stories (sm) + conformidade (qa), loop M3→M2 ---
phase("M2-Stories");
let storyList = await agent(
  `Você é @sm (River, autônomo). Com base em ${DELIVERABLES} e ${PRD}, crie UM arquivo de story por entregável em ${STORIES_DIR}/ (padrão AIOX: {id}.story.md, Status=Draft, AC numerados e testáveis, Tasks/Subtasks, Dev Notes, Testing, File List e QA Results vazios).\n` +
    `IDEMPOTÊNCIA: não recrie stories que já existam — leia e retorne.\n` +
    `REGRAS:\n- ${RULES}\nRetorne a lista (id/title/file).`,
  { label: "M2:sm-stories", phase: "M2-Stories", schema: STORY_LIST_SCHEMA, agentType: "aiox-sm" }
);
log(`M2: ${storyList?.stories?.length ?? 0} stories`);

phase("M3-QA-Stories");
let qa3,
  round = 0;
while (true) {
  qa3 = await agent(
    `Você é @qa (Quinn, autônomo). Audite TODAS as stories em ${STORIES_DIR}/ contra ${PRD} (critérios de aceite) e ${DELIVERABLES}. Cobertura, AC testáveis/rastreáveis, sem requisitos inventados.\n` +
      `Escreva o parecer em ${STORIES_DIR}/STORIES-QA-REVIEW.md. Veredito OK (cobertura>=90%, sem gap crítico) ou NOT-OK (liste gaps acionáveis).`,
    {
      label: `M3:qa-stories${round ? ":r" + round : ""}`,
      phase: "M3-QA-Stories",
      schema: QA_STORIES_SCHEMA,
      agentType: "aiox-qa",
    }
  );
  log(`M3 round ${round}: ${qa3?.verdict} (${qa3?.coveragePct ?? "?"}%)`);
  if (qa3?.verdict === "OK" || round >= MAX_STORY_QA_ROUNDS) break;
  // volta ao M2: sm corrige as lacunas
  await agent(
    `Você é @sm. Corrija/expanda as stories em ${STORIES_DIR}/ para fechar estas lacunas do QA:\n- ${(qa3.gaps || []).join("\n- ")}\nNão invente fora do PRD/entregáveis.`,
    { label: `M2:sm-fix:r${round}`, phase: "M2-Stories", agentType: "aiox-sm" }
  );
  round++;
}

// --- MÓDULO 4 + 5: Implementação (dev) + conformidade (qa), loop M5→M4 ---
const canon = (storyList?.stories || []).slice();
const fixHints = {}; // storyId -> mustFix[] da rodada anterior
let pending = canon.map((s) => s.id);
let outer = 0;
const implResults = {};
while (pending.length && outer <= MAX_IMPL_ROUNDS) {
  // M4: implementa cada story pendente (sequencial)
  phase("M4-Implementacao");
  for (const id of pending) {
    const s = canon.find((x) => x.id === id);
    const hint = fixHints[id]
      ? `O QA reprovou antes. Corrija OBRIGATORIAMENTE:\n- ${fixHints[id].join("\n- ")}\n`
      : "";
    const impl = await agent(
      `Você é @dev (Dex, autônomo). Implemente a STORY ${id} — ${s?.title || ""}.\n` +
        `Leia ${STORIES_DIR}/${id}.story.md e siga seus AC. Reutilize o que stories anteriores criaram (File List). Status Draft → ao terminar marque "Ready for Review", atualize File List e checkboxes, rode lint/typecheck (e build quando fizer sentido).\n` +
        `${hint}REGRAS:\n- ${RULES}\nRetorne storyId, status, filesTouched, lintOk, typecheckOk, notes.`,
      {
        label: `M4:dev:${id}${outer ? ":r" + outer : ""}`,
        phase: "M4-Implementacao",
        schema: DEV_SCHEMA,
        agentType: "aiox-dev",
      }
    );
    implResults[id] = impl;
  }
  // M5: valida conformidade de cada story implementada
  phase("M5-QA-Implementacao");
  const stillFailing = [];
  for (const id of pending) {
    const s = canon.find((x) => x.id === id);
    const v = await agent(
      `Você é @qa (Quinn, autônomo). Valide a conformidade da implementação da STORY ${id} — ${s?.title || ""} com os AC de ${STORIES_DIR}/${id}.story.md e o ${PRD}.\n` +
        `Rode lint/typecheck (e build se aplicável) como evidência. Escreva na seção "QA Results" da story e adicione 1 linha em ${STORIES_DIR}/BUILD-LOG.md ("${id} | <conformant> | <resumo>").\n` +
        `conformant = YES (conforme) ou NO (não-conforme; liste issues e mustFix).`,
      {
        label: `M5:qa:${id}${outer ? ":r" + outer : ""}`,
        phase: "M5-QA-Implementacao",
        schema: QA_IMPL_SCHEMA,
        agentType: "aiox-qa",
      }
    );
    if (v?.conformant === "NO") {
      stillFailing.push(id);
      fixHints[id] = v.mustFix || v.issues || [];
    } else {
      delete fixHints[id];
    }
    log(`M5 ${id}: ${v?.conformant}`);
  }
  pending = stillFailing;
  if (!pending.length) break;
  outer++;
  log(`M5→M4: ${pending.length} story(s) não-conforme, re-implementando (rodada ${outer})`);
}

// --- MÓDULO 6: Revisão final (architect) + fixes (dev) até versão final ---
phase("M6-Final");
let final,
  fround = 0;
while (true) {
  final = await agent(
    `Você é @architect (Aria, autônomo). Revisão FINAL de conformidade do sistema inteiro contra ${PRD} e ${DELIVERABLES}: arquitetura, cobertura dos critérios de aceite, integração entre módulos, segurança. Rode build/typecheck como evidência. Escreva em docs/FINAL-CONFORMANCE-REVIEW.md.\n` +
      `Veredito CONFORME ou NAO-CONFORME (liste issues com severity/desc/fix).`,
    {
      label: `M6:architect${fround ? ":r" + fround : ""}`,
      phase: "M6-Final",
      schema: FINAL_SCHEMA,
      agentType: "aiox-architect",
    }
  );
  log(`M6 round ${fround}: ${final?.verdict} (${(final?.issues || []).length} issues)`);
  if (final?.verdict === "CONFORME" || fround >= MAX_FINAL_ROUNDS || !(final?.issues || []).length)
    break;
  // master ataca os problemas (executados por @dev sob orquestração)
  for (const iss of final.issues) {
    await agent(
      `Você é @dev sob orquestração do master. Corrija o problema de conformidade:\n[${iss.severity}] ${iss.desc}\nFix sugerido: ${iss.fix}\nRode lint/typecheck após corrigir.\nREGRAS:\n- ${RULES}`,
      { label: `M6:fix:r${fround}`, phase: "M6-Final", agentType: "aiox-dev" }
    );
  }
  fround++;
}

const total = canon.length;
const conformes = Object.keys(implResults).filter((id) => !pending.includes(id)).length;
return {
  phase: "auto",
  deliverables: deliv?.deliverables?.length ?? 0,
  storiesQa: qa3?.verdict,
  implementation: { total, conformes, aindaNaoConforme: pending },
  finalReview: final?.verdict,
  finalIssues: (final?.issues || []).length,
};
