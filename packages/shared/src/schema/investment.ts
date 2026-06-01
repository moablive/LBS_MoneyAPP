export interface Investment {
  id: string;
  userId: string;
  accountId: string | null;
  name: string;
  type: import('./common').InvestmentType;
  quantity: string;
  buyPrice: string;
  currentPrice: string;
  buyDate: string;
  goalAmount: string | null;
  yieldRate: string | null;
  yieldIndex: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Virtual fields returned by the backend
  accountName?: string;
  bankCode?: string;
  customIconUrl?: string;
}

export interface InvestmentSummary {
  totalInvested: number;
  currentTotal: number;
  profitLoss: number;
  percentage: number;
  assetCount: number;
}

export interface CreateInvestmentPayload {
  name: string;
  type: string;
  accountId?: string | null;
  quantity: string | number;
  buyPrice: string | number;
  currentPrice?: string | number;
  buyDate: string | Date;
  notes?: string | null;
  goalAmount?: string | number | null;
  yieldRate?: string | number | null;
  yieldIndex?: string | null;
}
