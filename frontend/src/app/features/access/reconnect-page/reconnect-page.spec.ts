import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, Routes, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ReconnectPage } from './reconnect-page';

@Component({ selector: 'app-stub-page', template: '<p>page</p>' })
class StubPage {}

describe('ReconnectPage', () => {
  let navigateByUrl: ReturnType<typeof vi.fn>;

  /**
   * Le composant ne consulte aucune API : quand il s'exécute, Cloudflare a déjà laissé passer la
   * navigation, donc la session est rétablie. Seul le rebond est à couvrir.
   */
  function render(retour: string | null): ComponentFixture<ReconnectPage> {
    navigateByUrl = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      imports: [ReconnectPage],
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(retour === null ? {} : { retour }),
            },
          },
        },
      ],
    });

    return TestBed.createComponent(ReconnectPage);
  }

  it('returns to the consulted page', () => {
    render('/notebook/quete-1');

    expect(navigateByUrl).toHaveBeenCalledWith('/notebook/quete-1', { replaceUrl: true });
  });

  /** Sans `replaceUrl`, le bouton « précédent » ramènerait sur la page de reprise. */
  it('replaces its own history entry', () => {
    render('/map');

    expect(navigateByUrl).toHaveBeenCalledWith('/map', { replaceUrl: true });
  });

  it('falls back to the home page without a return address', () => {
    render(null);

    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('refuses a return address that would leave the site', () => {
    render('//ailleurs.example');

    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('announces the bounce while it happens', () => {
    const fixture = render('/map');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Reprise');
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Retour');
  });

  /**
   * Les cas ci-dessus pilotent un routeur factice : ils décrivent l'intention, pas le résultat.
   * Rebondir depuis le constructeur d'un composant activé par une navigation en cours est
   * précisément le genre de détail qui passe en test et échoue en vrai. Ce cas fait donc tourner
   * le vrai `Router`, sur une table de routes réduite pour ne pas entraîner les pages métier.
   */
  describe('driven by the real router', () => {
    const testRoutes: Routes = [
      { path: '', component: StubPage },
      { path: 'map', component: StubPage },
      {
        path: 'reconnexion',
        loadComponent: () => import('./reconnect-page').then((module) => module.ReconnectPage),
      },
    ];

    async function navigate(url: string): Promise<Router> {
      TestBed.configureTestingModule({ providers: [provideRouter(testRoutes)] });
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      const router = TestBed.inject(Router);
      // La reprise est demandée pendant l'activation : la navigation qu'elle déclenche est encore
      // en vol au retour de `navigateByUrl`. L'attente est bornée, et laisse l'assertion échouer
      // sur l'adresse réellement atteinte plutôt que sur un dépassement de délai.
      for (let attempt = 0; attempt < 20 && router.url.startsWith('/reconnexion'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return router;
    }

    it('leaves the browser on the consulted page', async () => {
      const router = await navigate('/reconnexion?retour=%2Fmap');

      expect(router.url).toBe('/map');
    });

    it('leaves the browser on the home page when the address is refused', async () => {
      const router = await navigate('/reconnexion?retour=%2F%2Failleurs.example');

      expect(router.url).toBe('/');
    });
  });
});
