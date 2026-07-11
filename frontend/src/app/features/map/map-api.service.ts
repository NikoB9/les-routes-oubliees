import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { PublicMapResponse } from './map-api.models';

@Injectable({ providedIn: 'root' })
export class MapApiService {
  private readonly http = inject(HttpClient);

  getMap() {
    return this.http.get<PublicMapResponse>('/api/public/map');
  }
}
