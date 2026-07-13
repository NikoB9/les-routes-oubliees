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

@Injectable({ providedIn: 'root' })
export class PublicContentCacheService {
  private readonly http = inject(HttpClient);
  private databasePromise: Promise<IDBDatabase> | null = null;

  async refreshIfNeeded(): Promise<void> {
    if (!this.supportsIndexedDb()) {
      return;
    }

    const remoteVersion = await firstValueFrom(
      this.http.get<PublicContentVersion>('/api/public/content-version'),
    );
    const localSnapshot = await this.readSnapshot();

    if (localSnapshot?.version === remoteVersion.version) {
      return;
    }

    const snapshot = await firstValueFrom(
      this.http.get<PublicOfflineSnapshot>('/api/public/offline-snapshot'),
    );
    await this.writeSnapshot(snapshot);
  }

  shouldUseOfflineFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    const browserReportsOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return browserReportsOffline || error.status === 0 || error.status === 504;
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
