import { render, screen } from '@testing-library/angular';
import { IdentityCardComponent } from './identity-card.component';

describe('IdentityCardComponent', () => {
  it('renders the identity card content through the shared card', async () => {
    const { fixture } = await render(IdentityCardComponent, {
      inputs: {
        title: 'Identity',
        description: 'SSO',
        features: ['GitHub sign-in'],
        openUrl: 'http://localhost:8081',
      },
    });
    // `remote-card-identity` lives on the host wrapper (RemoteCardHostComponent), not here —
    // duplicating it would collide with Playwright's strict mode once both render nested.
    expect(screen.getByTestId('open-action')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('GitHub sign-in');
  });
});
