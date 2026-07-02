# Pré-requisitos do Projeto EA360

Ferramentas e configurações necessárias para desenvolver e executar o EA360 localmente.

## Ferramentas

| Ferramenta       | Versão mínima | Finalidade                                                                           |
| ---------------- | ------------- | ------------------------------------------------------------------------------------ |
| Node.js          | 18+           | Runtime do Next.js                                                                   |
| npm              | 9+            | Gerenciador de pacotes                                                               |
| Git              | 2.x           | Controle de versão                                                                   |
| **Supabase CLI** | 2.x           | Migrations, geração de tipos, ambiente local do Supabase (Postgres + Auth + Storage) |

### Supabase CLI

O Supabase CLI é pré-requisito para o backend (PRD §6). Já está disponível como
dependência de desenvolvimento do projeto (`supabase` em `devDependencies`), podendo
ser invocado via `npx supabase <comando>`. Para instalação global, consulte a
[documentação oficial](https://supabase.com/docs/guides/local-development/cli/getting-started).

Comandos comuns:

```bash
npx supabase --version        # Verificar instalação
npx supabase login            # Autenticar
npx supabase link             # Vincular ao projeto remoto
npx supabase db push          # Aplicar migrations
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. As variáveis abaixo são
**obrigatórias** e validadas na inicialização (`src/lib/env.ts`) — a aplicação
falha com mensagem clara se alguma estiver ausente:

| Variável                        | Exposta no client? | Descrição                                                              |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Sim                | URL pública do projeto Supabase                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim                | Chave anônima (todas as queries passam por RLS)                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Não**            | Chave de serviço — uso exclusivo no servidor, nunca importar no client |

> Segurança: nunca importe `SUPABASE_SERVICE_ROLE_KEY` em código de browser nem a
> exponha em `src/lib/env.ts`.
