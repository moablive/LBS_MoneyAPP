# .githooks — MoneyApp

Git hooks versionados do projeto.

## Ativar (uma vez por clone)
```bash
git config core.hooksPath .githooks
```

## Hooks

### `post-commit` — Lembrete de drift do AI_context
Após cada commit, detecta **quais áreas** o commit alterou e **lembra qual doc do `AI_context/` revisar**. **Não altera nada** — só avisa no terminal.

| Mudou em… | Lembra de revisar |
|---|---|
| `backend/src/routes`, controllers, `app.ts`, `server.ts` | `api-contracts.md` |
| schema / drizzle / migrations / models | `data-model.md` |
| `frontend/src/router.ts` | `project-map.json` (routes) |
| `package.json`, lock, vite/tsconfig, docker-compose | `project-map.json` + `architecture.md` |
| `backend/src/services` / use-cases / domain | `business-rules.md` |
| `.vue`, `.css`, tailwind, components, views | `ui-guidelines.md` |

Teste manual (sem commitar): `./.githooks/post-commit HEAD`

> Filosofia: o `AI_context/` é **curado à mão** (não dá pra auto-gerar). O hook só garante que você não esqueça de atualizar o doc certo quando o código muda.
