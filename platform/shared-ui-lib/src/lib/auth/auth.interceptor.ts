import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenStore } from './auth-token.store';

/**
 * Sends the Identity JWT on this app's own protected API calls only — never on `/api/token`
 * itself, never on absolute/remote URLs, so remotes never receive the shell's token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthTokenStore).token();
  if (
    token !== null &&
    !req.url.startsWith('/api/token') &&
    req.url.startsWith('/api/') &&
    !req.url.includes('://')
  ) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
