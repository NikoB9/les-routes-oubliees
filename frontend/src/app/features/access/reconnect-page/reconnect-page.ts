import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  ACCESS_RETURN_PARAM,
  safeReturnUrl,
} from '../../../core/api/cloudflare-access-session.service';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator';

/**
 * Page de reprise de session.
 *
 * Elle n'existe que pour son adresse. `/reconnexion` est exclu de `navigationUrls`, donc le
 * service worker ne la sert jamais depuis son cache : la navigation atteint Cloudflare, qui
 * redemande une authentification lorsque la session a expiré.
 *
 * Quand ce composant s'exécute, l'authentification a donc déjà eu lieu — Cloudflare a laissé
 * passer la navigation. Il n'appelle aucune API et se contente de ramener l'utilisateur là où il
 * était. `replaceUrl` évite que le bouton « précédent » ne le ramène ici.
 */
@Component({
  selector: 'app-reconnect-page',
  imports: [LoadingIndicatorComponent],
  templateUrl: './reconnect-page.html',
  styleUrl: './reconnect-page.css',
})
export class ReconnectPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    const destination = safeReturnUrl(this.route.snapshot.queryParamMap.get(ACCESS_RETURN_PARAM));
    void this.router.navigateByUrl(destination, { replaceUrl: true });
  }
}
