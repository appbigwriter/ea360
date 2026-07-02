# Claude Code Hooks

Sistema de governança automática para regras do CLAUDE.md.

## Arquitetura

```
UserPromptSubmit Hooks
└── (all prompts)  → synapse-engine.cjs

PreToolUse Hooks
├── Read          → read-protection.py
├── Write|Edit    → enforce-architecture-first.py
│                 → write-path-validation.py
│                 → mind-clone-governance.py
│                 → code-intel-pretool.cjs
└── Bash          → sql-governance.py
                  → slug-validation.py
                  → enforce-git-push-authority.cjs

PreCompact Hooks
└── (manual+auto)  → precompact-session-digest.cjs
```

## Hooks Disponíveis

### 1. read-protection.py

**Trigger:** `Read`
**Comportamento:** BLOQUEIA (exit 2)

Impede leitura parcial (`limit`/`offset`) em arquivos protegidos:

- `.claude/CLAUDE.md`
- `.claude/rules/*.md`
- `.aiox-core/development/agents/*.md`
- `supabase/docs/SCHEMA.md`
- `package.json`, `tsconfig.json`
- `app/components/ui/icons/icon-map.ts`

### 2. enforce-architecture-first.py

**Trigger:** `Write|Edit`
**Comportamento:** BLOQUEIA (exit 2)

Exige documentação aprovada antes de criar código em paths protegidos:

- `supabase/functions/` → requer doc em `docs/architecture/` ou `docs/approved-plans/`
- `supabase/migrations/` → requer doc ou permite edição de arquivo existente

### 3. write-path-validation.py

**Trigger:** `Write|Edit`
**Comportamento:** AVISA (exit 0 + stderr)

Avisa quando documentos parecem estar no path errado:

- Sessions/handoffs → `docs/sessions/YYYY-MM/`
- Architecture → `docs/architecture/`
- Guides → `docs/guides/`

### 4. sql-governance.py

**Trigger:** `Bash`
**Comportamento:** BLOQUEIA (exit 2)

Intercepta comandos SQL perigosos:

- `CREATE TABLE/VIEW/FUNCTION/TRIGGER`
- `ALTER TABLE`
- `DROP TABLE/VIEW/FUNCTION`
- `CREATE TABLE AS SELECT` (backup proibido)

**Exceções permitidas:**

- `supabase migration` (CLI oficial)
- `pg_dump` (backup/export)

### 5. slug-validation.py

**Trigger:** `Bash`
**Comportamento:** BLOQUEIA (exit 2)

Valida formato snake_case em slugs:

- Pattern: `^[a-z0-9]+(_[a-z0-9]+)*$`
- ✅ `jose_carlos_amorim`
- ❌ `jose-carlos-amorim` (hyphen)
- ❌ `JoseAmorim` (camelCase)

### 6. mind-clone-governance.py

**Trigger:** `Write|Edit`
**Comportamento:** BLOQUEIA (exit 2)

Impede criação de mind clones sem DNA extraído previamente.

**O que é bloqueado:**

- Criar novo arquivo `squads/*/agents/*.md` que pareça ser um mind clone
- Mind clones = agents baseados em pessoas reais (não funcionais)

**O que NÃO é bloqueado:**

- Editar arquivos existentes (permite updates)
- Agents funcionais (identificados por sufixo):
  - `-chief`, `-orchestrator`, `-chair`
  - `-validator`, `-calculator`, `-generator`, `-extractor`, `-analyzer`
  - `-architect`, `-mapper`, `-designer`, `-engineer`
  - `tools-*`, `process-*`, `workflow-*`

**Locais de DNA verificados:**

- `squads/{pack}/data/minds/{agent_id}_dna.yaml`
- `squads/{pack}/data/minds/{agent_id}_dna.md`
- `squads/{pack}/data/{agent_id}-dna.yaml`
- `outputs/minds/{agent_id}/`

**Solução quando bloqueado:**

1. Execute o pipeline de extração de DNA: `/squad-creator` → `*collect-sources` → `*extract-voice-dna` → `*extract-thinking-dna`
2. OU se é agent funcional, renomeie com sufixo apropriado

### 7. enforce-git-push-authority.cjs

**Trigger:** `Bash`
**Comportamento:** BLOQUEIA via `permissionDecision: deny`

Impede operações remotas que são exclusivas do `@devops`:

- `git push`
- `gh pr create`
- `gh pr merge`

**Exceções permitidas:**

- Sessões/comandos com `AIOX_ACTIVE_AGENT=devops`
- Alias compatíveis: `github-devops`, `aiox-devops`

## Exit Codes

| Code  | Significado                                   |
| ----- | --------------------------------------------- |
| 0     | Permitido (operação continua)                 |
| 2     | Bloqueado (operação cancelada, mostra stderr) |
| Outro | Erro não-bloqueante                           |

## Input Format

Hooks recebem JSON via stdin:

```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file",
    "limit": 100
  },
  "cwd": "/Users/alan/Code/mmos"
}
```

## Debugging

Para testar um hook manualmente:

```bash
echo '{"tool_name": "Read", "tool_input": {"file_path": ".claude/CLAUDE.md", "limit": 100}}' | python3 .claude/hooks/read-protection.py
echo $?  # Deve retornar 2 (bloqueado)
```

## Configuração

Hooks são registrados em `.claude/settings.json` (framework, commitado) ou `.claude/settings.local.json` (overrides locais).

**IMPORTANTE:** Claude Code NÃO usa filesystem discovery. Cada hook DEVE ser registrado explicitamente com o evento correto.

### Registro de Hooks JS (.cjs)

| Hook                             | Evento             | Matcher       | Descrição                              |
| -------------------------------- | ------------------ | ------------- | -------------------------------------- |
| `synapse-engine.cjs`             | `UserPromptSubmit` | —             | SYNAPSE context engine                 |
| `code-intel-pretool.cjs`         | `PreToolUse`       | `Write\|Edit` | Code intelligence injection            |
| `enforce-git-push-authority.cjs` | `PreToolUse`       | `Bash`        | Agent Authority para operações remotas |
| `precompact-session-digest.cjs`  | `PreCompact`       | —             | Session digest capture                 |

### Exemplo de Configuração

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/synapse-engine.cjs\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/code-intel-pretool.cjs\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/precompact-session-digest.cjs\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

O installer (`ide-config-generator.js`) usa `HOOK_EVENT_MAP` para registrar automaticamente cada hook no evento correto durante `npx aiox-core install`.

## Manutenção

Para adicionar novo hook:

1. Criar arquivo `.claude/hooks/novo-hook.cjs` (deve ler stdin JSON, mesmo pattern do synapse-engine.cjs)
2. Adicionar mapeamento em `HOOK_EVENT_MAP` no `ide-config-generator.js`
3. Documentar neste README
4. Testar com casos reais

---

_Criado: 2026-01-24_
_Arquitetura: docs/architecture/claude-md-governance-system.md_
