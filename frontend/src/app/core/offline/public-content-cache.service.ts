import { HttpClient } from '@angular/common/http';
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

  async readSettings(): Promise<PublicSiteSettings | null> {
    return (await this.readSnapshot())?.settings ?? null;
  }

  async readHome(): Promise<PublicHomeResponse | null> {
    return (await this.readSnapshot())?.home ?? null;
  }

  async readMap(): Promise<PublicMapResponse | null> {
    return (await this.readSnapshot())?.map ?? null;
  }

  async readQuests(): Promise<PublicQuestSummary[] | null> {
    return (await this.readSnapshot())?.quests ?? null;
  }

  async readQuest(code: string): Promise<PublicQuestDetail | null> {
    const snapshot = await this.readSnapshot();
    return snapshot?.questDetails.find((quest) => quest.code === code) ?? null;
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
      const request = transaction.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Unable to write public cache'));
    });
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
