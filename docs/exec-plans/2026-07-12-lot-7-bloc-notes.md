# Lot 7 - Bloc-notes

## Objectif

Implanter le bloc-notes des quetes avec les cinq entrees fixes, la publication controlee, le rendu Markdown nettoye, la page publique et une administration minimale.

## Perimetre

- Backend: modele `Quest`, rendu Markdown sur liste blanche, API publique enrichie, API admin protegee, validations et tests.
- Frontend: service API carnet, page publique avec etats chargement/erreur/vide, navigation par quetes visibles, rendu Markdown, espace admin notebook minimal.
- Documentation: consigner les limites si le lot ne couvre pas encore la mediatheque ou l'audit complet.

## Hors perimetre

- Upload et rattachement de medias.
- Audit complet des actions.
- Preview avancee et tableau de bord complet, prevus dans les lots suivants.

## Risques

- Fuite de brouillons dans l'API publique.
- Markdown dangereux ou HTML brut rendu dans l'interface.
- Administration trop permissive sur les transitions de statut.
- Navigation du carnet non utilisable au clavier.

## Plan

1. [x] Completer le backend `quest` et ajouter un renderer Markdown strict.
2. [x] Ajouter l'API admin des quetes et les tests de securite/publication.
3. [x] Integrer la page publique Angular et l'administration notebook minimale.
4. [x] Lancer les validations backend/frontend pertinentes.
5. [x] Relire le diff et mettre a jour le plan si une limite reste ouverte.

## Suivi des validations

- Backend package sans tests: reussi.
- Tests unitaires `MarkdownRendererTests`: reussis.
- Tests publics d'integration: reussis.
- Tests admin d'integration: reussis apres correction du rendu des liens Markdown dangereux avec parentheses.
- Frontend `npm ci && npm run lint && npm run build`: reussi.
- Frontend `npm ci && npm test -- --watch=false`: reussi.
- Backend `./mvnw -B verify` avec Testcontainers: reussi.
- Revue finale: `git diff --check` reussi, conteneurs Docker arretes.

## Criteres d'acceptation

- Les cinq quetes existent et sont disponibles en administration.
- L'API publique n'expose que les quetes publiees et visibles.
- Une quete brouillon, masquee ou archivee n'est pas consultable publiquement.
- Le Markdown public est rendu en HTML nettoye sans HTML brut ni protocole dangereux.
- Le carnet public gere chargement, erreur, absence de quetes et navigation vers une quete.
- L'administration permet de modifier le contenu et les statuts principaux sans exposer de brouillon.
- Les tests applicables reussissent.
