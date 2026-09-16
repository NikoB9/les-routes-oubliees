# Mise à jour applicative et suivi de l’audit admin

## Objectif

Permettre aux utilisateurs de recevoir chaque nouvelle version sans vider leur cache, tout en
préservant les saisies administratives en cours. Corriger également les retours restants de
l’audit de refactorisation de l’administration.

## Étapes

- [x] Auditer le fonctionnement PWA, les règles de cache, le déploiement et les retours admin.
- [x] Ajouter la détection Angular des nouvelles versions et un bandeau de rechargement accessible.
- [x] Durcir les en-têtes des fichiers du service worker et les contrôles de packaging.
- [x] Corriger le responsive Markdown, les libellés d’audit et les noms accessibles des paramètres.
- [x] Factoriser les styles admin communs sans modifier les mises en page métier.
- [x] Étendre les tests unitaires, responsive et d’accessibilité.
- [x] Exécuter les validations frontend, backend, Nginx, packaging et PWA applicables.
- [x] Effectuer les revues finales de cohérence, tests, sécurité et accessibilité.

## Risques et garde-fous

- Une mise à jour ne recharge jamais automatiquement l’onglet : l’utilisateur confirme afin de
  ne pas perdre un formulaire admin ou interrompre Radar.
- Le rechargement est complet ; `activateUpdate()` n’est pas utilisé seul afin de ne pas mélanger
  un ancien shell et de nouveaux chunks.
- Les caches IndexedDB et médias publics ne sont pas effacés. Les routes admin, Radar, portail,
  intégration et API sensibles restent exclues du cache hors ligne.
- Les fichiers non versionnés du service worker sont toujours revalidés. Les bundles hashés
  continuent à bénéficier du mécanisme normal d’Angular.
- Une session Cloudflare Access expirée peut retarder la détection jusqu’à la reconnexion, mais
  ne doit jamais imposer un vidage manuel du cache.

## Validation attendue

- `npm run lint`
- `npm test -- --watch=false`
- `npm run build`
- scénarios Playwright PWA, responsive et administration concernés
- `npm run test:a11y`
- validation de syntaxe des configurations Nginx et du script de déploiement
- génération et inspection de l’archive de livraison
- `./mvnw verify`
- audit final en lecture seule et relecture du diff

## Journal

- 2026-09-15 : audit initial terminé en lecture seule. Absence de gestion `SwUpdate`, en-têtes
  incomplets sur les fichiers PWA et sélecteur responsive admin obsolète confirmés. Choix produit
  validé : bandeau avec bouton, sans rechargement automatique.
- 2026-09-16 : implémentation terminée. La région d’annonce de mise à jour préexiste vide,
  le panneau réserve son espace sur toutes les tailles et le déploiement refuse une release sans
  les quatre fichiers de contrôle PWA ou sans leurs en-têtes `no-store`.
- 2026-09-16 : l’audit npm de production a signalé sept avis modérés Angular 22.0.x. Le verrou
  et les versions minimales ont été relevés vers Angular 22.1.6 / outils 22.1.8 ; le nouvel audit
  ne signale plus aucune vulnérabilité.
- 2026-09-16 : validations finales réussies : lint, 206 tests frontend, build Angular, 166 tests
  backend, deux syntaxes Nginx, syntaxe Bash, archive de release, smoke test des quatre ressources
  PWA, 15 parcours Axe et 2 scénarios Playwright responsive.
- 2026-09-16 : revues finales architecture, sécurité/tests et accessibilité effectuées en
  lecture seule. Aucun constat critique ; tous les constats moyens ont été corrigés avant livraison.
