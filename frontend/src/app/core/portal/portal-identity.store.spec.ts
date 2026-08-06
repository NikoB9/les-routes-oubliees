import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareAccessSessionService } from '../api/cloudflare-access-session.service';
import { PortalApiService } from './portal-api.service';
import { PortalIdentityStore } from './portal-identity.store';
import { PortalMe } from './portal.models';

describe('PortalIdentityStore', () => {
  let store: PortalIdentityStore;
  let api: {
    me: ReturnType<typeof vi.fn>;
    chooseAdventurer: ReturnType<typeof vi.fn>;
    chooseGuest: ReturnType<typeof vi.fn>;
  };
  let accessSession: { confirmValidSession: ReturnType<typeof vi.fn> };

  const unassigned: PortalMe = {
    identity: {
      id: 'identity-1',
      accessMode: 'UNASSIGNED',
      adventurerId: null,
      displayName: null,
      avatarPath: null,
      selectedAt: null,
    },
    availableAdventurers: [
      {
        id: 'adventurer-1',
        name: 'Aurelune',
        title: 'Gardienne des Secrets',
        avatarPath: null,
        avatarAlt: null,
      },
    ],
    guestAvailable: false,
    canAccessAdmin: false,
  };

  const assigned: PortalMe = {
    ...unassigned,
    identity: {
      ...unassigned.identity,
      accessMode: 'ADVENTURER',
      adventurerId: 'adventurer-1',
      displayName: 'Aurelune',
      selectedAt: '2026-08-05T12:00:00Z',
    },
    availableAdventurers: [],
  };

  beforeEach(() => {
    api = {
      me: vi.fn(() => of(unassigned)),
      chooseAdventurer: vi.fn(() => of(assigned)),
      chooseGuest: vi.fn(() => of(assigned)),
    };
    accessSession = { confirmValidSession: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: PortalApiService, useValue: api },
        { provide: CloudflareAccessSessionService, useValue: accessSession },
      ],
    });

    store = TestBed.inject(PortalIdentityStore);
  });

  it('exposes the loaded identity and its derived state', () => {
    store.load();

    expect(store.identity()?.id).toBe('identity-1');
    expect(store.needsAssignment()).toBe(true);
    expect(store.assigned()).toBe(false);
    expect(store.canAccessAdmin()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('does not reload without force, and reloads with it', () => {
    store.load();
    store.load();

    expect(api.me).toHaveBeenCalledTimes(1);

    store.load(true);

    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('never starts a second load while one is pending', () => {
    const pending = new Subject<PortalMe>();
    api.me.mockReturnValue(pending.asObservable());

    store.load();
    store.load(true);

    expect(api.me).toHaveBeenCalledTimes(1);
  });

  /**
   * Le chargement de l'identité est la seule preuve d'une session Cloudflare Access valide :
   * c'est lui, et lui seul, qui libère le verrou anti-boucle de reconnexion.
   */
  it('confirms the Cloudflare session only when the identity is loaded', () => {
    store.load();

    expect(accessSession.confirmValidSession).toHaveBeenCalledTimes(1);
  });

  it('never confirms the Cloudflare session when the load fails', () => {
    api.me.mockReturnValue(throwError(() => new Error('offline')));

    store.load();

    expect(accessSession.confirmValidSession).not.toHaveBeenCalled();
    expect(store.error()).toBe(true);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('keeps the confirmation dialog state around the assignment', () => {
    store.load();
    store.askAssignment(unassigned.availableAdventurers[0]);

    expect(store.confirmingAdventurer()?.id).toBe('adventurer-1');

    store.cancelAssignment();

    expect(store.confirmingAdventurer()).toBeNull();
  });

  it('applies a confirmed assignment', () => {
    store.load();
    store.askAssignment(unassigned.availableAdventurers[0]);
    store.confirmAssignment();

    expect(api.chooseAdventurer).toHaveBeenCalledWith('adventurer-1');
    expect(store.identity()?.accessMode).toBe('ADVENTURER');
    expect(store.assigned()).toBe(true);
    expect(store.confirmingAdventurer()).toBeNull();
    expect(store.assignmentConflict()).toBe(false);
  });

  it('ignores a confirmation without any pending choice', () => {
    store.load();
    store.confirmAssignment();

    expect(api.chooseAdventurer).not.toHaveBeenCalled();
  });

  /** Un autre aventurier a pu choisir le même personnage : l'état doit être resynchronisé. */
  it('reports a conflict and reloads when the assignment is refused', () => {
    api.chooseAdventurer.mockReturnValue(throwError(() => new Error('conflict')));

    store.load();
    store.askAssignment(unassigned.availableAdventurers[0]);
    store.confirmAssignment();

    expect(store.assignmentConflict()).toBe(true);
    expect(store.confirmingAdventurer()).toBeNull();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('reloads when the guest choice is refused', () => {
    api.chooseGuest.mockReturnValue(throwError(() => new Error('conflict')));

    store.load();
    store.chooseGuest();

    expect(api.me).toHaveBeenCalledTimes(2);
  });
});
