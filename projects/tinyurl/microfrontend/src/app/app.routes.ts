import { Route } from '@angular/router';
import { AuthCallbackComponent, LoginPageComponent } from 'shared-ui-lib';
import { BrowsePageComponent } from './browse/browse-page.component';

export const appRoutes: Route[] = [
  { path: '', component: BrowsePageComponent },
  { path: 'signin', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
];
