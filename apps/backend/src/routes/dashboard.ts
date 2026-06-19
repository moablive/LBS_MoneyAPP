import { Router } from 'express';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { categoryRankingQuerySchema, dashboardSummaryQuerySchema, spendingEvolutionQuerySchema, categoryEvolutionQuerySchema, type CategoryRankingResponse, type DashboardSummaryResponse, type SpendingEvolutionResponse, type CategoryEvolutionResponse } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, categories, transactions } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/categories/ranking
 *   ?month=YYYY-MM     (default: current month)
 *   &type=expense|income (default: expense)
 *   &includeZero=true|false
 *   &limit=NN
 *
 * Returns the linear ranking shown on the dashboard ("Principais Categorias")
 * with month-over-month variation. Aggregation is done in a single SQL round
 * trip using conditional sums so we never pull transaction rows over the wire.
 */
dashboardRouter.get(
  '/categories/ranking',
  requireAuth,
  validate(categoryRankingQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { month, type, includeZero, limit } = req.query as unknown as
        import('@moneyapp/models').CategoryRankingQuery;

      const monthStart = parseMonthStart(month);
      const nextMonthStart = addMonths(monthStart, 1);
      const prevMonthStart = addMonths(monthStart, -1);

      const rows = await db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColor: categories.color,
          currentTotal: sql<string>`
            coalesce(sum(
              case
                when ${transactions.occurredAt} >= ${monthStart}
                 and ${transactions.occurredAt} <  ${nextMonthStart}
                then abs(${transactions.amount})
              end
            ), 0)
          `.as('current_total'),
          previousTotal: sql<string>`
            coalesce(sum(
              case
                when ${transactions.occurredAt} >= ${prevMonthStart}
                 and ${transactions.occurredAt} <  ${monthStart}
                then abs(${transactions.amount})
              end
            ), 0)
          `.as('previous_total'),
        })
        .from(categories)
        // LEFT JOIN so categories with zero activity still appear (filtered later).
        .leftJoin(
          transactions,
          and(
            eq(transactions.categoryId, categories.id),
            eq(transactions.userId, userId),
            eq(transactions.type, type),
            gte(transactions.occurredAt, prevMonthStart),
            lt(transactions.occurredAt, nextMonthStart),
          ),
        )
        .where(and(eq(categories.userId, userId), eq(categories.type, type)))
        .groupBy(categories.id)
        .orderBy(desc(sql`current_total`));

      const totalCurrent = rows.reduce((acc, r) => acc + Number(r.currentTotal), 0);
      const totalPrevious = rows.reduce((acc, r) => acc + Number(r.previousTotal), 0);

      let ranking = rows.map((r) => {
        const current = Number(r.currentTotal);
        const previous = Number(r.previousTotal);
        const variationPct =
          previous === 0
            ? current === 0
              ? 0
              : null // no baseline — UI shows "novo" instead of a number
            : ((current - previous) / previous) * 100;
        return {
          categoryId: r.categoryId,
          name: r.categoryName,
          color: r.categoryColor,
          current,
          previous,
          share: totalCurrent === 0 ? 0 : (current / totalCurrent) * 100,
          variationPct,
        };
      });

      if (!includeZero) ranking = ranking.filter((r) => r.current > 0);
      if (limit) ranking = ranking.slice(0, limit);

      const body: CategoryRankingResponse = {
        month: formatMonth(monthStart),
        type,
        totalCurrent,
        totalPrevious,
        ranking,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/dashboard/categories/evolution?month=YYYY-MM&type=expense
 * Returns daily aggregated spending per category, isolating Top 5 and Outros.
 */
dashboardRouter.get(
  '/categories/evolution',
  requireAuth,
  validate(categoryEvolutionQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { month, type } = req.query as unknown as import('@moneyapp/models').CategoryEvolutionQuery;
      const monthStart = parseMonthStart(month);
      const nextMonthStart = addMonths(monthStart, 1);
      const daysInMonth = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      ).getUTCDate();

      const rows = await db
        .select({
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryColor: categories.color,
          day: sql<number>`extract(day from ${transactions.occurredAt} at time zone 'utc')::int`.as('day'),
          total: sql<string>`sum(abs(${transactions.amount}))`.as('total'),
        })
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, type),
            gte(transactions.occurredAt, monthStart),
            lt(transactions.occurredAt, nextMonthStart),
          ),
        )
        .groupBy(transactions.categoryId, categories.name, categories.color, sql`day`);

      // Find Top 5 categories by total amount over the month
      const catTotals = new Map<string, { id: string, name: string, color: string | null, total: number }>();
      for (const r of rows) {
        const catId = r.categoryId || 'unknown';
        if (!catTotals.has(catId)) {
          catTotals.set(catId, { id: catId, name: r.categoryName || 'Outros', color: r.categoryColor, total: 0 });
        }
        catTotals.get(catId)!.total += Number(r.total);
      }

      const sortedCats = Array.from(catTotals.values()).sort((a, b) => b.total - a.total);
      const top5 = sortedCats.slice(0, 5);
      const topIds = new Set(top5.map(c => c.id));

      const dailySums = new Map<string, number[]>();
      top5.forEach(c => dailySums.set(c.id, new Array(daysInMonth + 1).fill(0)));
      const outrosSum = new Array(daysInMonth + 1).fill(0);

      for (const r of rows) {
        const catId = r.categoryId || 'unknown';
        const day = r.day;
        const amt = Number(r.total);
        if (day >= 1 && day <= daysInMonth) {
          if (topIds.has(catId)) {
            const arr = dailySums.get(catId);
            if (arr) arr[day] = (arr[day] || 0) + amt;
          } else {
            outrosSum[day] = (outrosSum[day] || 0) + amt;
          }
        }
      }

      const datasets: CategoryEvolutionResponse['datasets'] = [];
      
      for (const c of top5) {
        const daily = dailySums.get(c.id)!;
        const cum = [];
        let acc = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          acc += daily[d] || 0;
          cum.push(acc);
        }
        datasets.push({ label: c.name, color: c.color || '#6366f1', data: cum });
      }

      const totalOutros = outrosSum.reduce((sum, val) => sum + val, 0);
      if (totalOutros > 0) {
        const cum = [];
        let acc = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          acc += outrosSum[d] || 0;
          cum.push(acc);
        }
        datasets.push({ label: 'Outros', color: '#6b7280', data: cum });
      }

      const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

      const body: CategoryEvolutionResponse = {
        month: formatMonth(monthStart),
        type,
        labels,
        datasets,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/dashboard/summary?month=YYYY-MM
 * Powers the 4 KPI cards (Saldo, Receitas, Despesas, Economia %).
 * Excludes `isInvestment = true` transactions from income / expense totals.
 */
dashboardRouter.get(
  '/summary',
  requireAuth,
  validate(dashboardSummaryQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { month } = req.query as unknown as import('@moneyapp/models').DashboardSummaryQuery;
      const monthStart = parseMonthStart(month);
      const nextMonthStart = addMonths(monthStart, 1);

      const [agg] = await db
        .select({
          income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income'  then ${transactions.amount} end), 0)`.as('income'),
          expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then abs(${transactions.amount}) end), 0)`.as('expense'),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.occurredAt, monthStart),
            lt(transactions.occurredAt, nextMonthStart),
          ),
        );

      const [bal] = await db
        .select({
          total: sql<string>`coalesce(sum(case when ${accounts.freezeBalance} = false and ${accounts.type} != 'credit_card' then ${accounts.currentBalance} else 0 end), 0)`.as('total'),
          creditCardTotal: sql<string>`coalesce(sum(case when ${accounts.freezeBalance} = false and ${accounts.type} = 'credit_card' then abs(${accounts.currentBalance}) else 0 end), 0)`.as('creditCardTotal'),
        })
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const income = Number(agg!.income);
      const expense = Number(agg!.expense);
      const closingBalance = Number(bal!.total);
      const creditCardBalance = Number(bal!.creditCardTotal);
      // openingBalance is closing minus this month's net movement — accurate
      // enough for the KPI card without a full historical reconstruction.
      const openingBalance = closingBalance - (income - expense);
      const savingsPct = income > 0 ? ((income - expense) / income) * 100 : 0;

      const body: DashboardSummaryResponse = {
        month: formatMonth(monthStart),
        openingBalance,
        income,
        expense,
        savingsPct,
        closingBalance,
        creditCardBalance,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/dashboard/spending-evolution?month=YYYY-MM
 * Returns one point per day with cumulative expense for the current month
 * and the same series for the previous month — feeds the line chart.
 */
dashboardRouter.get(
  '/spending-evolution',
  requireAuth,
  validate(spendingEvolutionQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { month } = req.query as unknown as import('@moneyapp/models').SpendingEvolutionQuery;
      const monthStart = parseMonthStart(month);
      const nextMonthStart = addMonths(monthStart, 1);
      const prevMonthStart = addMonths(monthStart, -1);
      const daysInMonth = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      ).getUTCDate();

      // One round-trip: aggregate per (period, day). We use `extract(day ...)`
      // and a tag column to split current/previous.
      const rows = await db
        .select({
          period: sql<string>`
            case
              when ${transactions.occurredAt} >= ${monthStart}
               and ${transactions.occurredAt} <  ${nextMonthStart}
              then 'current' else 'previous'
            end
          `.as('period'),
          day: sql<number>`extract(day from ${transactions.occurredAt} at time zone 'utc')::int`.as('day'),
          total: sql<string>`sum(abs(${transactions.amount}))`.as('total'),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'expense'),
            gte(transactions.occurredAt, prevMonthStart),
            lt(transactions.occurredAt, nextMonthStart),
          ),
        )
        .groupBy(sql`period`, sql`day`);

      const dailyCurrent = new Array<number>(daysInMonth + 1).fill(0);
      const dailyPrevious = new Array<number>(daysInMonth + 1).fill(0);
      for (const r of rows) {
        const target = r.period === 'current' ? dailyCurrent : dailyPrevious;
        if (r.day >= 1 && r.day < target.length) target[r.day] = Number(r.total);
      }

      const series: SpendingEvolutionResponse['series'] = [];
      let accCurrent = 0;
      let accPrevious = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        accCurrent += dailyCurrent[d] ?? 0;
        accPrevious += dailyPrevious[d] ?? 0;
        series.push({ day: d, current: accCurrent, previous: accPrevious });
      }

      const body: SpendingEvolutionResponse = {
        month: formatMonth(monthStart),
        totalCurrent: accCurrent,
        totalPrevious: accPrevious,
        series,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);


function parseMonthStart(input?: string): Date {
  if (input) {
    const [y, m] = input.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function formatMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
