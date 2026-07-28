import { userApi } from './api.js';

export interface UpcomingTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  occurredAt: string;
  categoryId: string | null;
  isLoan?: boolean;
  loanType?: string;
  isCreditCard?: boolean;
  account?: any;
  isSubscription?: boolean;
}

export async function getUpcomingTransactions(loginhubId: string, fromDate: Date, toDate: Date): Promise<{
  upcomingTransactions: UpcomingTransaction[];
  categoriesMap: Map<string, any>;
}> {
  const fromParam = fromDate.toISOString();
  const toParam = toDate.toISOString();

  const [transactionsRes, categoriesRes, loansRes, subscriptionsRes, accountsRes] = await Promise.all([
    userApi.get<any[]>(`/transactions?status=pending&sort=date_asc&limit=100&from=${fromParam}&to=${toParam}`, loginhubId),
    userApi.get<any[]>('/categories', loginhubId),
    userApi.get<any>('/loans/summary', loginhubId),
    userApi.get<any>('/subscriptions/summary', loginhubId),
    userApi.get<any[]>('/accounts', loginhubId),
  ]);

  const categoriesMap = new Map(categoriesRes.map(c => [c.id, c]));

  const upcomingLoans = (loansRes?.items || []).filter((loan: any) => {
    if (loan.status !== 'active') return false;
    const loanDate = new Date(loan.date);
    return loanDate >= fromDate && loanDate <= toDate;
  }).map((loan: any) => {
    const type = loan.type === 'received' ? 'expense' : 'income';
    const amount = type === 'expense' ? -Math.abs(Number(loan.amount)) : Math.abs(Number(loan.amount));
    return {
      id: loan.id,
      description: loan.description,
      amount: amount,
      type: type,
      occurredAt: loan.date,
      categoryId: null,
      isLoan: true,
      loanType: loan.type
    };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const creditCardInvoices = accountsRes
    .filter(a => a.type === 'credit_card' && Number(a.currentBalance) !== 0)
    .map(card => {
      let dueDate = new Date(today.getFullYear(), today.getMonth(), card.dueDay || card.closingDay || 1, 12, 0, 0);
      if (dueDate < today) {
         dueDate.setMonth(dueDate.getMonth() + 1);
      }
      return {
        id: `cc-${card.id}`,
        description: `Fatura ${card.name}`,
        amount: -Math.abs(Number(card.currentBalance)),
        type: 'expense',
        occurredAt: dueDate.toISOString(),
        categoryId: null,
        isCreditCard: true,
        account: card
      };
    })
    .filter(cc => {
       const d = new Date(cc.occurredAt);
       return d >= fromDate && d <= toDate;
    });

  const upcomingSubscriptions = (subscriptionsRes?.items || []).filter((sub: any) => {
    if (sub.status !== 'active') return false;
    return true;
  }).map((sub: any) => {
    let subDate = new Date(today.getFullYear(), today.getMonth(), sub.billingDay || 1, 12, 0, 0);
    if (subDate < today) {
       subDate.setMonth(subDate.getMonth() + 1);
    }
    return {
      id: `sub-${sub.id}`,
      description: sub.description,
      amount: sub.type === 'expense' ? -Math.abs(Number(sub.amount)) : Math.abs(Number(sub.amount)),
      type: sub.type || 'expense',
      occurredAt: subDate.toISOString(),
      categoryId: sub.categoryId,
      isSubscription: true
    };
  }).filter((sub: any) => {
     const d = new Date(sub.occurredAt);
     return d >= fromDate && d <= toDate;
  });

  const upcomingTransactions = [...transactionsRes.map((t: any) => ({ ...t, amount: Number(t.amount) })), ...upcomingLoans, ...creditCardInvoices, ...upcomingSubscriptions].sort((a, b) => {
    const dayA = Number(a.occurredAt.slice(8, 10));
    const dayB = Number(b.occurredAt.slice(8, 10));
    if (dayA !== dayB) return dayA - dayB;
    return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
  });

  return { upcomingTransactions, categoriesMap };
}
