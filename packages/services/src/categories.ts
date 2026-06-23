import { and, eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';

const DEFAULT_CATEGORIES = [
  { name: 'Controle 📊', type: 'expense' },
  { name: 'Alimentação 🍔|/🍽️', type: 'expense' },
  { name: 'Assinaturas 📺', type: 'expense' },
  { name: 'Barbearia & Estética 💈', type: 'expense' },
  { name: 'CARRO 🛻', type: 'expense' },
  { name: 'Casa 🏠', type: 'expense' },
  { name: 'Comunicação 📶', type: 'expense' },
  { name: 'Empréstimos 🧾', type: 'expense' },
  { name: 'Estacionamento 🅿️', type: 'expense' },
  { name: 'Estudos 📚', type: 'expense' },
  { name: 'Farmácia 💊', type: 'expense' },
  { name: 'FATURAS 💳', type: 'expense' },
  { name: 'Impostos 📄', type: 'expense' },
  { name: 'Investimentos 📈', type: 'expense' },
  { name: 'Lazer 🍻', type: 'expense' },
  { name: 'Locações 📦', type: 'expense' },
  { name: 'Mercado 🛒', type: 'expense' },
  { name: 'Salário 💵', type: 'income' },
  { name: 'Saúde 🩺', type: 'expense' },
  { name: 'TI 🤖', type: 'expense' },
  { name: 'Transporte 🚕', type: 'expense' },
  { name: 'Vestuário 👕', type: 'expense' },
  { name: 'Viagens 🎒', type: 'expense' },
  { name: 'Honorários 💼', type: 'income' },
  { name: 'Combustível ⛽', type: 'expense' },
  { name: 'Contabilidade 🧮', type: 'expense' },
  { name: 'Advogado ⚖️', type: 'expense' },
  { name: 'Pensão 💸', type: 'expense' },
  { name: 'Lavagem 🧽', type: 'expense' },
] as const;

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

/**
 * Seed the default category set for a user. Idempotent — only inserts the
 * categories that don't already exist for that user. Called when a user is
 * first provisioned in MoneyAPP (after LoginHub authenticates them).
 */
export async function ensureDefaultCategories(loginhubId: number): Promise<void> {
  for (const [i, cat] of DEFAULT_CATEGORIES.entries()) {
    const existing = await db.query.categories.findFirst({
      where: and(
        eq(schema.categories.loginhubId, loginhubId),
        eq(schema.categories.name, cat.name),
        eq(schema.categories.type, cat.type as 'expense' | 'income'),
      ),
    });

    if (!existing) {
      await db.insert(schema.categories).values({
        loginhubId,
        name: cat.name,
        type: cat.type as 'expense' | 'income',
        color: PRESET_COLORS[i % PRESET_COLORS.length],
      });
    }
  }
}
