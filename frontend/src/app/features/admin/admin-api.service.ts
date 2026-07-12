import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  AdminAllowedEmail,
  AdminAllowedEmailCreate,
  AdminAllowedEmailUpdate,
  AdminAuditLog,
  AdminDashboard,
} from './admin-api.models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  getDashboard() {
    return this.http.get<AdminDashboard>('/api/admin/dashboard');
  }

  listAllowedEmails() {
    return this.http.get<AdminAllowedEmail[]>('/api/admin/allowed-emails');
  }

  createAllowedEmail(payload: AdminAllowedEmailCreate) {
    return this.http.post<AdminAllowedEmail>('/api/admin/allowed-emails', payload);
  }

  updateAllowedEmail(id: string, payload: AdminAllowedEmailUpdate) {
    return this.http.put<AdminAllowedEmail>(
      `/api/admin/allowed-emails/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deleteAllowedEmail(id: string) {
    return this.http.delete<void>(`/api/admin/allowed-emails/${encodeURIComponent(id)}`);
  }

  listAuditLogs() {
    return this.http.get<AdminAuditLog[]>('/api/admin/audit-logs');
  }
}
