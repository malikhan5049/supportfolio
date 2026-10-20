import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { IdentityCardComponent } from './identity-card.component';

// The fixture's responsibility is the (open) -> open.emit() forwarding binding. Asserted via
// triggerEventHandler + emit spy: synchronous and immune to jest-zoneless EventEmitter delivery
// scheduling. The click-to-window-open path is covered by the host suite's fallback test and the
// Playwright e2e.
describe('IdentityCardComponent open action', () => {
  it('binds the shared card open output to its own open output', async () => {
    const { fixture } = await render(IdentityCardComponent, {
      inputs: {
        title: 'Identity',
        description: 'SSO',
        features: ['GitHub sign-in'],
        openUrl: 'http://localhost:8081',
      },
    });
    const emitSpy = jest.spyOn(fixture.componentInstance.open, 'emit');
    const card = fixture.debugElement.query(By.css('lib-card'));
    card.triggerEventHandler('open', undefined);
    expect(emitSpy).toHaveBeenCalled();
  });
});
