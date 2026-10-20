import { render } from '@testing-library/angular';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';

describe('App', () => {
  it('renders the shell header and the router outlet', async () => {
    const { fixture } = await render(App, { imports: [RouterTestingModule] });
    expect(
      fixture.nativeElement.querySelector('[data-testid="shell-header"]').textContent,
    ).toContain('Supportfolio');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
