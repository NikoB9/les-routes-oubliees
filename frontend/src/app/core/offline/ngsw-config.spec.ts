import { describe, expect, it } from 'vitest';

import config from '../../../../ngsw-config.json';

/**
 * Le manifeste du service worker décide seul du comportement hors ligne : une erreur de
 * motif ne casse aucun test applicatif et ne se voit qu'en navigateur, réseau coupé.
 */
describe('ngsw-config.json', () => {
  const negatives = config.navigationUrls.filter((url) => url.startsWith('!'));

  it('serves the application shell for navigations', () => {
    expect(config.navigationUrls).toContain('/**');
  });

  /**
   * Un motif négatif universel annule tous les motifs positifs : le service worker ne sert
   * alors plus aucune navigation, et le mode hors ligne devient inopérant sans qu'aucune
   * autre assertion ne l'indique.
   */
  it('never cancels every positive pattern', () => {
    expect(negatives).not.toContain('!/**');
    expect(negatives).not.toContain('!/**/*');
  });

  /**
   * Sans le document dans un groupe d'actifs, la coquille applicative n'est jamais mise en
   * cache et retirer le motif négatif ne suffirait pas.
   */
  it('caches the application shell', () => {
    const cachedFiles = config.assetGroups.flatMap((group) => group.resources.files);

    expect(cachedFiles).toContain('/index.html');
  });

  /** Choix produit : Radar et l'administration ne sont pas consultables hors ligne. */
  it('keeps Radar and administration out of the offline shell', () => {
    expect(negatives).toContain('!/radar');
    expect(negatives).toContain('!/admin');
    expect(negatives).toContain('!/admin/**');
  });

  /** Les requêtes de fichiers ne doivent jamais recevoir le document HTML. */
  it('never serves the shell for file requests', () => {
    expect(negatives).toContain('!/**/*.*');
  });
});
