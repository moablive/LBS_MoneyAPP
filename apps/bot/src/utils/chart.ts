import sharp from 'sharp';

export interface Slice {
  name: string;
  value: number;
  color?: string | null;
}

// Paleta de fallback quando a categoria não tem cor definida no MoneyAPP.
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

/**
 * Substituto local do matplotlib: monta um gráfico de barras em SVG e rasteriza
 * para PNG com o `sharp` (libvips). Sem chamadas externas — mantém o bot 100%
 * privado, como na versão Python. Retorna null se não houver dados.
 */
export async function renderChartPng(slices: Slice[], title: string): Promise<Buffer | null> {
  const data = slices.filter((s) => s.value > 0);
  if (data.length === 0) return null;

  const total = data.reduce((acc, s) => acc + s.value, 0);
  const maxVal = Math.max(...data.map(s => s.value));

  const barHeight = 40;
  const barSpacing = 30;
  const marginTop = 80;
  const marginBottom = 20;
  const marginLeft = 20;
  const marginRight = 20;

  const W = 600; // Good width for smartphones
  const H = marginTop + data.length * (barHeight + barSpacing) + marginBottom;

  const plotW = W - marginLeft - marginRight;

  const colorOf = (s: Slice, i: number): string =>
    s.color && /^#/.test(s.color) ? s.color : (PALETTE[i % PALETTE.length] ?? '#cccccc');

  const elements: string[] = [];
  
  let currentY = marginTop;
  data.forEach((s, i) => {
    const pct = ((s.value / total) * 100).toFixed(1);
    const barW = (s.value / maxVal) * plotW;
    const fill = colorOf(s, i);

    // Label above the bar
    elements.push(
      `<text x="${marginLeft}" y="${currentY - 8}" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#222222" font-weight="bold">${escapeXml(s.name)} — R$ ${s.value.toFixed(2)} (${pct}%)</text>`
    );

    // Bar
    elements.push(
      `<rect x="${marginLeft}" y="${currentY}" width="${Math.max(barW, 2)}" height="${barHeight}" rx="4" fill="${fill}" />`
    );

    currentY += barHeight + barSpacing;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff" />
  <text x="${W / 2}" y="40" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="bold" fill="#111111">${escapeXml(title)}</text>
  ${elements.join('\n  ')}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
