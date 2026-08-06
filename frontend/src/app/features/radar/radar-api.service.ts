import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RadarLocationPayload, RadarSnapshot, RadarStreamEvent } from './radar.models';

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

  /**
   * Flux d'événements Radar, reconnexion comprise.
   *
   * `EventSource` rétablit lui-même la liaison après une coupure — sauf si le code appelle
   * `close()`, ce qui annule définitivement ses tentatives. La fermeture n'a donc lieu qu'au
   * désabonnement, à la destruction du composant.
   *
   * Une erreur avec `readyState` à `CONNECTING` est une coupure transitoire : le navigateur
   * réessaie, le flux est seulement dégradé. Seul l'état `CLOSED` — réponse non conforme,
   * redirection Cloudflare Access — est définitif et termine l'observable en erreur.
   */
  events(): Observable<RadarStreamEvent> {
    return new Observable<RadarStreamEvent>((subscriber) => {
      const source = new EventSource('/api/radar/events');
      source.addEventListener('open', () => {
        this.zone.run(() => subscriber.next({ kind: 'connected' }));
      });
      source.addEventListener('snapshot', (event) => {
        const snapshot = JSON.parse(event.data) as RadarSnapshot;
        this.zone.run(() => subscriber.next({ kind: 'snapshot', snapshot }));
      });
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
          this.zone.run(() => subscriber.error(new Error('Radar stream closed.')));
          return;
        }
        this.zone.run(() => subscriber.next({ kind: 'reconnecting' }));
      };
      return () => source.close();
    });
  }
}
