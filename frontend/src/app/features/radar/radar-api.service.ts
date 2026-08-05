import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RadarLocationPayload, RadarSnapshot } from './radar.models';

@Injectable({ providedIn: 'root' })
export class RadarApiService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);

  snapshot() {
    return this.http.get<RadarSnapshot>('/api/radar/snapshot');
  }

  updateLocation(payload: RadarLocationPayload) {
    return this.http.put<void>('/api/radar/me/location', payload);
  }

  events(): Observable<RadarSnapshot> {
    return new Observable<RadarSnapshot>((subscriber) => {
      const source = new EventSource('/api/radar/events');
      source.addEventListener('snapshot', (event) => {
        this.zone.run(() => subscriber.next(JSON.parse(event.data) as RadarSnapshot));
      });
      source.onerror = () => {
        this.zone.run(() => subscriber.error(new Error('Radar stream disconnected.')));
        source.close();
      };
      return () => source.close();
    });
  }
}
