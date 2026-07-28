import { env } from './src/config.js';

async function test() {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 pixel
  const prompt = `Analise a imagem deste comprovante/recibo.
Extraia as informações rigorosamente neste formato JSON:
{
  "valor": <numero, ex: 15.50>,
  "tipo": <"expense" para pagamentos feitos ou "income" para recebimentos>,
  "descricao": <"breve descrição ou nome do estabelecimento">,
  "data": <"YYYY-MM-DD" da transação>,
  "categoriaNome": <"Escolha o nome mais apropriado desta lista se for expense: [Alimentação] ou desta lista se for income: [Salário]">
}
Retorne APENAS o JSON válido, sem NENHUM texto adicional ou markdown de código.`;

  console.log("Sending to Ollama:", env.OLLAMA_URL);
  const res = await fetch(`${env.OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      prompt,
      images: [base64],
      stream: false,
      format: 'json'
    })
  });
  
  if (!res.ok) {
    console.error("API Error", res.status, res.statusText);
    return;
  }
  
  const data = await res.json();
  console.log("Response:", data.response);
}

test().catch(console.error);
