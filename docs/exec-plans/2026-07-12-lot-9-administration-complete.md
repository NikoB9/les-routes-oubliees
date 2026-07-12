# Lot 9 - Administration complete

## Objectif

Completer l'administration MVP de fondation avec l'easter egg public, la connexion admin, le tableau de bord, les formulaires prioritaires, la gestion des administrateurs et le journal d'audit leger, en conservant une orchestration sobre en tokens.

Ce plan couvre la fondation admin deja livree. Les modules metier encore absents apres la livraison sont explicitement reportes dans le lot suivant.

## Perimetre

- Backend : APIs admin manquantes, audit, gestion des administrateurs, services de tableau de bord, validations serveur et tests.
- Frontend : navigation admin structuree, entree publique vers la connexion, formulaires, etats chargement/erreur/vide, preview identifiee, pages administrateurs et audit.
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

1. [x] Cartographier l'administration existante et decouper les modules manquants.
2. [x] Ajouter le journal d'audit backend et l'integrer aux actions critiques deja presentes.
3. [x] Ajouter la gestion admin des emails autorises avec protection du dernier actif.
4. [x] Ajouter le tableau de bord admin et les endpoints de synthese.
5. [x] Completer les formulaires et previews prioritaires sans exposer les brouillons publiquement.
6. [x] Structurer la navigation admin Angular et les etats accessibles.
7. [x] Ajouter les tests backend, frontend et e2e/a11y pertinents.
8. [x] Effectuer les revues coherence, tests, securite et accessibilite.
9. [x] Executer les validations applicables et relire le diff final.

## Avancement du 2026-07-12

- Cartographie backend/frontend realisee en lecture seule via sous-agents.
- Ajout du module d'audit, de la migration Flyway, du dashboard admin et du CRUD des emails autorises.
- Audit raccorde aux connexions OIDC, aux mutations de quetes et aux uploads/suppressions media.
- Bootstrap admin limite aux bases sans aucun email admin enregistre.
- Interface admin completee avec synthese, navigation interne, gestion des administrateurs autorises et journal d'audit.
- Tests d'integration ajoutes pour les endpoints admin principaux et l'invariant du dernier administrateur actif.
- Validation `test-compile` backend reussie pendant l'integration initiale.

## Cloture du 2026-07-12

- Revue securite, accessibilite et qualite/tests effectuees en lecture seule via sous-agents.
- Revalidation allowlist ajoutee sur chaque requete `/api/admin/**`.
- Extraction de l'email OIDC centralisee pour les audits et `/api/admin/me`.
- Invariant du dernier administrateur actif renforce par verrou transactionnel pessimiste.
- Preview admin des quetes ajoutee dans le shell sans modification de statut editorial.
- Formulaires admin corriges avec resumes d'erreurs focusables et associations ARIA.
- Navigation mobile avec libelles visibles et focus vers le contenu principal apres navigation.
- Procedure de recuperation allowlist documentee dans `docs/DEPLOIEMENT.md`.
- Validations finales reussies : frontend lint/tests/build, backend `clean verify`, `git diff --check`.

## Correctif lot 9 du 2026-07-12

- Easter egg public ajoute dans le header : trois activations du sceau revelent uniquement un lien vers `/admin/login`.
- Le declencheur de l'easter egg reste utilisable au clavier et possede un nom accessible.
- Les routes admin attendues par l'architecture existent maintenant : `/admin/home`, `/admin/group`, `/admin/adventurers`, `/admin/map`, `/admin/notebook`, `/admin/media`, `/admin/administrators`, `/admin/audit` et `/admin/settings`.
- Les liens de navigation du shell admin utilisent le router Angular et ciblent les sections disponibles.
- Les modules metier non encore implementes sont affiches comme planifies, sans masquer leur report vers les lots 10, 11 et 13.
- Tests frontend ajoutes pour l'easter egg et la presence des routes admin.

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
- L'entree publique vers l'administration ne donne aucun droit et ouvre seulement la connexion.
- Les administrateurs autorises sont gerables sans pouvoir supprimer ou desactiver le dernier actif.
- Les actions importantes sont auditees avec un resume non sensible.
- Les previews exigent une session admin et ne modifient pas les statuts.
- Les formulaires admin ont labels visibles, erreurs comprehensibles et focus utilisable.
- Les routes admin restent protegees cote backend.
- Les API publiques ne contiennent ni brouillons, ni emails admin, ni audit.
- Les validations applicables reussissent ou toute limite restante est documentee.

## Limites constatees apres livraison

Ces points ne sont pas couverts par le lot 9 et doivent etre traites dans un lot suivant :

- les contenus de la page d'accueil ne sont pas tous administrables ;
- la carte ne propose pas encore le choix de fond ni le placement des reperes ;
- le carnet de quetes ne dispose pas encore d'un editeur riche adapte ;
- le contenu HTML brut n'est pas interprete et les contenus de demo doivent rester conformes a la regle Markdown du projet.

## Lots suivants proposes

Le lot 9 ouvre plusieurs lots metiers distincts :

- lot 10 : accueil administrable, avec parchemins, Compagnie et aventuriers ;
- lot 11 : carte administrable, avec fond actif et reperes ;
- lot 12 : bloc-notes enrichi, avec editeur Markdown et preview ;
- lot 13 : parametres du site ;
- lot 14 : accessibilite et qualite ;
- lot 15 : preparation production.
