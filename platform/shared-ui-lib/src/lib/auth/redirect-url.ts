/**
 * Pure URL helpers for the auth flow. No Angular imports, no DOM APIs — string logic only, so the
 * same rules are testable and reusable by host and remotes.
 */

/** Removes the `#fragment` (including the `#`) from a URL or path. */
export function stripFragment(url: string): string {
  const hashIndex = url.indexOf('#');
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}

/** Point of no return for a login: Identity's `/auth/login` with the fragment-free callback target. */
export function buildLoginRedirectUrl(
  identityLoginBaseUrl: string,
  callbackUrl: string,
): string {
  return `${identityLoginBaseUrl}/auth/login?redirect=${encodeURIComponent(
    stripFragment(callbackUrl),
  )}`;
}

/**
 * Open-redirect guard: only a plain same-origin path (single leading `/`), or the path+query+hash
 * of a same-origin absolute URL, may be used as a post-login return target. Anything else returns `/`.
 */
export function safeReturnUrl(raw: string | null, origin: string): string {
  if (!raw) {
    return '/';
  }
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  if (/^https?:\/\//i.test(raw)) {
    const safeOrigin = new URL(origin).origin;
    const candidate = new URL(raw, origin);
    if (candidate.origin === safeOrigin) {
      return candidate.pathname + candidate.search + candidate.hash;
    }
  }
  return '/';
}
