import { InjectionToken } from '@angular/core';

/**
 * Base URL prefix for the TinyURL link API. In production this points under the
 * app-relative path `/apps/tinyurl`; in dev it defaults to the empty string so
 * calls hit the local origin root.
 */
export const LINK_API_BASE_URL = new InjectionToken<string>('LINK_API_BASE_URL', {
  factory: () => '',
});
