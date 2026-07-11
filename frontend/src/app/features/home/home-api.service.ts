import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { PublicHomeResponse } from './home-api.models';

@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);

  getHome() {
    return this.http.get<PublicHomeResponse>('/api/public/home');
  }
}
