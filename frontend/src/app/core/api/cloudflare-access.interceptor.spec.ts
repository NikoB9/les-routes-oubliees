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
    clearPendingReauthentication: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    session = { reauthenticate: vi.fn(), clearPendingReauthentication: vi.fn() };

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

  it('delegates Cloudflare reauthentication when a human API call receives 401', () => {
    http.get('/api/portal/me').subscribe({ error: () => undefined });
    http.get('/api/portal/me').subscribe({ error: () => undefined });

    const requests = httpMock.match('/api/portal/me');
    expect(requests.length).toBe(2);
    requests[0].flush({}, { status: 401, statusText: 'Unauthorized' });
    requests[1].flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(session.reauthenticate).toHaveBeenCalledTimes(2);
  });
});
