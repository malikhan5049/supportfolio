import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import TinyUrlCardComponent from './tinyurl-card.component';

describe('TinyUrlCardComponent', () => {
  const inputs = {
    title: 'TinyURL',
    description: 'Short links',
    features: ['Click counts'],
    openUrl: 'http://localhost:4201',
  };

  it('renders the shared card with the real-card marker', async () => {
    const { fixture } = await render(TinyUrlCardComponent, { inputs });
    expect(
      fixture.nativeElement.querySelector('[data-testid="tinyurl-card-content"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Click counts');
    expect(fixture.nativeElement.querySelector('[data-testid="remote-card-tinyurl"]')).toBeNull();
  });

  it('carries the RemoteCardComponent inputs through to the shared card', async () => {
    const { fixture } = await render(TinyUrlCardComponent, { inputs });
    const libCard = fixture.debugElement.query(By.css('lib-card'));
    expect(libCard.componentInstance.title).toBe('TinyURL');
    expect(libCard.componentInstance.description).toBe('Short links');
    expect(libCard.componentInstance.features).toEqual(['Click counts']);
    expect(libCard.componentInstance.openUrl).toBe('http://localhost:4201');
  });

  it('re-emits the shared card open action', async () => {
    const { fixture } = await render(TinyUrlCardComponent, { inputs });
    const emit = jest.spyOn(fixture.componentInstance.open, 'emit');
    fixture.debugElement.query(By.css('lib-card')).triggerEventHandler('open', undefined);
    expect(emit).toHaveBeenCalled();
  });
});
