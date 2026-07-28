<p align="center">
  <img src="https://img.shields.io/badge/💰_MoneyAPP-Controle_Financeiro_Pessoal-5b8cff?style=for-the-badge&labelColor=0b0f17" alt="MoneyAPP" />
</p>

<p align="center">
  <strong>PWA moderna de controle financeiro pessoal</strong><br/>
  Dashboard premium em dark mode · Transações · Assinaturas · Investimentos · Empréstimos
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-5b8cff?style=flat-square&labelColor=11151f" alt="Version" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.10-22c55e?style=flat-square&logo=nodedotjs&labelColor=11151f" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9.0-f69220?style=flat-square&logo=pnpm&labelColor=11151f" alt="pnpm" />
  <img src="https://img.shields.io/badge/license-private-7a8499?style=flat-square&labelColor=11151f" alt="License" />
  <img src="https://img.shields.io/badge/deploy-docker-2496ED?style=flat-square&logo=docker&labelColor=11151f" alt="Docker" />
</p>

---

## 🛠️ Tech Stack

<p align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=vue,ts,tailwind,vite,pinia,express,nodejs,postgres,docker,nginx&theme=dark" alt="Tech Stack" />
  </a>
</p>

<table align="center">
<tr>
<td align="center"><strong>Frontend</strong></td>
<td align="center"><strong>Backend</strong></td>
<td align="center"><strong>Infra</strong></td>
</tr>
<tr>
<td>

![Vue](https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-FFD859?style=flat-square&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)

</td>
<td>

![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![Node.js](https://img.shields.io/badge/Node_20-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logoColor=black)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![LoginHUB](https://img.shields.io/badge/LoginHUB-7A8499?style=flat-square)

</td>
<td>

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white)
![Cloudflare](https://img.shields.io/badge/CF_Tunnel-F38020?style=flat-square&logo=cloudflare&logoColor=white)

</td>
</tr>
</table>

---

## ✨ Funcionalidades

<table>
<tr>
<td width="50%">

### 📊 Dashboard
Visão geral do mês com resumo financeiro (Saldo Atual, Cartões, Receitas e Despesas), ranking de categorias por gasto, gráfico de evolução cumulativa (mês atual vs. anterior) e **projeção mensal** baseada em recorrências. 
- **Próximos Lançamentos (60 dias):** A lista de controle projeta exatamente **60 dias** no futuro, duplicando assinaturas recorrentes e exibindo os itens de forma **decrescente** (lançamentos mais distantes no topo e os mais próximos da data de hoje no rodapé). Conta com modal de ação rápida ao clicar, permitindo definir uma **Data Auxiliar de Pagamento** para organizar visualmente o lançamento no mês sem alterar a data de vencimento real da entidade.

### 💳 Transações
CRUD completo de receitas e despesas com filtros por período, tipo, categoria e conta. Upload de comprovantes inline de até 15MB na interface (suportado até 30MB via API) (base64 — PNG, JPEG, WebP, PDF).

### 🏦 Contas
Gerenciamento de contas bancárias (corrente, poupança, cartão de crédito, carteira, investimento) com **saldo denormalizado** e atualizado automaticamente. Contas encerradas podem ser marcadas como **históricas** (`freezeBalance`): o saldo congela e fica fora do total. Cartões de crédito têm suas faturas isoladas no painel "Cartões", separadas do "Saldo Atual" geral, garantindo que dívidas não se misturem com o dinheiro disponível.

### 🤝 Empréstimos
Controle de empréstimos concedidos, recebidos e FGTS, com status (ativo/pago), parcelas, valor de retorno esperado e comprovantes. 
- **Transação Inicial Automática:** Ao criar um empréstimo ativo em uma conta, o montante já debita (ou credita) instantaneamente no saldo da conta.
- **Quitação:** Marcar como **pago** exige comprovante e gera uma segunda transação (Transação de Quitação) que credita (ou debita) o **valor de retorno**, consolidando eventuais lucros/juros no seu Livro Caixa de forma totalmente automática. O empréstimo pago sai do atalho de empréstimos e passa a ser exibido riscado.

</td>
<td width="50%">

### 🏷️ Categorias
Categorias tipadas (`expense` / `income`) por usuário com cores customizáveis e suporte completo a emojis no nome.

### 🔄 Assinaturas
Módulo independente para gastos recorrentes (Netflix, aluguel, etc.) com `status` ativo/inativo, dia de cobrança e vínculo a categorias e contas.

### 📈 Investimentos
Acompanhamento de ativos — ações, cripto, renda fixa e fundos. Controle de preço de compra/atual, quantidade, metas (`goal_amount`), taxa de rendimento e índice de referência.

</td>
</tr>
</table>

### 🎨 Destaques de UX

<p align="center">

🌙 **Dark Mode Premium** &nbsp;·&nbsp;
⚡ **Quick Actions** &nbsp;·&nbsp;
📊 **Gráficos Interativos** &nbsp;·&nbsp;
📱 **PWA Instalável** &nbsp;·&nbsp;
🎯 **Empty States com CTAs** &nbsp;·&nbsp;
✨ **Micro-animações**

</p>

---

## 🏗️ Arquitetura

```
moneyapp/
├── 📂 apps/
│   ├── 📂 frontend/              # Vue 3 PWA
│   │   ├── 📂 src/
│   │   │   ├── 📂 api/           # Camada HTTP (fetch wrappers)
│   │   │   ├── 📂 components/    # Componentes reutilizáveis
│   │   │   │   ├── AppShell.vue          # Layout principal (sidebar + content)
│   │   │   │   ├── EmptyState.vue        # Estado vazio com CTA
│   │   │   │   ├── Modal.vue             # Modal base (bottom-sheet / centered)
│   │   │   │   ├── NewTransactionModal   # Formulário de transação
│   │   │   │   ├── NewAccountModal       # Formulário de conta
│   │   │   │   ├── NewCategoryModal      # Formulário de categoria
│   │   │   │   ├── SubscriptionModal     # Formulário de assinatura
│   │   │   │   ├── InvestmentModal       # Formulário de investimento
│   │   │   │   ├── LoanModal             # Formulário de empréstimo
│   │   │   │   └── PiggyBankDetails      # Detalhes de cofrinhos / metas
│   │   │   ├── 📂 data/           # Dados estáticos (registry de bancos, etc.)
│   │   │   ├── 📂 stores/         # Pinia stores
│   │   │   │   ├── auth.ts               # Autenticação + JWT
│   │   │   │   ├── investments.ts        # CRUD investimentos
│   │   │   │   ├── loans.ts              # CRUD empréstimos
│   │   │   │   ├── subscriptions.ts      # CRUD assinaturas
│   │   │   │   ├── transactions.ts       # CRUD transações + filtros
│   │   │   │   ├── categories.ts         # CRUD categorias
│   │   │   │   ├── accounts.ts           # CRUD contas
│   │   │   │   └── dashboard.ts          # Aggregações + projeção
│   │   │   ├── 📂 styles/         # CSS global + design tokens
│   │   │   ├── 📂 views/          # Páginas (1 por rota)
│   │   │   ├── App.vue            # Root + route transitions
│   │   │   ├── main.ts            # Entrypoint
│   │   │   └── router.ts          # Vue Router + auth guard
│   │   └── Dockerfile
│   │
│   ├── 📂 backend/               # API Express
│   │   ├── 📂 src/
│   │   │   ├── 📂 bootstrap/      # Inicialização (master user, etc.)
│   │   │   ├── 📂 config/         # Variáveis de ambiente tipadas
│   │   │   ├── 📂 middleware/     # Auth, error handler, helmet
│   │   │   ├── 📂 routes/         # Endpoints REST agrupados por domínio
│   │   │   ├── 📂 services/       # Lógica de negócio
│   │   │   ├── app.ts             # Express app setup
│   │   │   └── server.ts          # HTTP server entrypoint
│   │   └── Dockerfile
│   │
│   └── 📂 bot/               # Telegram Bot (app_moneyapp_bot)
│
├── 📂 packages/
│   ├── 📂 api-client/            # Cliente HTTP e fetch wrappers
│   ├── 📂 db/                    # Drizzle schema + migrations + client
│   ├── 📂 models/                # Zod schemas e tipos TypeScript
│   └── 📂 services/              # Serviços core (auth, configs, criptografia)
│
├── docker-compose.yml            # 3 serviços (backend + frontend + bot)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Topologia Docker

```mermaid
flowchart LR
  subgraph Client
    PWA["🖥️ Vue 3 PWA<br/>Vite + Pinia + Tailwind"]
  end


  subgraph awl_network["🐳 Docker · awl_network"]
    NGINX["nginx<br/>moneyapp_frontend:80"]
    API["Express + Drizzle<br/>moneyapp_backend:3000"]
    BOT["Telegram Bot<br/>app_moneyapp_bot"]
    PG["PostgreSQL<br/>awlsrvDB_postgres:5432<br/>database 'moneyapp'"]
  end

  PWA -- "HTTPS" --> NGINX
  NGINX -- "/api/*" --> API
  API -- "pg" --> PG
  BOT -- "HTTP /api/*" --> API
```

> [!NOTE]
> O PostgreSQL é um **container externo compartilhado** (`awlsrvDB_postgres`). O MoneyAPP usa um **database dedicado** `moneyapp` (tabelas no schema `public`) para isolar de outras aplicações na mesma instância.

---

## 📦 Modelo de Dados

```mermaid
erDiagram
  users ||--o{ categories    : owns
  users ||--o{ accounts      : owns
  users ||--o{ transactions  : owns
  users ||--o{ subscriptions : owns
  users ||--o{ investments   : owns
  users ||--o{ loans         : owns
  categories ||--o{ transactions  : classifies
  categories ||--o{ subscriptions : classifies
  categories ||--o{ loans         : classifies
  accounts ||--o{ transactions  : funds
  accounts ||--o{ subscriptions : funds
  accounts ||--o{ investments   : custodies
  accounts ||--o{ loans         : custodies
  subscriptions ||--o{ transactions : generates
  investments ||--o{ transactions   : generates
  loans ||--o{ transactions          : generates
```

<table>
<tr>
<td>

| Entidade | Campos-chave |
| -------- | ------------ |
| **users** | `id`, `name`, `email` |
| **categories** | `id`, `userId`, `name`, `type`, `color` |
| **accounts** | `id`, `userId`, `name`, `type`, `currentBalance`, `freezeBalance`, `bankCode` |
| **loans** | `id`, `amount`, `type`, `status`, `accountId`, `categoryId` |

</td>
<td>

| Entidade | Campos-chave |
| -------- | ------------ |
| **transactions** | `id`, `amount` (signed), `type`, `occurredAt`, `categoryId`, `accountId`, `loanId` |
| **subscriptions** | `id`, `description`, `amount`, `status`, `billingDay` |
| **investments** | `id`, `name`, `type`, `quantity`, `buyPrice`, `currentPrice`, `goalAmount` |

</td>
</tr>
</table>

### Convenções

| Convenção | Detalhe |
| --------- | ------- |
| 🔑 PKs | `uuid` com `defaultRandom()` |
| 💰 Monetários | `numeric(14,2)` — nunca `double`. Strings no transporte, `Number()` só p/ agregação |
| 🕒 Timestamps | `timestamptz` (with timezone). Lógica do server em UTC |
| 🗑️ Soft delete | **Não usado.** Hard deletes com FK cascades/restrict |

---

## 🔌 API Endpoints

> Todos sob `/api` · Auth via `Authorization: Bearer <jwt>` · Erros: `{ "error": "<code>", "issues"?: ZodFlatten }`

<table>
<tr><th>Grupo</th><th>Método</th><th>Path</th><th>Schema / Notas</th></tr>
<tr><td>🔐 <strong>Auth</strong></td><td><code>POST</code></td><td><code>/api/auth/login</code></td><td>retorna <code>{ token }</code></td></tr>
<tr><td rowspan="4">🏷️ <strong>Categories</strong></td><td><code>GET</code></td><td><code>/api/categories</code></td><td>query: <code>?type=</code></td></tr>
<tr><td><code>POST</code></td><td><code>/api/categories</code></td><td><code>createCategorySchema</code></td></tr>
<tr><td><code>PATCH</code></td><td><code>/api/categories/:id</code></td><td><code>updateCategorySchema</code></td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/categories/:id</code></td><td>—</td></tr>
<tr><td rowspan="4">🏦 <strong>Accounts</strong></td><td><code>GET</code></td><td><code>/api/accounts</code></td><td>—</td></tr>
<tr><td><code>POST</code></td><td><code>/api/accounts</code></td><td><code>createAccountSchema</code> (inclui <code>freezeBalance</code>)</td></tr>
<tr><td><code>PATCH</code></td><td><code>/api/accounts/:id</code></td><td><code>updateAccountSchema</code></td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/accounts/:id</code></td><td>—</td></tr>
<tr><td rowspan="5">💳 <strong>Transactions</strong></td><td><code>GET</code></td><td><code>/api/transactions</code></td><td>query: <code>transactionFiltersSchema</code></td></tr>
<tr><td><code>POST</code></td><td><code>/api/transactions</code></td><td><code>createTransactionSchema</code></td></tr>
<tr><td><code>PATCH</code></td><td><code>/api/transactions/:id</code></td><td><code>updateTransactionSchema</code></td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/transactions/:id</code></td><td>—</td></tr>
<tr><td><code>GET</code></td><td><code>/api/transactions/:id/receipt</code></td><td>streams decoded base64</td></tr>
<tr><td rowspan="4">🔄 <strong>Subscriptions</strong></td><td><code>GET</code></td><td><code>/api/subscriptions</code></td><td>—</td></tr>
<tr><td><code>POST</code></td><td><code>/api/subscriptions</code></td><td><code>createSubscriptionSchema</code></td></tr>
<tr><td><code>PATCH</code></td><td><code>/api/subscriptions/:id</code></td><td><code>updateSubscriptionSchema</code></td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/subscriptions/:id</code></td><td>—</td></tr>
<tr><td rowspan="4">📈 <strong>Investments</strong></td><td><code>GET</code></td><td><code>/api/investments</code></td><td>—</td></tr>
<tr><td><code>POST</code></td><td><code>/api/investments</code></td><td><code>createInvestmentSchema</code></td></tr>
<tr><td><code>PATCH</code></td><td><code>/api/investments/:id</code></td><td><code>updateInvestmentSchema</code></td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/investments/:id</code></td><td>—</td></tr>
<tr><td rowspan="5">🤝 <strong>Loans</strong></td><td><code>GET</code></td><td><code>/api/loans/summary</code></td><td>retorna <code>LoanSummaryResponse</code></td></tr>
<tr><td><code>POST</code></td><td><code>/api/loans</code></td><td><code>createLoanSchema</code> (parcelas, categoria, comprovante)</td></tr>
<tr><td><code>PUT</code></td><td><code>/api/loans/:id</code></td><td><code>updateLoanSchema</code> — ao pagar, espelha transação</td></tr>
<tr><td><code>DELETE</code></td><td><code>/api/loans/:id</code></td><td>—</td></tr>
<tr><td><code>GET</code></td><td><code>/api/loans/:id/receipt</code></td><td>streams decoded base64</td></tr>
<tr><td rowspan="4">📊 <strong>Dashboard</strong></td><td><code>GET</code></td><td><code>/api/dashboard/summary</code></td><td>query: <code>?month=YYYY-MM</code></td></tr>
<tr><td><code>GET</code></td><td><code>/api/dashboard/categories/ranking</code></td><td><code>categoryRankingQuerySchema</code></td></tr>
<tr><td><code>GET</code></td><td><code>/api/dashboard/spending-evolution</code></td><td>cumulative line series</td></tr>
<tr><td><code>GET</code></td><td><code>/api/dashboard/projection</code></td><td>projeção baseada em recorrências</td></tr>
<tr><td>👤 <strong>Users</strong></td><td><code>PATCH</code></td><td><code>/api/users/me/settings</code></td><td><code>{ requireReceipts?, showTodoAppEvents?, displayName? }</code> — merge no JSONB <code>user_settings.settings</code>; <code>displayName</code> = como o bot chama o usuário (string vazia limpa)</td></tr>
<tr><td>📅 <strong>Calendar</strong></td><td><code>GET</code></td><td><code>/api/calendar</code></td><td><code>?start&amp;end</code> — transações + empréstimos do período, itens <code>{ id, title, date, amount, type, status, category, color, hasReceipt }</code> (<code>id</code> prefixado <code>tx-</code>/<code>loan-</code>). Consumido pelo <strong>TodoAPP</strong> (identidade delegada), que também busca o comprovante em <code>/api/transactions/:id/receipt</code> e <code>/api/loans/:id/receipt</code></td></tr>
<tr><td>🔗 <strong>Integrations</strong></td><td><code>GET</code></td><td><code>/api/integrations/todoapp/tasks</code></td><td><code>?start&amp;end</code> — tarefas do TodoAPP do usuário (via <code>telegramId</code>); ver <a href="#-integração-com-todoapp">Integração com TodoAPP</a></td></tr>
<tr><td rowspan="6">🤖 <strong>Bot</strong> (interno, <code>x-api-key</code>)</td><td><code>GET</code></td><td><code>/api/bot/users/by-telegram/:id</code></td><td>lookup <code>loginhubId</code> por <code>telegramId</code></td></tr>
<tr><td><code>GET</code></td><td><code>/api/bot/users/all</code></td><td>usuários com Telegram vinculado (<code>{ id, telegramId, displayName }</code>)</td></tr>
<tr><td><code>POST</code></td><td><code>/api/bot/link-telegram</code></td><td>vincula <code>telegramId</code> ↔ <code>loginhubId</code></td></tr>
<tr><td><code>GET</code></td><td><code>/api/bot/summaries/by-category</code></td><td>resumo por categoria</td></tr>
<tr><td><code>GET</code></td><td><code>/api/bot/dashboard/summary</code></td><td>saldo atual</td></tr>
<tr><td><code>GET</code></td><td><code>/api/bot/loans/summary</code></td><td>resumo de empréstimos</td></tr>
</table>

---

## 🔐 Autenticação, Senhas e Convites

O MoneyAPP delega toda a gestão de usuários, senhas e autenticação para o **LoginHUB**.
O aplicativo não gerencia mais credenciais locais, master users via `.env`, ou convites diretamente.

### Criação e Convite de Usuários

O administrador do sistema cria os usuários diretamente no painel do LoginHUB (designando a eles acesso ao app MoneyAPP).
- O LoginHUB envia o e-mail de convite com a senha temporária e links de acesso.
- No primeiro acesso ao MoneyAPP com essa senha, o fluxo do LoginHUB intercepta exigindo a troca de senha.
- Após definida a senha definitiva, o usuário pode acessar normalmente o sistema.

### Vínculo com o Bot do Telegram

- É **expressamente bloqueado** usar o bot do Telegram com uma senha temporária. O usuário convidado DEVE acessar o painel web primeiro, mudar a senha e, só então, ir até o Telegram (`/login`) usando o email e a **nova senha personalizada**.
- O bot registrará o seu `telegramId` e liberará os relatórios e notificações automáticas.

---

## 🤖 Telegram Bot

🔗 **[Acessar o Bot: @awl_money_bot](https://t.me/awl_money_bot)**

O bot do Telegram (`app_moneyapp_bot`) é um **cliente HTTP do backend** — conversa com `moneyapp_backend:3000/api` pela rede `awl_network` e **não acessa o banco diretamente**. Agora integrado no `docker-compose.yml` principal da aplicação. O bot também é responsável por enviar notificações diárias de **vencimentos do dia e de exatos 7 dias** — a mensagem usa o **nome de exibição** configurado em Configurações → Preferências (`user_settings.settings.displayName`, ex.: "Patrão Moab, você tem lançamentos vencendo HOJE…").

> [!IMPORTANT]
> O bot **não tem mais `.env` próprio**. Até 07/2026 ele vivia numa subpasta aninhada (`apps/bot/MoneyAPP_BOT/`, um repo git separado — resquício de migração, removida em 28/07/2026) e lia um `.env` de lá; hoje o código está direto em `apps/bot/` e os três serviços usam o mesmo par `env_file: [../shared.env, .env]`, e as variáveis do bot (`TELEGRAM_BOT_TOKEN`, `LOGINHUB_API_URL`, `LOGINHUB_APP_ID`, `OLLAMA_MODEL`, `OLLAMA_TEXT_MODEL`) moram no **`.env` da raiz do MoneyAPP**. `BOT_SERVICE_KEY`, `GROQ_API_KEY` e `OLLAMA_URL` vêm do `../shared.env`; `BACKEND_URL` vem do bloco `environment:` do compose, que tem precedência sobre `env_file`.
>
> Isso é seguro para o backend porque ele valida ambiente com `z.object()` **sem** `.strict()` (`packages/services/src/config/env.ts`) — chave desconhecida é descartada em silêncio, não rejeitada.
>
> Ao adicionar variável do bot, cuidado com `OLLAMA_MODEL`: aqui é o modelo de **visão** (OCR de comprovante), enquanto no MailAPP a mesma variável é o modelo de **texto**. Por causa dessa colisão ela nunca pode subir para o `shared.env`.

---

## 🔗 Integração com TodoAPP

> Documentação completa (fluxos, contratos, troubleshooting): `documentacao/integracao-todoapp-moneyapp.md` no repo de docs do servidor.

A integração é **bidirecional em leitura** e toda **interna** à rede Docker `awl_network` (backend → backend, nada exposto no Cloudflare):

| Direção | Fluxo |
| ------- | ----- |
| **Todo → Money** (dashboard) | `DashboardView` → `GET /api/integrations/todoapp/tasks?start&end` → backend resolve `telegramId` em `user_settings` → `GET http://app_todoapp_backend:3000/api/bot/tasks?telegramId&start&end` com `x-api-key: BOT_SERVICE_KEY`. As tarefas aparecem em **Próximos Lançamentos** (toggle "TodoAPP", `amount: 0`, check verde quando concluídas) |
| **Money → Todo** (calendário) | O backend do TodoAPP chama `GET /api/calendar?start&end` com identidade delegada (`x-api-key` + `x-user-id: <loginhubId no Money>`) e exibe os lançamentos no calendário |

**Pontos-chave:**

- ⚠️ O `loginhub_id` é **por app** (MoneyAPP = app 3, TodoAPP = app 4): o mesmo e-mail tem IDs diferentes em cada app. A junção entre apps é feita pelo **`telegramId`**.
- `BOT_SERVICE_KEY` deve ser **idêntico** nos `.env` do MoneyAPP e do TodoAPP (e no `.env` do bot).
- O toggle do usuário persiste em `user_settings.settings.showTodoAppEvents` (JSONB, via `PATCH /api/users/me/settings`) + localStorage.
- Falha do TodoAPP **não** quebra o dashboard: o fetch tem `.catch(() => [])`.
- `CORS_ORIGIN` inclui `https://todo.astralwavelabel.com`.

---

## 🚀 Quickstart

### Pré-requisitos

<p>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.10-339933?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=11151f" />
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9.0-F69220?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=11151f" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=11151f" />
</p>

### Desenvolvimento Local

```bash
# 1️⃣  Clone o repositório
git clone <repo-url> && cd moneyapp

# 2️⃣  Configure as variáveis de ambiente
cp .env.example .env
# Edite .env:
#   → JWT_SECRET       string aleatória de 32+ chars
#   → DATABASE_URL     connection string (entre aspas simples!)
#   → LOGINHUB_API_URL URL da API do LoginHub
#   → BOT_SERVICE_KEY  Chave de comunicação entre serviços para bot

# 3️⃣  Instale dependências
pnpm install

# 4️⃣  Gere e aplique as migrations
pnpm db:generate          # gera SQL a partir do schema Drizzle
pnpm db:migrate           # aplica no PostgreSQL (database "moneyapp")

# 5️⃣  Inicie o dev server
pnpm dev                  # backend :3000 + frontend :5173
```

### Scripts Disponíveis

| Script | Descrição |
| ------ | --------- |
| `pnpm dev` | ▶️ Backend + Frontend em paralelo (hot reload) |
| `pnpm build` | 📦 Build de produção de todos os workspaces |
| `pnpm lint` | 🔍 Lint em todos os workspaces |
| `pnpm typecheck` | ✅ Verificação de tipos TypeScript |
| `pnpm db:generate` | 🗃️ Gera SQL das migrations a partir do schema |
| `pnpm db:migrate` | 🚀 Aplica migrations pendentes no banco |
| `pnpm db:studio` | 🎛️ Abre o Drizzle Studio (interface visual do DB) |

---

## 🐳 Deploy com Docker

O projeto roda como **3 containers** conectados a um PostgreSQL externo na rede `awl_network`.

```bash
# Garanta que a rede Docker existe
docker network inspect awl_network >/dev/null 2>&1 || docker network create awl_network

# Build e deploy
docker compose --env-file .env up -d --build
```

| Container | Base | Porta | Função |
| --------- | ---- | ----- | ------ |
| `moneyapp_backend` | Node 20 | `3000` (interno) | API REST + healthcheck (migrations via `pnpm db:migrate`, não no boot) |
| `moneyapp_frontend` | nginx | `80` (interno) | Static assets + reverse proxy `/api/` → backend |
| `app_moneyapp_bot` | Node 20 | — | Cliente HTTP Telegram Bot |

> [!IMPORTANT]
> **Ingress em produção**: O tráfego chega via **Cloudflare Tunnel** diretamente ao `moneyapp_frontend:80` dentro da `awl_network`. Nenhuma porta é exposta ao host.

> [!WARNING]
> A string `DATABASE_URL` **deve** estar entre **aspas simples** no `.env`.
> A senha contém caracteres especiais (`#`, `!`, `$$`) que seriam expandidos pelo shell ou Docker Compose com aspas duplas.
> ```env
> # ✅ Correto
> DATABASE_URL='postgres://user:senha%23especial@host:5432/db'
>
> # ❌ Errado — $$ será expandido
> DATABASE_URL="postgres://user:senha$$especial@host:5432/db"
> ```

---

## 🔐 Autenticação & Segurança

| Aspecto | Implementação |
| ------- | ------------- |
| **Identidade** | Centralizada no LoginHUB (IDP) |
| **Tokens** | JWT Bearer emitido pelo LoginHUB, verificado via `JWT_SECRET` compartilhado |
| **Comunicação Bot** | Autenticação inter-serviços via `x-api-key` (`BOT_SERVICE_KEY`) |
| **userId** | Extraído **apenas** de `req.user.id` (provisionado do payload JWT) — nunca do body/query |
| **Segurança HTTP** | Helmet (headers), CORS configurável via env |

---

## 📐 Regras de Negócio

| # | Regra | Detalhe |
| - | ----- | ------- |
| 1 | **Valor assinado** | `expense` → `amount < 0`, `income` → `amount > 0`. Zero nunca é válido |
| 2 | **`type` denormalizado** | Deve sempre corresponder ao sinal do `amount`. Zod schema e update paths validam |
| 3 | **Saldo denormalizado** | `accounts.currentBalance` atualizado na mesma DB transaction ao inserir/editar/deletar |
| 4 | **Receipts** | Inline base64, máx 5 MB decoded. Tipos: `image/png`, `image/jpeg`, `image/webp`, `application/pdf` |
| 5 | **Assinaturas** | Entidades independentes com `subscription_id` nas transações geradas |
| 6 | **Investimentos** | Rastreiam `buy_price` → `current_price`, vinculam transações via `investment_id` |
| 7 | **Empréstimos** | Entidades próprias com `type` (given, received, fgts) que podem opcionalmente vincular a `accountId` |
| 8 | **Empréstimo pago** | Marcar como `paid` exige `categoryId` + comprovante; o backend espelha uma transação na categoria (vínculo `transactions.loanId`) e ajusta o saldo. Pago **com** categoria sai do atalho de empréstimos |
| 9 | **Conta histórica** | `accounts.freezeBalance = true` congela o saldo: pagamentos não o alteram e ele fica **fora** do "Saldo Atual" do dashboard. Cartões de crédito são sempre excluídos do "Saldo Atual", e a flag `freezeBalance` (na UI: "Afeta a soma de Cartões") dita se a fatura entra no total de Cartões. |
| 10 | **Meses UTC** | Comparações month-over-month usam meses de calendário UTC (day 1, 00:00:00Z) |
| 11 | **Projeção** | Combina gastos do mês corrente com recorrências ativas para prever totais |

---

## 🎨 Design System

<table>
<tr>
<td>

| Token | Cor | Uso |
| ----- | --- | --- |
| `surface-base` | ![#0b0f17](https://img.shields.io/badge/-%230b0f17-0b0f17?style=flat-square) `#0b0f17` | Fundo da página |
| `surface-raised` | ![#11151f](https://img.shields.io/badge/-%2311151f-11151f?style=flat-square) `#11151f` | Cards |
| `surface-overlay` | ![#161b27](https://img.shields.io/badge/-%23161b27-161b27?style=flat-square) `#161b27` | Modais, popovers |
| `surface-border` | ![#212737](https://img.shields.io/badge/-%23212737-212737?style=flat-square) `#212737` | Bordas hairline |
| `accent` | ![#5b8cff](https://img.shields.io/badge/-%235b8cff-5b8cff?style=flat-square) `#5b8cff` | Ação primária |
| `income` | ![#22c55e](https://img.shields.io/badge/-%2322c55e-22c55e?style=flat-square) `#22c55e` | Valores positivos |
| `expense` | ![#ef4444](https://img.shields.io/badge/-%23ef4444-ef4444?style=flat-square) `#ef4444` | Valores negativos |
| `muted` | ![#7a8499](https://img.shields.io/badge/-%237a8499-7a8499?style=flat-square) `#7a8499` | Texto secundário |

</td>
<td>

**Tipografia**
- Font: **Inter** (ss01 + cv11)
- Monetários: sempre `tabular-nums`

**Motion**
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- Hover/tap: `150ms`
- Modal in/out: `200–250ms`
- Gráficos: `400–500ms`

**Modais**
- Mobile: bottom-sheet `rounded-t-3xl`
- Desktop: card centralizado `rounded-3xl`

**Loading**
- Skeleton screens — nunca spinners

</td>
</tr>
</table>

---

## 🗺️ Rotas do Frontend

| Rota | View | Descrição |
| ---- | ---- | --------- |
| `/login` | `LoginView` | 🔐 Autenticação (rota pública) |
| `/` | `DashboardView` | 📊 Dashboard com resumo, gráficos e projeção |
| `/transacoes` | `TransactionsView` | 💳 Lista e CRUD de transações |
| `/recorrentes` | `RecurrentsView` | 🔄 Gerenciamento de assinaturas |
| `/contas` | `AccountsView` | 🏦 Gerenciamento de contas |
| `/categorias` | `CategoriesView` | 🏷️ Gerenciamento de categorias |
| `/cartoes` | `CreditCardsView` | 💳 Faturas e cartões de crédito |
| `/investimentos` | `InvestmentsView` | 📈 Portfólio de investimentos |
| `/emprestimos/:type` | `LoansView` | 🤝 Empréstimos por tipo (`receber` / `pagar` / `fgts`) |
| `/configuracoes` | `SettingsView` | ⚙️ Preferências: nome de exibição no bot, comprovantes, saldo por conta |

---

<p align="center">
  <sub>Feito com ☕ por <strong>Guilherme Bonato</strong></sub><br/>
  <sub>Projeto privado — uso pessoal</sub>
</p>
