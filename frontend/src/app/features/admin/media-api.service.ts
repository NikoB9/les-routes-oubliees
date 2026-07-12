import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AdminMedia } from './media-api.models';

@Injectable({ providedIn: 'root' })
export class MediaApiService {
  private readonly http = inject(HttpClient);

  listAdminMedia() {
    return this.http.get<AdminMedia[]>('/api/admin/media');
  }

  uploadAdminMedia(file: File, altText: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('altText', altText);
    return this.http.post<AdminMedia>('/api/admin/media', formData);
  }

  deleteAdminMedia(id: string) {
    return this.http.delete<void>(`/api/admin/media/${encodeURIComponent(id)}`);
  }
}
