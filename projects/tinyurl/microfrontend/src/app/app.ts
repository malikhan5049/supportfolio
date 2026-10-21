import { Component, OnInit, computed, inject } from '@angular/core';import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthTokenStore } from 'shared-ui-lib';

/** The app chrome: sign-in link when anonymous, the principal's name and sign-out when active. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(AuthTokenStore);

  readonly displayName = computed(() => this.store.session()?.principal.displayName ?? null);

  ngOnInit(): void {
    // The store hydrates from sessionStorage at construction; the computed signal reads it.
    this.store.session();
  }

  signOut(): void {
    this.store.clear();
  }
}
