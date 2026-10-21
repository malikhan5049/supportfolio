import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CardComponent, RemoteCardComponent } from 'shared-ui-lib';

/**
 * The TinyURL card exposed as `./card` through the remote's Module Federation container.
 * It delegates to the shared card, re-emits `open`, and carries the real-card content
 * marker; the host owns the `remote-card-tinyurl` wrapper id.
 */
@Component({
  selector: 'app-tinyurl-card',
  imports: [CardComponent],
  template: `
    <lib-card
      data-testid="tinyurl-card-content"
      [title]="title"
      [description]="description"
      [features]="features"
      [openUrl]="openUrl"
      (open)="open.emit()"
    ></lib-card>
  `,
})
export default class TinyUrlCardComponent implements RemoteCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() features: string[] = [];
  @Input() openUrl = '';
  @Output() open = new EventEmitter<void>();
}
