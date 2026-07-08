# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

### Corrigido (Fixed)
- **Modais de Transação:** O estado das modais (como nova despesa/receita) estava retendo dados de edições anteriores na memória ao ser aberto. Adicionada uma limpeza automática (`editingRow = null`) quando as modais são fechadas ou abertas a partir dos atalhos de "+ Despesa / Receita", forçando uma exibição 100% vazia.
- **Fuso Horário:** Valores de data e hora no frontend não consideravam corretamente o offset do fuso horário local, levando a dias que "voltavam" e exibiam transações com dia anterior. Criado um utilitário centralizado (`utils/date.ts`) que formata as datas locais precisamente.
- **Assinaturas:** O dashboard foi corrigido para que o valor total de uma assinatura mensal seja totalmente descontado das métricas ("Custo Fixo" e cartões) somente se estiver paga no mês, ou exibido corretamente se pendente.

### Melhorado (Changed)
- **Limites de Upload (Comprovantes):** Limite de envio de comprovantes (imagens/PDFs) foi aumentado de `5MB` para `15MB` na interface e suporta internamente na infraestrutura até `30MB` (via Nginx e Fastify Backend), viabilizando o upload de fotos de alta resolução feitas por smartphones modernos.
