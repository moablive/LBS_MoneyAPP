// Authentication is delegated to LoginHub. MoneyAPP no longer validates
// credentials or issues user tokens — these types describe only the local
// view of an authenticated user (profile + MoneyAPP-specific settings).

export interface UserSettings {
  requireReceipts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  settings: UserSettings;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}
