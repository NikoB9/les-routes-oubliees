import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AdminSession } from './admin-session';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);

  currentSession() {
    return this.http.get<AdminSession>('/api/admin/me');
  }
}
