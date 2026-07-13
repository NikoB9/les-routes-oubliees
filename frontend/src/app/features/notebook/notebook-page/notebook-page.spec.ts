import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { PublicContentCacheService } from '../../../core/offline/public-content-cache.service';
import { NotebookPage } from './notebook-page';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('NotebookPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;

    await TestBed.configureTestingModule({
      imports: [NotebookPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PublicContentCacheService,
          useValue: {
            readQuests: () => Promise.resolve(null),
            readQuest: () => Promise.resolve(null),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ questCode: 'QUEST_1' })),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('keeps the public summary as plain text while rendering Markdown sections as HTML', () => {
    const fixture = TestBed.createComponent(NotebookPage);
    fixture.detectChanges();

    http.expectOne('/api/public/notebook').flush([
      {
        id: '50000000-0000-0000-0000-000000000001',
        code: 'QUEST_1',
        title: 'Quete revelee',
        summary: '**Resume** public',
        displayOrder: 1,
      },
    ]);
    http.expectOne('/api/public/notebook/QUEST_1').flush({
      id: '50000000-0000-0000-0000-000000000001',
      code: 'QUEST_1',
      title: 'Quete revelee',
      summary: '**Resume** public',
      displayOrder: 1,
      importantEventsHtml: '<p><strong>Evenement</strong></p>',
      discoveredCluesHtml: '',
      completedTrialsHtml: '',
      extraContentHtml: '',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.summary')?.textContent).toContain('**Resume** public');
    expect(compiled.querySelector('.summary strong')).toBeNull();
    expect(compiled.querySelector('.quest-section .markdown-content strong')?.textContent).toBe(
      'Evenement',
    );
  });
});
