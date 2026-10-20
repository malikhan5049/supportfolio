import { InjectionToken } from '@angular/core';
import type { AuthConfig } from './auth.types';

/** Per-app auth wiring; apps supply their own identity/callback URLs via `provideAuth`. */
export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');
