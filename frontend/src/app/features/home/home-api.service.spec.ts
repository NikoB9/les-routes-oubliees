import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicContentCacheService } from '../../core/offline/public-content-cache.service';
import { PublicHomeResponse } from './home-api.models';
import { HomeApiService } from './home-api.service';

const cachedHome: PublicHomeResponse = {
  message: null,
  company: null,
  adventurers: [],
};

describe('HomeApiService', () => {
  let http: HttpTestingController;
  let service: HomeApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PublicContentCacheService,
          useValue: {
            shouldUseOfflineFallback: () => true,
            readHome: () => Promise.resolve(cachedHome),
            writeHome: () => Promise.resolve(),
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HomeApiService);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses the cached public snapshot when the network request fails', async () => {
    const result = new Promise<PublicHomeResponse>((resolve) => service.getHome().subscribe(resolve));

    http.expectOne('/api/public/home').flush({}, { status: 0, statusText: 'Offline' });

    await expect(result).resolves.toBe(cachedHome);
  });
});
