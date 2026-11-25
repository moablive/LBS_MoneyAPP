import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { userApi } from '../utils/api.js';
import { env } from '../config.js';
import { brl } from '../utils/format.js';
import { Markup } from 'telegraf';

/**
 * Registro por voz (25/11/2026): o áudio vira uma ou mais linhas na caixa "Registro por
 * voz" do app (POST /voice-entries), sem categoria obrigatória e sem mexer no saldo. A
 * categoria/conta que a IA entende vão só como sugestão; o dono confirma no app.
 */
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');


interface OllamaParsedTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryName: string | null;
  accountName: string | null;
  occurredAt: string | null;
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const blob = new Blob([audioBuffer as any], { type: 'audio/ogg' });
  const formData = new FormData();
  formData.append('file', blob, 'audio.ogg');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'pt');
  
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData as any
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq API Error:', errorText);
    throw new Error(`Groq API error: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.text;
}

async function parseTransactionsWithAI(transcription: string, availableCategories: {name: string, id: string}[], availableAccounts: {name: string, id: string}[]): Promise<OllamaParsedTransaction[]> {
  // Desde 07/10/2026 o texto sai do OmniRoute (tokens de API), não do Ollama
  // local — OMNIROUTE_URL/OMNIROUTE_API_KEY no ../shared.env. A leitura de
  // recibo (scanReceipt/transactions) continua no Ollama, porque é visão.
  const omniUrl = `${(process.env.OMNIROUTE_URL || 'http://172.18.0.1:20128/v1').replace(/\/+$/, '')}/chat/completions`;
  const omniKey = process.env.OMNIROUTE_API_KEY || 'local-key';
  const model = process.env.OMNIROUTE_TEXT_MODEL || 'auto/best-fast';

  const categoryNames = availableCategories.map(c => c.name).join(', ');
  const accountNames = availableAccounts.map(a => a.name).join(', ');

  // Datas de referência pré-computadas, em horário LOCAL. Dois motivos:
  // 1) Modelos pequenos erram aritmética de data. Aferido em 07/2026 no
  //    server_ollama: qwen2.5vl:7b calculando sozinho acertava 1/4 ("ontem" e
  //    "anteontem" voltavam como hoje, "semana passada" também); recebendo as
  //    datas prontas vai 4/4. llama3.1:latest fica 4/4 nos dois casos, então a
  //    mudança é neutra para ele e obrigatória para o VL.
  // 2) O `toISOString()` que havia aqui é UTC: depois das 21h no fuso -03 o
  //    "hoje" informado ao modelo já era o dia seguinte, e toda transação por
  //    voz da noite entrava com data adiantada.
  const TZ = 'America/Sao_Paulo';
  const now = new Date();
  const localDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
  const daysAgo = (n: number) => localDate(new Date(now.getTime() - n * 86_400_000));
  const nowLocal = now.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T');

  const systemPrompt = `
Você é um assistente financeiro que extrai dados de transações a partir de áudios e gera respostas EXCLUSIVAMENTE em JSON, sem texto adicional.
Dada a transcrição de áudio do usuário, identifique CADA conta dita (pode haver mais de uma, ex.: "30 no pão e 80 na farmácia" são duas). Para cada uma, extraia:
1. "description": A descrição curta da despesa ou receita.
2. "amount": O valor numérico da transação (positivo, use ponto como separador decimal).
3. "type": O tipo da transação. Deve ser obrigatoriamente "expense" (para despesas, gastos, pagamentos) ou "income" (para receitas, ganhos, recebimentos).
4. "categoryName": O nome da categoria que melhor se encaixa, baseando-se nestas opções disponíveis: [${categoryNames}]. Se não se encaixar perfeitamente, retorne null.
5. "accountName": O nome da conta/cartão que foi utilizado, baseando-se nestas opções disponíveis: [${accountNames}]. Se não se encaixar perfeitamente, retorne null.
6. "occurredAt": A data e hora da transação, no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss).
Agora é ${nowLocal} (fuso ${TZ}).
Datas de referência JÁ CALCULADAS — use exatamente uma destas, não faça aritmética de data:
  hoje = ${daysAgo(0)}
  ontem = ${daysAgo(1)}
  anteontem = ${daysAgo(2)}
  semana passada = ${daysAgo(7)}
  mês passado = ${daysAgo(30)}
Se a data não for mencionada, use hoje.

Responda um objeto com a lista "itens". Exemplo de saída esperada:
{
  "itens": [
    {
      "description": "Mercado",
      "amount": 150.50,
      "type": "expense",
      "categoryName": "Alimentação",
      "accountName": "Cartão Nubank",
      "occurredAt": "2023-12-01T10:00:00"
    }
  ]
}

Transcrição do usuário: "${transcription}"
`;

  try {
    const response = await fetch(omniUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omniKey}` },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: systemPrompt }],
        stream: false,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OmniRoute API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // O OmniRoute às vezes cerca o JSON com ```json … ``` (o Ollama não punha).
    const conteudo = (data?.choices?.[0]?.message?.content ?? '').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const result = JSON.parse(conteudo);
    const itens: any[] = Array.isArray(result?.itens) ? result.itens : [result];

    return itens.slice(0, 10).map((item) => ({
      description: String(item?.description || 'Registro por voz').slice(0, 255),
      amount: Number(item?.amount) || 0,
      type: item?.type === 'income' ? 'income' as const : 'expense' as const,
      categoryName: item?.categoryName || null,
      accountName: item?.accountName || null,
      occurredAt: item?.occurredAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Erro ao interpretar o áudio:', error);
    throw new Error('Falha na IA');
  }
}

export async function handleVoiceMessage(ctx: BotContext) {
  try {
    if (!ctx.message || !('voice' in ctx.message)) return;

    const voice = ctx.message.voice;
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) {
      return ctx.reply('Seu email não foi encontrado no banco de dados do MoneyAPP!');
    }

    const waitMsg = await ctx.reply('🎙️ Processando seu áudio...');

    // 1. Download do áudio do Telegram
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const audioResponse = await fetch(fileLink.href);
    const arrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 2. Transcrição (Whisper via Groq)
    const transcription = await transcribeAudio(audioBuffer);

    if (!transcription || transcription.trim() === '') {
      await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, 'Não consegui escutar nada no áudio. Pode repetir?');
      return;
    }

    const falado = `🗣️ <i>"${escapeHtml(transcription)}"</i>`;
    await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, `${falado}\n\n🧠 Entendendo...`, { parse_mode: 'HTML' });

    // 3. Contas e categorias, só para a IA sugerir
    const [accounts, expenseCategories, incomeCategories] = await Promise.all([
      userApi.get<{id: string, name: string, type: string}[]>('/accounts', userId),
      userApi.get<{id: string, name: string}[]>('/categories?type=expense', userId),
      userApi.get<{id: string, name: string}[]>('/categories?type=income', userId)
    ]);
    const allCategories = [...expenseCategories, ...incomeCategories];

    // 4. Extração das contas ditas
    const itens = (await parseTransactionsWithAI(transcription, allCategories, accounts)).filter(i => i.amount > 0);

    if (itens.length === 0) {
      await ctx.telegram.editMessageText(
        ctx.chat?.id, waitMsg.message_id, undefined,
        `${falado}\n\n❌ Não achei um valor no áudio. Nada foi salvo — pode repetir dizendo o valor?`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // 5. Grava na caixa Registro por voz. A chave deixa um reenvio do mesmo áudio sem gravar de novo.
    const chave = `${ctx.chat?.id}:${ctx.message.message_id}`;
    const linhas: string[] = [];
    for (const [n, item] of itens.entries()) {
      const categoria = allCategories.find(c => c.name.toLowerCase() === item.categoryName?.toLowerCase());
      const conta = accounts.find(a => a.name.toLowerCase() === item.accountName?.toLowerCase());
      const ocorreu = new Date(item.occurredAt || Date.now());
      await userApi.post('/voice-entries', userId, {
        transcription,
        description: item.description,
        amount: item.amount,
        type: item.type,
        occurredAt: Number.isNaN(ocorreu.getTime()) ? new Date().toISOString() : ocorreu.toISOString(),
        suggestedCategoryId: categoria?.id ?? null,
        suggestedAccountId: conta?.id ?? null,
        externalKey: `${chave}:${n}`,
      });
      linhas.push(`${item.type === 'income' ? '🟢' : '🔴'} <b>${brl(item.amount)}</b> · ${escapeHtml(item.description)}`);
    }

    const resposta = `${falado}\n\n✅ <b>${itens.length > 1 ? `${itens.length} registros salvos` : 'Registro salvo'}</b> em Registro por voz:\n${linhas.join('\n')}\n\n<i>Categorize e confirme pelo app: ainda não entrou no saldo.</i>`;
    await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, resposta, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([Markup.button.callback('↩️ Desfazer', `voz:undo:${chave}`)]),
    });
  } catch (error: any) {
    console.error('Erro no processamento de voz:', error);
    const errorMessage = error.message || 'Erro desconhecido';
    await ctx.reply(`Ocorreu um erro ao processar o áudio: ${errorMessage}`);
  }
}

/** Botão "Desfazer": apaga o que ainda está pendente daquela mensagem de voz. */
export async function handleVoiceUndo(ctx: BotContext & { match: RegExpExecArray }) {
  try {
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) return ctx.answerCbQuery('Usuário não encontrado.');
    const r = await userApi.delete<{ deleted: number }>(`/voice-entries/source/${ctx.match[1]}`, userId);
    await ctx.answerCbQuery(r.deleted > 0 ? 'Desfeito.' : 'Já foi confirmado ou apagado.');
    const original = (ctx.callbackQuery?.message as { text?: string } | undefined)?.text ?? '';
    const falado = original.split('\n')[0] ?? '';
    await ctx.editMessageText(
      `${falado}\n\n↩️ ${r.deleted > 0 ? 'Registro desfeito, nada foi salvo.' : 'Esse registro já não está pendente.'}`,
    ).catch(() => {});
  } catch (error: any) {
    console.error('Erro ao desfazer registro de voz:', error);
    await ctx.answerCbQuery('Não consegui desfazer.').catch(() => {});
  }
}
