import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { PublicSiteSettings } from './site-settings.models';

@Injectable({ providedIn: 'root' })
export class SiteSettingsApiService {
  private readonly http = inject(HttpClient);

  getPublicSettings() {
    return this.http.get<PublicSiteSettings>('/api/public/settings');
  }
}
