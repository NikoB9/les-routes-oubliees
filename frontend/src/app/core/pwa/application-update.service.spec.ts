import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APPLICATION_RELOAD, ApplicationUpdateService } from './application-update.service';

describe('ApplicationUpdateService', () => {
  let stable: BehaviorSubject<boolean>;
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  async function settleUpdateCheck(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  function configure(enabled = true): ApplicationUpdateService {
    stable = new BehaviorSubject(false);
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject();
    checkForUpdate = vi.fn(() => Promise.resolve(false));
    reload = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: ApplicationRef, useValue: { isStable: stable } },
        {
          provide: SwUpdate,
          useValue: { isEnabled: enabled, versionUpdates, unrecoverable, checkForUpdate },
        },
        { provide: APPLICATION_RELOAD, useValue: reload },
      ],
    });

    return TestBed.inject(ApplicationUpdateService);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing when the service worker is disabled', () => {
    const service = configure(false);
    stable.next(true);
    window.dispatchEvent(new Event('online'));

    expect(service.isAvailable()).toBe(false);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('checks after stabilization, every thirty minutes, online and when visible', async () => {
    configure();
    stable.next(true);
    await settleUpdateCheck();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30 * 60 * 1000);
    await settleUpdateCheck();
    window.dispatchEvent(new Event('online'));
    await settleUpdateCheck();
    document.dispatchEvent(new Event('visibilitychange'));
    await settleUpdateCheck();

    expect(checkForUpdate).toHaveBeenCalledTimes(4);
  });

  it('starts checking after thirty seconds when the application never stabilizes', async () => {
    configure();

    vi.advanceTimersByTime(30_000);
    await settleUpdateCheck();

    expect(checkForUpdate).toHaveBeenCalledOnce();
  });

  it('does not overlap update checks', async () => {
    let finishCheck: (() => void) | undefined;
    const pendingCheck = new Promise<boolean>((resolve) => {
      finishCheck = () => resolve(false);
    });
    const service = configure();
    checkForUpdate.mockReturnValue(pendingCheck);

    stable.next(true);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    finishCheck?.();
    await pendingCheck;
    await settleUpdateCheck();
    expect(service.isAvailable()).toBe(false);
  });

  it('offers a full reload when a new version is ready', () => {
    const service = configure();

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(service.isAvailable()).toBe(true);
    expect(service.isRecoveryRequired()).toBe(false);

    service.reload();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('requests a reload when the current version becomes unrecoverable', () => {
    const service = configure();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing chunk' });

    expect(service.isAvailable()).toBe(true);
    expect(service.isRecoveryRequired()).toBe(true);
  });

  it('tolerates a failed update check', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = configure();
    checkForUpdate.mockRejectedValue(new Error('offline'));

    stable.next(true);
    await settleUpdateCheck();

    expect(service.isAvailable()).toBe(false);
    expect(warning).toHaveBeenCalledOnce();
  });

  it('reports a version installation failure without replacing the current version', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = configure();

    versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new' },
      error: 'download failed',
    });

    expect(service.isAvailable()).toBe(false);
    expect(error).toHaveBeenCalledOnce();
  });
});
