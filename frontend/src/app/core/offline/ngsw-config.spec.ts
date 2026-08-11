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

  /**
   * `/cdn-cgi/access/logout` est servi par l'edge Cloudflare, jamais par l'application. Sans
   * ce motif négatif, le service worker répond la coquille depuis son cache : la requête ne
   * quitte pas le navigateur, la session Access survit et l'utilisateur voit « Page
   * introuvable » au lieu d'être déconnecté. Le motif `!/**\/*.*` ne suffit pas, le dernier
   * segment `logout` ne contenant aucun point.
   */
  it('lets Cloudflare handle its own endpoints', () => {
    expect(negatives).toContain('!/cdn-cgi/**');
  });

  /**
   * `/reconnexion` n'a de valeur que s'il atteint le réseau : c'est la seule façon pour
   * Cloudflare Access de voir passer la demande et de redemander une authentification. Servi
   * depuis le cache, il ne ferait rien du tout — et le lien « Se reconnecter » redeviendrait
   * inerte partout sauf sur `/radar` et `/admin`, défaut invisible hors production.
   */
  it('keeps the session recovery path out of the offline shell', () => {
    expect(negatives).toContain('!/reconnexion');
  });

  /**
   * Tout le contenu visuel public passe par `/media/{uuid}` : la carte révélée, les avatars,
   * l'emblème, le logo. Sans ce groupe, l'instantané hors ligne arrive complet et toutes les
   * images sont cassées — la page Carte se retrouve vide de sa carte.
   */
  it('caches public media for offline use', () => {
    const media = config.dataGroups.find((group) => group.urls.includes('/media/**'));

    expect(media).toBeDefined();
    // `performance` et non `freshness` : hors ligne, une image doit être servie sans que le
    // service worker attende d'abord l'expiration d'un délai réseau.
    expect(media?.cacheConfig.strategy).toBe('performance');
  });
});
