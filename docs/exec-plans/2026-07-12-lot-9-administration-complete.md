# Lot 9 - Administration complete

## Objectif

Completer l'administration MVP avec tableau de bord, formulaires manquants, preview, gestion des administrateurs et journal d'audit leger, en conservant une orchestration sobre en tokens.

## Perimetre

- Backend : APIs admin manquantes, audit, gestion des administrateurs, services de tableau de bord, validations serveur et tests.
- Frontend : navigation admin structuree, formulaires, etats chargement/erreur/vide, preview identifiee, pages administrateurs et audit.
- Securite : maintien OIDC, allowlist, CSRF, routes admin protegees, aucune fuite d'emails ou d'audit via API publique.
- Accessibilite : formulaires avec labels visibles, erreurs associees, focus utilisable, navigation clavier et messages dynamiques sobres.

## Hors perimetre

- Roles complexes.
- Versioning complet des contenus.
- Rollback editorial.
- Chat, Telegram, temps reel ou notifications.
- Refonte visuelle globale du site public.

## Strategie de cout et qualite

Le fil principal reste responsable des decisions de conception, des modifications de code, de la securite, de l'accessibilite et de la validation finale.

Les taches suivantes peuvent etre deleguees a un modele economique ou mini si disponible :

- lecture de logs Docker, Maven, npm, Playwright et systemd ;
- extraction de l'erreur racine dans une sortie longue ;
- verification de commandes deterministes ;
- synthese de resultats de tests ;
- controle de statut Git ou de fichiers modifies.

Rebasculer vers le modele principal si l'analyse detecte :

- une erreur qui demande une modification de code ;
- une migration Flyway en echec ;
- un probleme de securite, CSRF, OIDC ou allowlist ;
- une regression d'accessibilite ;
- un echec de publication, audit, upload ou suppression controlee ;
- une incertitude sur le comportement metier.

Pour chaque delegation mecanique, fournir un contexte court : commande, extrait de log pertinent, format attendu et critere de rebasculage. Ne pas envoyer tout le depot ou des logs complets lorsqu'un extrait suffit.

## Risques

- Centraliser trop de logique dans le composant admin existant.
- Exposer des donnees admin via une route publique.
- Ajouter des formulaires non accessibles.
- Ecrire un audit trop verbeux contenant du contenu narratif ou des donnees personnelles inutiles.
- Coupler la preview avec la publication.
- Elargir le lot vers des roles ou un versioning editorial complet.

## Plan

1. [ ] Cartographier l'administration existante et decouper les modules manquants.
2. [ ] Ajouter le journal d'audit backend et l'integrer aux actions critiques deja presentes.
3. [ ] Ajouter la gestion admin des emails autorises avec protection du dernier actif.
4. [ ] Ajouter le tableau de bord admin et les endpoints de synthese.
5. [ ] Completer les formulaires et previews prioritaires sans exposer les brouillons publiquement.
6. [ ] Structurer la navigation admin Angular et les etats accessibles.
7. [ ] Ajouter les tests backend, frontend et e2e/a11y pertinents.
8. [ ] Effectuer les revues coherence, tests, securite et accessibilite.
9. [ ] Executer les validations applicables et relire le diff final.

## Validations prevues

- Tests backend cibles pour audit, administrateurs et dashboard.
- Tests d'integration de securite pour routes admin et CSRF.
- Tests frontend des formulaires et etats d'erreur.
- `npm run lint`.
- `npm test -- --watch=false`.
- `npm run build`.
- `./mvnw -B verify` avec Testcontainers.
- Tests e2e/a11y pertinents si les parcours critiques sont couverts.
- `git diff --check`.

## Criteres d'acceptation

- Le tableau de bord affiche les informations minimales prevues par le plan fonctionnel.
- Les administrateurs autorises sont gerables sans pouvoir supprimer ou desactiver le dernier actif.
- Les actions importantes sont auditees avec un resume non sensible.
- Les previews exigent une session admin et ne modifient pas les statuts.
- Les formulaires admin ont labels visibles, erreurs comprehensibles et focus utilisable.
- Les routes admin restent protegees cote backend.
- Les API publiques ne contiennent ni brouillons, ni emails admin, ni audit.
- Les validations applicables reussissent ou toute limite restante est documentee.
