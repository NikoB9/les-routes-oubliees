import { describe, expect, it } from 'vitest';

import angularConfig from '../../../../angular.json';

const production =
  angularConfig.projects['les-routes-oubliees'].architect.build.configurations.production;

/**
 * La configuration de build décide seule de ce que le navigateur reçoit : une régression n'y
 * casse aucun test applicatif et ne se voit qu'en production, la compilation restant verte.
 */
describe('angular.json', () => {
  /**
   * `inlineCritical` est activé par défaut. Il cesse alors d'inclure la feuille globale
   * autrement que par `<link media="print" onload="this.media='all'">` — et `script-src 'self'`
   * interdit les gestionnaires d'évènements en ligne. Le `onload` ne s'exécute jamais, la
   * feuille reste destinée à l'impression, et **aucun style global ne s'applique**,
   * `leaflet.css` compris.
   *
   * La panne est difficile à lire : les styles de composants sont intégrés au JavaScript et
   * continuent de s'appliquer, donc la page paraît presque normale. Symptôme observé côté
   * Radar : les tuiles quittent le positionnement absolu, retombent dans le flux, et la carte
   * s'étire sans fin.
   */
  it('never inlines critical CSS, which the content security policy would strand', () => {
    expect(production.optimization.styles.inlineCritical).toBe(false);
  });

  /**
   * Le bloc `optimization` ci-dessus remplace le défaut de production au lieu de l'amender :
   * désactiver `inlineCritical` ne doit pas emporter avec lui la minification ni le reste.
   */
  it('keeps the rest of the production optimizations', () => {
    expect(production.optimization.scripts).toBe(true);
    expect(production.optimization.fonts).toBe(true);
    expect(production.optimization.styles.minify).toBe(true);
  });
});
