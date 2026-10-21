import { AuthCallbackComponent, LoginPageComponent } from 'shared-ui-lib';
import { BrowsePageComponent } from './browse/browse-page.component';
import { appRoutes } from './app.routes';

describe('app routes', () => {
  it('routes the app to browse, its own sign-in, and the shared callback', () => {
    expect(appRoutes.find((r) => r.path === '')?.component).toBe(BrowsePageComponent);
    expect(appRoutes.find((r) => r.path === 'signin')?.component).toBe(LoginPageComponent);
    expect(appRoutes.find((r) => r.path === 'auth/callback')?.component).toBe(
      AuthCallbackComponent,
    );
  });
});
