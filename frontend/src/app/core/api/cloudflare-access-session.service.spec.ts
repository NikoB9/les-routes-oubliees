import { TestBed } from '@angular/core/testing';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';

describe('CloudflareAccessSessionService', () => {
  let service: CloudflareAccessSessionService;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://routes.example.invalid/radar', assign },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudflareAccessSessionService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('reloads the page once on the first Access expiry', () => {
    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://routes.example.invalid/radar');
    expect(service.reconnectRequired()).toBe(false);
  });

  it('never reloads twice and offers a stable reconnection action instead', () => {
    service.reauthenticate();
    service.reauthenticate();
    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(service.reconnectRequired()).toBe(true);
  });

  it('keeps the lock across a page load until a valid session is confirmed', () => {
    service.reauthenticate();
    expect(assign).toHaveBeenCalledTimes(1);

    // Nouvelle instance : le verrou survit dans sessionStorage.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(CloudflareAccessSessionService);

    reloaded.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(reloaded.reconnectRequired()).toBe(true);
  });

  it('clears the lock only when a valid session is confirmed', () => {
    service.reauthenticate();
    service.confirmValidSession();

    expect(service.reconnectRequired()).toBe(false);

    service.reauthenticate();

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('retries the Cloudflare journey on explicit user request', () => {
    service.reauthenticate();
    service.reauthenticate();
    expect(service.reconnectRequired()).toBe(true);

    service.retryNow();

    expect(assign).toHaveBeenCalledTimes(2);
    expect(service.reconnectRequired()).toBe(false);
  });
});
