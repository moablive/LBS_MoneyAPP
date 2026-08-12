import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { userApi } from '../utils/api.js';
import { env } from '../config.js';
import { brl } from '../utils/format.js';


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

async function parseTransactionWithOllama(transcription: string, availableCategories: {name: string, id: string}[], availableAccounts: {name: string, id: string}[]): Promise<OllamaParsedTransaction> {
  const ollamaUrl = `${env.OLLAMA_URL}/api/generate`;
  const model = env.OLLAMA_TEXT_MODEL;

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
Dada a transcrição de áudio do usuário, você deve identificar:
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

Exemplo de saída esperada:
{
  "description": "Mercado",
  "amount": 150.50,
  "type": "expense",
  "categoryName": "Alimentação",
  "accountName": "Cartão Nubank",
  "occurredAt": "2023-12-01T10:00:00"
}

Transcrição do usuário: "${transcription}"
`;

  try {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: systemPrompt,
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.response);
    
    return {
      description: result.description || 'Transação sem nome',
      amount: Number(result.amount) || 0,
      type: result.type === 'income' ? 'income' : 'expense',
      categoryName: result.categoryName || null,
      accountName: result.accountName || null,
      occurredAt: result.occurredAt || new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao conectar ao Ollama:', error);
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
      await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, 'Não consegui escutar nada no áudio.');
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.chat?.id, 
      waitMsg.message_id, 
      undefined, 
      `🗣️ <i>"${transcription}"</i>\n\n🧠 Entendendo a transação...`,
      { parse_mode: 'HTML' }
    );

    // 3. Obter contas e categorias
    const [accounts, expenseCategories, incomeCategories] = await Promise.all([
      userApi.get<{id: string, name: string, type: string}[]>('/accounts', userId),
      userApi.get<{id: string, name: string}[]>('/categories?type=expense', userId),
      userApi.get<{id: string, name: string}[]>('/categories?type=income', userId)
    ]);
    const allCategories = [...expenseCategories, ...incomeCategories];

    // 4. Extração da transação com Ollama
    const parsedTx = await parseTransactionWithOllama(transcription, allCategories, accounts);

    if (parsedTx.amount <= 0) {
      await ctx.telegram.editMessageText(
        ctx.chat?.id, 
        waitMsg.message_id, 
        undefined, 
        `🗣️ <i>"${transcription}"</i>\n\n❌ Não consegui identificar um valor financeiro válido no áudio.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Encontrar os IDs
    let categoryId = allCategories.find(c => c.name.toLowerCase() === parsedTx.categoryName?.toLowerCase())?.id;
    let account = accounts.find(a => a.name.toLowerCase() === parsedTx.accountName?.toLowerCase());

    if (!categoryId) {
      // Fallback para categoria controle/outros se não achar
      const fallbackList = parsedTx.type === 'expense' ? expenseCategories : incomeCategories;
      categoryId = fallbackList.find(c => c.name.toLowerCase().includes('controle'))?.id || fallbackList[0]?.id;
    }
    
    if (!account) {
       // Fallback para a primeira conta se não achar
       account = accounts[0];
    }
    
    if (!account || !categoryId) {
       await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, '❌ Você não possui categorias ou contas cadastradas. Crie pelo painel web primeiro.');
       return;
    }

    const payload = {
      description: parsedTx.description,
      amount: parsedTx.type === 'expense' ? -parsedTx.amount : parsedTx.amount,
      type: parsedTx.type,
      categoryId: categoryId,
      accountId: account.id,
      occurredAt: parsedTx.occurredAt,
      status: account.type === 'credit_card' ? 'pending' : 'paid',
    };

    await userApi.post('/transactions', userId, payload);

    let finalMsg = `✅ <b>Transação adicionada por voz!</b>\n\n`;
    finalMsg += `📝 <b>Descrição:</b> ${parsedTx.description}\n`;
    finalMsg += `💰 <b>Valor:</b> ${brl(parsedTx.amount)}\n`;
    finalMsg += `🔄 <b>Tipo:</b> ${parsedTx.type === 'income' ? 'Receita 🟢' : 'Despesa 🔴'}\n`;
    finalMsg += `📁 <b>Categoria:</b> ${allCategories.find(c => c.id === categoryId)?.name || 'N/A'}\n`;
    finalMsg += `💳 <b>Conta:</b> ${account.name}\n`;
    if (parsedTx.occurredAt) {
      finalMsg += `⏰ <b>Data:</b> ${new Date(parsedTx.occurredAt).toLocaleString('pt-BR')}`;
    }

    await ctx.telegram.editMessageText(ctx.chat?.id, waitMsg.message_id, undefined, finalMsg, { parse_mode: 'HTML' });
    
  } catch (error: any) {
    console.error('Erro no processamento de voz:', error);
    const errorMessage = error.message || 'Erro desconhecido';
    await ctx.reply(`Ocorreu um erro ao processar o áudio: ${errorMessage}`);
  }
}
