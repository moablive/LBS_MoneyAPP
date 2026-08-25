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
  /**
   * Passe de 5 minutos entre a senha e o código do autenticador. Fica no state
   * da cena, e não em módulo: um bot atende várias conversas ao mesmo tempo.
   */
  challengeToken?: string;
}
