import { render } from '@testing-library/angular';
import { CardComponent } from './card.component';

describe('CardComponent', () => {
  it('renders a fallback when title is empty', async () => {
    const { fixture } = await render(CardComponent, { inputs: { title: '', description: 'd', features: [], openUrl: '#' } });
    expect(fixture.nativeElement.textContent).toContain('Untitled project');
  });

  it('emits open when the Open action is clicked', async () => {
    const onOpen = jest.fn();
    const { fixture } = await render(CardComponent, {
      inputs: { title: 'TinyURL', description: 'd', features: ['shorten'], openUrl: '#' },
      on: { open: onOpen },
    });
    fixture.nativeElement.querySelector('[data-testid="open-action"]').click();
    expect(onOpen).toHaveBeenCalled();
  });
});
