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
    expect(screen.getByTestId('open-action')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('GitHub sign-in');
  });
});
