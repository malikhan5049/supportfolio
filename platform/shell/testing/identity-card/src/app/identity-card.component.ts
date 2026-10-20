import { Component, Input } from '@angular/core';
import { CardComponent } from 'shared-ui-lib';
import type { RemoteCardComponent } from 'shared-ui-lib';

/**
 * The fixture `card` remote exposed by the `identity` project's MF entry (disposable; replaced by
 * a real project remote in Plan 4). Delegates rendering to the shared card.
 */
@Component({
  selector: 'identity-card',
  standalone: true,
  imports: [CardComponent],
  template: '<lib-card data-testid="remote-card-identity" [title]="title" [description]="description" [features]="features" [openUrl]="openUrl"></lib-card>',
})
export class IdentityCardComponent implements RemoteCardComponent {
  @Input() title = 'Identity';
  @Input() description = 'Single sign-on and JWT issuance for every Supportfolio project.';
  @Input() features: string[] = ['GitHub sign-in', 'JWT issuance', 'JWKS publication'];
  @Input() openUrl = 'http://localhost:8081';
}

export default IdentityCardComponent;
