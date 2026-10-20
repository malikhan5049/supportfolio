import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { safeReturnUrl } from './redirect-url';

/**
 * Consumes the one-time code Identity redirected with: either a denial (`?error=access_denied`),
 * a code exchange, or an error when neither query value arrived. The address bar's `?code=`
 * is dropped by navigating with replaceUrl afterwards.
 */
@Component({
  selector: 'lib-auth-callback',
  templateUrl: './auth-callback.component.html',
})
export class AuthCallbackComponent {
  readonly denied = signal(false);
  readonly error = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AuthService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('error') === 'access_denied') {
      this.reportDenied();
      return;
    }
    const code = params.get('code');
    if (!code) {
      this.error.set(true);
      return;
    }
    this.service
      .completeLogin(code)
      .then(() =>
        this.router.navigateByUrl(
          safeReturnUrl(this.service.consumeReturnUrl(), window.location.origin),
          { replaceUrl: true },
        ),
      )
      .catch(() => this.reportDenied());
  }

  private reportDenied(): void {
    this.denied.set(true);
    this.service.lastError?.set?.('denied');
  }
}
