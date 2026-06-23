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

export interface PersistedState extends AuthState {
  requirePasswordChange?: boolean;
}

/**
 * Payload of a LoginHub-issued user token. MoneyAPP no longer mints user
 * tokens — it only verifies the ones LoginHub signs (shared JWT_SECRET).
 */
export interface LoginHubPayload {
  sub: string; // LoginHub user id (integer, as string)
  email: string;
  app_id?: string;
  role?: string;
}
