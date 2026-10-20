import { Route } from '@angular/router';
import { LoginPageComponent, AuthCallbackComponent } from 'shared-ui-lib';
import { CatalogPageComponent } from './catalog/catalog-page.component';

export const appRoutes: Route[] = [
  { path: '', component: CatalogPageComponent, pathMatch: 'full' },
  { path: 'signin', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
];
