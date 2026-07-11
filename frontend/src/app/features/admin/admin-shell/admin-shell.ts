import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { AdminSession } from '../../../core/auth/admin-session';

@Component({
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly authService = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly error = signal(false);

  constructor() {
    this.authService.currentSession().subscribe({
      next: (session) => this.session.set(session),
      error: () => this.error.set(true),
    });
  }

  protected logout() {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/admin/login']),
      error: () => this.error.set(true),
    });
  }
}
