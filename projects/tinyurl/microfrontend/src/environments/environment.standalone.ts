/** Standalone prod: the service serves this bundle at its own origin; everything is same-origin. */
export const environment = {
  production: true,
  apiBaseUrl: '',
  identityLoginBaseUrl: '',
  publicBaseUrl: '',
  linkApiBaseUrl: '',
  callbackPath: '/auth/callback',
  apiUrlPrefixes: ['/api/'],
};

export default environment;
