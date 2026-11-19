import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Every app's login page: one button, one denial state, one Identity entry point. */
@Component({
  selector: 'lib-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent implements OnInit {
  readonly service = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly demoAvailable = signal(false);

  ngOnInit(): void {
    this.http.get<{ demoLogin: boolean }>('/api/features').subscribe({
      next: (features) => this.demoAvailable.set(features.demoLogin === true),
      error: () => this.demoAvailable.set(false),
    });
  }

  demoLogin(): void {
    this.http.post<{ code: string }>('/api/demo-login', {}).subscribe({
      next: ({ code }) => this.router.navigate(['/auth/callback'], { queryParams: { code } }),
    });
  }
}
