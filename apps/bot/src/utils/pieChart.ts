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
 * Substituto local do matplotlib: monta um gráfico de pizza em SVG e rasteriza
 * para PNG com o `sharp` (libvips). Sem chamadas externas — mantém o bot 100%
 * privado, como na versão Python. Retorna null se não houver dados.
 */
export async function renderPieChartPng(slices: Slice[], title: string): Promise<Buffer | null> {
  const data = slices.filter((s) => s.value > 0);
  if (data.length === 0) return null;

  const total = data.reduce((acc, s) => acc + s.value, 0);

  const W = 760;
  const H = Math.max(360, 90 + data.length * 30);
  const cx = 200;
  const cy = H / 2 + 8;
  const r = 150;

  const colorOf = (s: Slice, i: number): string =>
    s.color && /^#/.test(s.color) ? s.color : (PALETTE[i % PALETTE.length] ?? '#cccccc');

  const paths: string[] = [];
  let angle = -Math.PI / 2; // começa no topo
  data.forEach((s, i) => {
    const fill = colorOf(s, i);
    if (data.length === 1) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`);
      return;
    }
    const end = angle + (s.value / total) * Math.PI * 2;
    const x0 = cx + r * Math.cos(angle);
    const y0 = cy + r * Math.sin(angle);
    const x1 = cx + r * Math.cos(end);
    const y1 = cy + r * Math.sin(end);
    const large = end - angle > Math.PI ? 1 : 0;
    paths.push(
      `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${fill}" stroke="#ffffff" stroke-width="2" />`,
    );
    angle = end;
  });

  const legend: string[] = [];
  const lx = 400;
  let ly = Math.max(70, cy - r + 6); // começa abaixo do título
  data.forEach((s, i) => {
    const pct = ((s.value / total) * 100).toFixed(1);
    legend.push(`<rect x="${lx}" y="${ly - 13}" width="16" height="16" rx="3" fill="${colorOf(s, i)}" />`);
    legend.push(
      `<text x="${lx + 24}" y="${ly}" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#222222">${escapeXml(s.name)} — R$ ${s.value.toFixed(2)} (${pct}%)</text>`,
    );
    ly += 30;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff" />
  <text x="${W / 2}" y="34" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#111111">${escapeXml(title)}</text>
  ${paths.join('\n  ')}
  ${legend.join('\n  ')}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
