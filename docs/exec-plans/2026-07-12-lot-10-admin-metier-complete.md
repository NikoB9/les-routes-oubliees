# Lot 10 - Accueil administrable

## Objectif

Completer l'administration de la page d'accueil et de ses contenus associes apres le lot 9.

## Perimetre

- Frontend admin : ecrans de gestion des parchemins, de la Compagnie et des aventuriers, avec navigation fiable et etats accessibles.
- Backend admin : endpoints manquants pour la configuration de l'accueil, validations et tests associes.
- Qualite : tests d'integration, tests frontend et parcours critiques.

## Hors perimetre

- Carte, bloc-notes, parametres du site.
- Versioning complet des contenus.
- Rollback editorial.
- Roles fins et workflow d'approbation.
- Chat, Telegram, notifications et temps reel.

## Risques

- Exposer des contenus de brouillon dans l'API publique.
- Ajouter des ecrans administratifs sans etats vide, erreur ou accessibilite correcte.
- Coupler la publication d'un contenu avec sa simple edition.

## Plan

1. Cartographier les modules d'accueil a administrer et leurs points d'entree actuels.
2. Definir les endpoints backend pour les parchemins, la Compagnie et les aventuriers.
3. Ajouter ou corriger les ecrans admin et les formulaires associes.
4. Ajouter la previsualisation si elle manque sur ces contenus.
5. Stabiliser les donnees de demo et les regles de publication.
6. Ajouter et executer les tests backend, frontend et accessibilite pertinents.
7. Relire le diff final et documenter les limites restantes si besoin.

## Criteres de validation

- L'accueil est administrable de bout en bout.
- La Compagnie est administrable de bout en bout.
- Les aventuriers sont administrables de bout en bout.
- Les contenus de demo restent conformes au rendu public.
- Les tests pertinents passent et le lot est pret a etre publie.
