import { InjectionToken } from '@angular/core';

/**
 * Browser-facing base for built short links. Dev default points at the service; Task 16's
 * environment files override it (`''` in production means links are same-origin `/go/...`).
 */
export const SHORT_LINK_BASE_URL = new InjectionToken<string>('SHORT_LINK_BASE_URL', {
  factory: () => 'http://localhost:8082',
});
