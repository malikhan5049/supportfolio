import production from './environment.prod';

describe('the production environment override', () => {
  it('resolves prod auth and short links same-origin', () => {
    expect(production.identityLoginBaseUrl).toBe('');
    expect(production.apiBaseUrl).toBe('');
    expect(production.publicBaseUrl).toBe('');
  });

  it('flags the build as a production build', () => {
    expect(production.production).toBe(true);
  });
});
