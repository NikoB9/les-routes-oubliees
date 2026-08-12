import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PublicSiteSettings } from '../config/site-settings.models';
import { PublicHomeResponse } from '../../features/home/home-api.models';
import { PublicMapResponse } from '../../features/map/map-api.models';
import {
  PublicQuestDetail,
  PublicQuestSummary,
} from '../../features/notebook/notebook-api.models';
import { PublicContentVersion, PublicOfflineSnapshot } from './public-offline.models';

const DATABASE_NAME = 'les-routes-oubliees-public-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'current';
const SETTINGS_KEY = 'settings';
const HOME_KEY = 'home';
const MAP_KEY = 'map';
const QUESTS_KEY = 'quests';
const QUEST_DETAIL_PREFIX = 'quest:';
const OFFLINE_FALLBACK_HTTP_STATUSES = new Set([0, 401, 403, 502, 503, 504]);

/**
 * Repère une URL de média dans l'instantané, quel que soit l'endroit où elle figure.
 *
 * Même motif que `MarkdownRenderer.MEDIA_IMAGE` côté serveur. Balayer le JSON sérialisé
 * plutôt qu'énumérer les champs couvre d'un seul geste les chemins explicites — logo,
 * emblème, avatars, image de carte — et les images intégrées dans le HTML déjà rendu, sans
 * qu'une évolution des DTO puisse laisser un média en arrière.
 */
const MEDIA_URL = /\/media\/[0-9a-fA-F-]{36}/g;

@Injectable({ providedIn: 'root' })
export class PublicContentCacheService {
  private readonly http = inject(HttpClient);
  private databasePromise: Promise<IDBDatabase> | null = null;
  private prefetchedVersion: string | null = null;

  async refreshIfNeeded(): Promise<void> {
    if (!this.supportsIndexedDb()) {
      return;
    }

    const remoteVersion = await firstValueFrom(
      this.http.get<PublicContentVersion>('/api/public/content-version'),
    );
    const localSnapshot = await this.readSnapshot();

    if (localSnapshot && localSnapshot.version === remoteVersion.version) {
      // Le contenu n'a pas bougé, mais les médias ne sont pas forcément déjà rapatriés :
      // voir `prefetchMedia`. Volontairement non attendu, l'affichage des pages ne doit pas
      // dépendre du rapatriement des images.
      void this.prefetchMedia(localSnapshot);
      return;
    }

    const snapshot = await firstValueFrom(
      this.http.get<PublicOfflineSnapshot>('/api/public/offline-snapshot'),
    );
    await this.writeSnapshot(snapshot);
    void this.prefetchMedia(snapshot);
  }

  /**
   * Fait entrer dans le cache du service worker les médias référencés par l'instantané.
   *
   * Sans cela, une image n'est disponible hors ligne que si la page qui la porte a déjà été
   * consultée en ligne : un joueur qui part sur le terrain sans avoir ouvert la Carte n'en
   * aurait aucune.
   *
   * Le rapatriement ne peut pas être adossé à la seule écriture d'un nouvel instantané. Au
   * tout premier chargement, le service worker n'a pas encore la main — Angular ne
   * l'enregistre qu'une fois l'application stabilisée — et les visites suivantes trouvent la
   * version inchangée : les deux conditions ne coïncideraient jamais et aucun média ne serait
   * rapatrié. Il est donc tenté à chaque rafraîchissement, et n'est marqué comme fait qu'une
   * fois réellement lancé.
   */
  private async prefetchMedia(snapshot: PublicOfflineSnapshot): Promise<void> {
    // Sans service worker aux commandes, aucun cache ne recueillerait ces réponses : le
    // trafic serait pur gaspillage. C'est le cas en développement, le service worker n'étant
    // enregistré qu'en production. Aucun marquage ici : la tentative doit se répéter jusqu'à
    // ce qu'il prenne la main.
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
      return;
    }

    // Une fois par version et par chargement de page : les requêtes suivantes seraient
    // servies depuis le cache du service worker, mais les répéter à chaque navigation reste
    // du travail inutile.
    if (this.prefetchedVersion === snapshot.version) {
      return;
    }
    this.prefetchedVersion = snapshot.version;

    const urls = new Set(JSON.stringify(snapshot).match(MEDIA_URL) ?? []);

    // `allSettled` et non `all` : un média supprimé entre-temps ne doit jamais faire échouer
    // le rafraîchissement, ni empêcher la mise en cache des autres.
    await Promise.allSettled(
      [...urls].map((url) => fetch(url, { credentials: 'same-origin' })),
    );
  }

  shouldUseOfflineFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    const browserReportsOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return browserReportsOffline || OFFLINE_FALLBACK_HTTP_STATUSES.has(error.status);
  }

  async readSettings(): Promise<PublicSiteSettings | null> {
    return (
      (await this.readSnapshot())?.settings ??
      (await this.readEntry<PublicSiteSettings>(SETTINGS_KEY))
    );
  }

  async readHome(): Promise<PublicHomeResponse | null> {
    return (await this.readSnapshot())?.home ?? (await this.readEntry<PublicHomeResponse>(HOME_KEY));
  }

  async readMap(): Promise<PublicMapResponse | null> {
    return (await this.readSnapshot())?.map ?? (await this.readEntry<PublicMapResponse>(MAP_KEY));
  }

  async readQuests(): Promise<PublicQuestSummary[] | null> {
    return (
      (await this.readSnapshot())?.quests ??
      (await this.readEntry<PublicQuestSummary[]>(QUESTS_KEY))
    );
  }

  async readQuest(code: string): Promise<PublicQuestDetail | null> {
    const snapshot = await this.readSnapshot();
    return (
      snapshot?.questDetails.find((quest) => quest.code === code) ??
      (await this.readEntry<PublicQuestDetail>(this.questDetailKey(code)))
    );
  }

  async writeSettings(settings: PublicSiteSettings): Promise<void> {
    await this.writeEntry(SETTINGS_KEY, settings);
  }

  async writeHome(home: PublicHomeResponse): Promise<void> {
    await this.writeEntry(HOME_KEY, home);
  }

  async writeMap(map: PublicMapResponse): Promise<void> {
    await this.writeEntry(MAP_KEY, map);
  }

  async writeQuests(quests: PublicQuestSummary[]): Promise<void> {
    await this.writeEntry(QUESTS_KEY, quests);
  }

  async writeQuest(quest: PublicQuestDetail): Promise<void> {
    await this.writeEntry(this.questDetailKey(quest.code), quest);
  }

  private async readSnapshot(): Promise<PublicOfflineSnapshot | null> {
    if (!this.supportsIndexedDb()) {
      return null;
    }

    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);

      request.onsuccess = () => resolve((request.result as PublicOfflineSnapshot | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read public cache'));
    });
  }

  private async writeSnapshot(snapshot: PublicOfflineSnapshot): Promise<void> {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(snapshot, SNAPSHOT_KEY);
      store.put(snapshot.settings, SETTINGS_KEY);
      store.put(snapshot.home, HOME_KEY);
      store.put(snapshot.map, MAP_KEY);
      store.put(snapshot.quests, QUESTS_KEY);
      for (const quest of snapshot.questDetails) {
        store.put(quest, this.questDetailKey(quest.code));
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write public cache'));
    });
  }

  private async readEntry<T>(key: string): Promise<T | null> {
    if (!this.supportsIndexedDb()) {
      return null;
    }

    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);

      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read public cache entry'));
    });
  }

  private async writeEntry<T>(key: string, value: T): Promise<void> {
    if (!this.supportsIndexedDb()) {
      return;
    }

    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Unable to write public cache entry'));
    });
  }

  private questDetailKey(code: string): string {
    return `${QUEST_DETAIL_PREFIX}${code}`;
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open public cache'));
    });

    return this.databasePromise;
  }

  private supportsIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
  }
}
