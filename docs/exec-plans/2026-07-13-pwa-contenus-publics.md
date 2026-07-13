# PWA et contenus publics hors ligne

## Objectif

Rendre l'application publique installable comme PWA et permettre la consultation hors ligne des contenus publics deja publies.

## Etapes

- Ajouter la configuration PWA Angular, le manifeste et le service worker de production.
- Ajouter une invite d'installation accessible, avec fermeture memorisee.
- Exposer une version publique de contenu et un snapshot public filtre cote backend.
- Stocker le snapshot public dans IndexedDB cote frontend et l'utiliser comme fallback hors ligne.
- Documenter les regles PWA dans les fichiers de reference du projet.
- Tester le backend, le frontend, le lint et les builds.

## Risques

- Ne jamais inclure de contenu admin, brouillon ou masque dans le snapshot.
- Ne pas mettre en cache les routes admin ni les operations d'ecriture.
- Les GET `/api/public/**` strictement publics peuvent etre caches par le service worker avec une strategie freshness pour garantir les pages en mode avion.
- Ne pas mettre en cache automatiquement `/media/**` tant que l'acces public aux medias n'est pas filtre par contenu publie.
- Garder le backend comme source canonique du contenu public et du HTML nettoye.
- Sur iOS, l'installation PWA ne peut pas etre declenchee par une popup native.

## Validation

- Tests backend des nouveaux endpoints publics.
- Tests frontend de l'invite d'installation et du fallback cache.
- `npm run lint`, `npm test -- --watch=false`, `npm run build`.
- Build backend et tests backend pertinents.
