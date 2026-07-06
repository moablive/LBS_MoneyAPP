<div align="center">
  <h1>💰 MoneyAPP bot (@awl_money_bot)</h1>
  <p>Bot de Telegram do MoneyAPP (Telegraf + TypeScript) — cliente HTTP do backend, extraído do monorepo <a href="https://github.com/moablive/MoneyAPP">MoneyAPP</a> para repositório próprio, no padrão standalone dos demais bots em <code>telegram-bots/</code>.</p>

  <a href="https://t.me/awl_money_bot"><b>🔗 Acessar: @awl_money_bot</b></a>

  <p>
    <a href="https://skillicons.dev">
      <img src="https://skillicons.dev/icons?i=ts,nodejs,docker" alt="Skills" />
    </a>
  </p>
</div>

<br/>

## Arquitetura

O bot é um **cliente HTTP do backend** — não acessa o banco diretamente. Toda
leitura/escrita passa por `moneyapp_backend:3000/api` na rede Docker externa
`awl_network`. A identidade do usuário agora é validada no **LoginHub** e o
bot comunica-se com o backend usando uma `BOT_SERVICE_KEY`.

```
Telegram  ⇄  moneyapp_bot  ──HTTP /api──▶  moneyapp_backend  ⇄  awlsrvDB_postgres
                 ↓          (awl_network)
             LoginHub
```

### Código vendorizado (`src/vendor/`)

No monorepo o bot dependia de dois workspace packages. Como aqui é standalone,
eles foram **copiados** para `src/vendor/` e religados via `paths` do
`tsconfig.json`:

- `@moneyapp/api-client` → `src/vendor/api-client` — cliente HTTP (`fetch`) das rotas `/bot/*` e `/shares/*` do backend.
- `@moneyapp/models` → `src/vendor/models` — schemas/tipos zod compartilhados.

Ambos são puros (sem acesso a banco). Se o **contrato da API do backend mudar**,
re-sincronize essas duas pastas a partir do monorepo (`packages/api-client/src`
e `packages/models/src`).

## 👥 Convites e Gestão de Acessos

O bot suporta a criação de convites com geração de senhas temporárias.
Os usuários administradores podem acessar o menu **"👥 Convidar Pessoas"** no bot, inserir o e-mail do convidado e receber a senha gerada e o link de convite. Isso utiliza o endpoint `/bot/invite` do backend e dispensa a necessidade de adicionar usuários manualmente no arquivo `.env`.

> ⚠️ O usuário convidado precisará obrigatoriamente realizar o primeiro login no Painel Web do MoneyAPP para alterar sua senha antes de poder interagir com o bot.

## 🤖 Inteligência Artificial (Voz e Visão)

O bot possui integrações de IA avançadas para criação de transações:

1. **Voz para Transação**:
   Envie um áudio (ex: "Gastei 50 reais de pão na padaria usando o cartão nubank") e o bot fará:
   - **Transcrição**: Usando o modelo Whisper (via Groq API).
   - **Entendimento (NLU)**: Usando LLM local (Ollama - texto) para extrair valor, descrição, categoria e conta.

2. **OCR de Comprovantes**:
   Envie a imagem de um recibo ou comprovante e o bot fará o reconhecimento visual usando um modelo LLM multimodal local (Ollama - visão), extraindo as informações para criar a transação.

## Variáveis de ambiente

Veja [`.env.example`](.env.example). Lidas e validadas por `src/config.ts`:
- **Core**: `NODE_ENV`, `TELEGRAM_BOT_TOKEN`, `BOT_SERVICE_KEY`, `BACKEND_URL`
- **LoginHub**: `LOGINHUB_API_URL`, `LOGINHUB_APP_ID`
- **Ollama (IA Local)**: `OLLAMA_URL`, `OLLAMA_MODEL` (visão), `OLLAMA_TEXT_MODEL` (texto)
- **Groq**: `GROQ_API_KEY`

As notificações de vencimento são enviadas **apenas via Telegram** (cron diária
às 08:00 em `src/cron/notifications.ts`) — notificando lançamentos que vencem no **próprio dia** e os que vencem em **exatos 7 dias**. Não há mais envio por e-mail.

## Rodar

```bash
# Produção (Docker, na awl_network)
docker compose --env-file .env up -d --build

# Desenvolvimento local
pnpm install
pnpm dev
```

> ⚠️ Apenas **uma** instância pode fazer long-polling com o mesmo
> `TELEGRAM_BOT_TOKEN` ao mesmo tempo (senão a API do Telegram retorna 409).
