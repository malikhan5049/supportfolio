/** Shared auth type contracts, matching Plan 2's token endpoint exactly. */
export interface AuthConfig {
  identityLoginBaseUrl: string;
  apiBaseUrl: string;
  callbackPath: string;
}

export interface Principal {
  id: string;
  login: string;
  email: string | null;
  displayName: string;
  role: 'admin' | 'user';
}

export interface AuthSession {
  accessToken: string;
  principal: Principal;
  expiresAt: number;
}
