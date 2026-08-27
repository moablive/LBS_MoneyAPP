# Migrations arquivadas (até 2026-08-27)

Estas 19 migrations **não são mais executadas**. Elas foram substituídas pelo
`drizzle/0000_baseline.sql`, gerado a partir do schema em 27/08/2026 e validado
contra a produção — 98 colunas, 29 índices, 25 constraints e 8 enums idênticos.

Ficam aqui como documentação de como o banco chegou onde chegou. Não devolva
nenhuma delas para `drizzle/`.

## Por que precisaram sair

A cadeia **não reconstruía o banco**. Quem rodasse o migrator num banco vazio
falhava na `0010_loose_jackal`:

```
error: relation "user_settings" does not exist
```

A tabela `user_settings` existe em produção mas nunca foi criada por migration
nenhuma — apareceu à mão. Como o migrator roda cada migration em transação, a
falha derrubava tudo: o banco de teste terminava com zero tabelas.

Havia mais dois defeitos no caminho:

- **Colisão de índice.** Existiam dois arquivos para cada número de 0011 a 0014
  (ex.: `0011_alter_loginhub_id.sql` e `0011_majestic_gabe_jones.sql`). Só os
  gerados pelo drizzle-kit estavam no journal; os outros quatro eram cirurgia
  de dados escrita à mão.
- **Cirurgia de dados com ID cravado.** As quatro manuais continham coisas como
  `DELETE FROM "transactions" WHERE "loginhub_id" NOT IN (12, 10, 6)`. Elas
  resolveram a migração para o LoginHUB em junho/2026 num banco específico, e
  **jamais poderiam rodar num banco novo** — apagariam todo usuário fora
  daquela lista. Por isso nunca foram journaladas, e por isso não entram no
  baseline: o efeito delas já está no estado do banco, não na definição dele.

## A regra que faltava

1. **Migration aplicada não se edita.** Precisa mudar? Gera uma nova.
2. **Limpeza de dados pontual não é migration.** Vai para script avulso, fora
   de `drizzle/`, com o nome de quem rodou e quando.
3. **Mudança de schema não se faz à mão no psql.** Foi assim que `user_settings`
   e o índice `telegram_link_tokens_expira_idx` passaram a existir sem que o
   repositório soubesse — e é o que quebrou a cadeia.
