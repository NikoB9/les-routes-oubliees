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

  /**
   * Signale le départ du Radar afin que le repère disparaisse immédiatement chez les
   * autres participants.
   *
   * La requête est volontairement détachée du composant : elle doit survivre à la
   * navigation Angular qui vient de le détruire. `keepalive` laisse une chance à l'envoi
   * lors d'une fermeture d'onglet, sans jamais le garantir : le TTL serveur reste le
   * filet de sécurité obligatoire.
   *
   * `HttpClient` n'est pas utilisé ici, donc le jeton XSRF est posé manuellement.
   */
  announceDeparture(): void {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    const xsrfToken = this.readXsrfToken();
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    void fetch('/api/radar/me/location', {
      method: 'DELETE',
      credentials: 'same-origin',
      keepalive: true,
      headers,
    }).catch(() => {
      // Le retrait immédiat n'est jamais garanti : le TTL serveur prend le relais.
    });
  }

  private readXsrfToken(): string | null {
    const entry = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    return entry ? decodeURIComponent(entry.slice('XSRF-TOKEN='.length)) : null;
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
