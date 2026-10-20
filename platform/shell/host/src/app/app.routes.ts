import { Route } from '@angular/router';
import { LoginPageComponent, AuthCallbackComponent } from 'shared-ui-lib';

export const appRoutes: Route[] = [
  // The catalog route arrives with Task 14; these are the auth routes only.
  { path: 'signin', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
];
