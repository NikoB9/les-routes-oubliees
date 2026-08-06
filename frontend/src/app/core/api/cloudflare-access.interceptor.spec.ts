import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CloudflareAccessSessionService } from './cloudflare-access-session.service';
import { cloudflareAccessInterceptor } from './cloudflare-access.interceptor';

describe('cloudflareAccessInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: {
    reauthenticate: ReturnType<typeof vi.fn>;
    confirmValidSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    session = { reauthenticate: vi.fn(), confirmValidSession: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cloudflareAccessInterceptor])),
        provideHttpClientTesting(),
        { provide: CloudflareAccessSessionService, useValue: session },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('marks same-origin API calls as XMLHttpRequest requests', () => {
    http.get('/api/radar/snapshot').subscribe();

    const request = httpMock.expectOne('/api/radar/snapshot');

    expect(request.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    request.flush({});
  });

  it('does not mark the Home Assistant integration endpoint', () => {
    http.post('/api/integrations/home-assistant/radar/treasure-position', {}).subscribe();

    const request = httpMock.expectOne('/api/integrations/home-assistant/radar/treasure-position');

    expect(request.request.headers.has('X-Requested-With')).toBe(false);
    request.flush({});
  });

  it('leaves an external URL untouched', () => {
    http.get('https://tile.openstreetmap.org/1/2/3.png').subscribe();

    const request = httpMock.expectOne('https://tile.openstreetmap.org/1/2/3.png');

    expect(request.request.headers.has('X-Requested-With')).toBe(false);
    request.flush({});
  });

  it('keeps an application 401 without triggering a reload', () => {
    let received: number | null = null;
    http.get('/api/portal/me').subscribe({ error: (error: { status: number }) => (received = error.status) });

    httpMock.expectOne('/api/portal/me').flush(
      { code: 'application-unauthenticated' },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'X-LRO-Auth-Error': 'application' },
      },
    );

    expect(received).toBe(401);
    expect(session.reauthenticate).not.toHaveBeenCalled();
  });

  it('recognises the application marker carried by the response body alone', () => {
    http.get('/api/portal/me').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/portal/me')
      .flush({ code: 'application-unauthenticated' }, { status: 401, statusText: 'Unauthorized' });

    expect(session.reauthenticate).not.toHaveBeenCalled();
  });

  it('delegates Cloudflare reauthentication on an unmarked 401', () => {
    http.get('/api/portal/me').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/portal/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(session.reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('delegates once per failing request when several 401 arrive together', () => {
    http.get('/api/portal/me').subscribe({ error: () => undefined });
    http.get('/api/radar/snapshot').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/portal/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/radar/snapshot').flush({}, { status: 401, statusText: 'Unauthorized' });

    // La protection anti-boucle est portee par le service, pas par l'intercepteur.
    expect(session.reauthenticate).toHaveBeenCalledTimes(2);
  });

  it('never clears the reauthentication lock because a request succeeded', () => {
    http.get('/api/public/home').subscribe();

    httpMock.expectOne('/api/public/home').flush({});

    expect(session.confirmValidSession).not.toHaveBeenCalled();
  });

  it('leaves a business 403 untouched', () => {
    let received: number | null = null;
    http.get('/api/radar/snapshot').subscribe({ error: (error: { status: number }) => (received = error.status) });

    httpMock.expectOne('/api/radar/snapshot').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(received).toBe(403);
    expect(session.reauthenticate).not.toHaveBeenCalled();
  });
});
