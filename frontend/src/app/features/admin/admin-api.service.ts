import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  AdminAllowedEmail,
  AdminAllowedEmailCreate,
  AdminAllowedEmailUpdate,
  AdminAdventurer,
  AdminAdventurerUpsert,
  AdminAuditLog,
  AdminCompany,
  AdminCompanyUpdate,
  AdminDashboard,
  AdminHomeMessage,
  AdminHomeMessageUpsert,
  AdminMapMarker,
  AdminMapMarkerUpsert,
  AdminMapPreview,
  AdminMapVision,
  AdminMapVisionUpsert,
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

  listHomeMessages() {
    return this.http.get<AdminHomeMessage[]>('/api/admin/home/messages');
  }

  createHomeMessage(payload: AdminHomeMessageUpsert) {
    return this.http.post<AdminHomeMessage>('/api/admin/home/messages', payload);
  }

  updateHomeMessage(id: string, payload: AdminHomeMessageUpsert) {
    return this.http.put<AdminHomeMessage>(
      `/api/admin/home/messages/${encodeURIComponent(id)}`,
      payload,
    );
  }

  activateHomeMessage(id: string) {
    return this.http.post<AdminHomeMessage>(
      `/api/admin/home/messages/${encodeURIComponent(id)}/activate`,
      {},
    );
  }

  deleteHomeMessage(id: string) {
    return this.http.delete<void>(`/api/admin/home/messages/${encodeURIComponent(id)}`);
  }

  getCompany() {
    return this.http.get<AdminCompany>('/api/admin/group');
  }

  updateCompany(payload: AdminCompanyUpdate) {
    return this.http.put<AdminCompany>('/api/admin/group', payload);
  }

  listAdventurers() {
    return this.http.get<AdminAdventurer[]>('/api/admin/adventurers');
  }

  createAdventurer(payload: AdminAdventurerUpsert) {
    return this.http.post<AdminAdventurer>('/api/admin/adventurers', payload);
  }

  updateAdventurer(id: string, payload: AdminAdventurerUpsert) {
    return this.http.put<AdminAdventurer>(
      `/api/admin/adventurers/${encodeURIComponent(id)}`,
      payload,
    );
  }

  reorderAdventurers(orderedIds: string[]) {
    return this.http.put<AdminAdventurer[]>('/api/admin/adventurers/reorder', { orderedIds });
  }

  deleteAdventurer(id: string) {
    return this.http.delete<void>(`/api/admin/adventurers/${encodeURIComponent(id)}`);
  }

  listMapVisions() {
    return this.http.get<AdminMapVision[]>('/api/admin/map-views');
  }

  createMapVision(payload: AdminMapVisionUpsert) {
    return this.http.post<AdminMapVision>('/api/admin/map-views', payload);
  }

  updateMapVision(id: string, payload: AdminMapVisionUpsert) {
    return this.http.put<AdminMapVision>(
      `/api/admin/map-views/${encodeURIComponent(id)}`,
      payload,
    );
  }

  activateMapVision(id: string) {
    return this.http.post<AdminMapVision>(
      `/api/admin/map-views/${encodeURIComponent(id)}/activate`,
      {},
    );
  }

  deleteMapVision(id: string) {
    return this.http.delete<void>(`/api/admin/map-views/${encodeURIComponent(id)}`);
  }

  listMapMarkers() {
    return this.http.get<AdminMapMarker[]>('/api/admin/map-markers');
  }

  createMapMarker(payload: AdminMapMarkerUpsert) {
    return this.http.post<AdminMapMarker>('/api/admin/map-markers', payload);
  }

  updateMapMarker(id: string, payload: AdminMapMarkerUpsert) {
    return this.http.put<AdminMapMarker>(
      `/api/admin/map-markers/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deleteMapMarker(id: string) {
    return this.http.delete<void>(`/api/admin/map-markers/${encodeURIComponent(id)}`);
  }

  previewMap(visionId: string) {
    return this.http.get<AdminMapPreview>('/api/admin/map-preview', {
      params: { visionId },
    });
  }
}
