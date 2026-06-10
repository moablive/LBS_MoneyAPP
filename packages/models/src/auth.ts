import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export interface UserSettings {
  requireReceipts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  settings: UserSettings;
  defaultPassword?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}
