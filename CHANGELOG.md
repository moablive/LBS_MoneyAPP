# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

### Adicionado (Added)
- **Navegação Mensal de Assinaturas & Lançamentos:** Adicionados botões de navegação `<` e `>` no painel de mensalidades para consultar histórico de meses anteriores/futuros sem perder o estado dos itens pagos/pendentes.
- **Vínculo de Transações Existentes:** Nova funcionalidade de vincular uma transação já existente do Livro Caixa a uma assinatura/mensalidade, com busca e destaque automático para lançamentos de valor exato.

### Corrigido (Fixed)
- **Ajuste de Empréstimos (Tachado):** Corrigido comportamento do modal de empréstimos onde a edição do valor negociado aplicava indevidamente o tachado (`~R$ X~`), sincronizando o valor esperado quando for uma alteração simples de montante.
- **Confirmação de Pagamento com Comprovante:** Corrigida validação no modal de confirmação de pagamento de assinaturas/empréstimos para evitar recusas na API por chaves de data legadas ou falta de categoria padrão.
- **Modais de Transação:** O estado das modais (como nova despesa/receita) estava retendo dados de edições anteriores na memória ao ser aberto. Adicionada uma limpeza automática (`editingRow = null`) quando as modais são fechadas ou abertas a partir dos atalhos de "+ Despesa / Receita", forçando uma exibição 100% vazia.
- **Fuso Horário:** Valores de data e hora no frontend não consideravam corretamente o offset do fuso horário local, levando a dias que "voltavam" e exibiam transações com dia anterior. Criado um utilitário centralizado (`utils/date.ts`) que formata as datas locais precisamente.
- **Assinaturas:** O dashboard foi corrigido para que o valor total de uma assinatura mensal seja totalmente descontado das métricas ("Custo Fixo" e cartões) somente se estiver paga no mês, ou exibido corretamente se pendente.

### Melhorado (Changed)
- **Limites de Upload (Comprovantes):** Limite de envio de comprovantes (imagens/PDFs) foi aumentado de `5MB` para `15MB` na interface e suporta internamente na infraestrutura até `30MB` (via Nginx e Fastify Backend), viabilizando o upload de fotos de alta resolução feitas por smartphones modernos.
