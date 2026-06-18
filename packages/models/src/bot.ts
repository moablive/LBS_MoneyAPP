export interface RegisterState {
  tipo?: 'income' | 'expense';
  desc?: string;
  valor?: number;
  receiptBase64?: string;
  receiptMimeType?: string;
  categoryId?: string;
  waitingFor?: string;
}

export interface AttachReceiptState {
  txId?: string;
}

export interface LoginState {
  email?: string;
}
