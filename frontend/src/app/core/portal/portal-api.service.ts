import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { PortalMe } from './portal.models';

@Injectable({ providedIn: 'root' })
export class PortalApiService {
  private readonly http = inject(HttpClient);

  me() {
    return this.http.get<PortalMe>('/api/portal/me');
  }

  chooseAdventurer(adventurerId: string) {
    return this.http.post<PortalMe>('/api/portal/me/adventurer', { adventurerId });
  }

  chooseGuest() {
    return this.http.post<PortalMe>('/api/portal/me/guest', {});
  }
}
