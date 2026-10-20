import { inject } from '@angular/core';
import { Component } from '@angular/core';
import { AuthService } from './auth.service';

/** Every app's login page: one button, one denial state, one Identity entry point. */
@Component({
  selector: 'lib-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  readonly service = inject(AuthService);
}
