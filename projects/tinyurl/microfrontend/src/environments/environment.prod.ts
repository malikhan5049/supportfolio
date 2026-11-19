/** Prod: served under `/apps/tinyurl` with app-relative API calls. */
export const environment = {
  production: true,
  apiBaseUrl: '',
  identityLoginBaseUrl: '',
  publicBaseUrl: '',
  linkApiBaseUrl: '/apps/tinyurl',
  callbackPath: '/apps/tinyurl/auth/callback',
  apiUrlPrefixes: ['/apps/tinyurl/api/'],
};

export default environment;
