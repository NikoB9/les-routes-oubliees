import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('imports an IGN .carte file through the Radar points endpoint', () => {
    const file = new File(['{}'], 'sample.carte', { type: 'application/json' });

    service.importRadarCarte(file).subscribe();

    const request = http.expectOne('/api/admin/radar/points/import-carte');

    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush([]);
  });

  it('updates a Radar point activation and media association', () => {
    service.updateRadarPoint('point/1', { active: false, imageMediaId: null }).subscribe();

    const request = http.expectOne('/api/admin/radar/points/point%2F1');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ active: false, imageMediaId: null });
    request.flush({
      id: 'point/1',
      title: 'Point',
      description: 'Description',
      latitude: 48.6,
      longitude: 3.1,
      active: false,
      displayOrder: 1,
      sourceImageKey: null,
      imageMediaId: null,
      imageUrl: null,
      imageAltText: null,
      createdAt: '2026-08-23T10:00:00Z',
      updatedAt: '2026-08-23T10:00:00Z',
    });
  });
});
