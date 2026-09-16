import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { AdminSession } from '../../../core/auth/admin-session';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayoutShell {
  private readonly authService = inject(AdminAuthService);

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly sessionError = signal(false);

  constructor() {
    this.authService.currentSession().subscribe({
      next: (session) => {
        if (session.authenticated) {
          this.session.set(session);
        } else {
          this.sessionError.set(true);
        }
      },
      error: () => this.sessionError.set(true),
    });
  }
}
