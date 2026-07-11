# Lot 5 - Accueil

## Objectif

Construire la page d'accueil publique a partir de l'API `/api/public/home` :

- parchemin du message actif ;
- compte a rebours facultatif ;
- presentation de la Compagnie ;
- cartes des aventuriers visibles ;
- etats chargement, erreur et contenu absent ;
- verification accessibilite de base.

## Perimetre

### Inclus

- Service Angular de lecture de l'accueil public.
- Modeles TypeScript explicites.
- Rendu sur et accessible du Markdown source sous forme de blocs texte simples.
- Timer visuel sans region `aria-live` mise a jour chaque seconde.
- Tests unitaires frontend du service/composant et du timer.

### Exclu

- Administration des contenus.
- Rendu Markdown HTML complet et sanitation backend dediee.
- Upload/gestion des medias.
- Donnees narratives definitives.

## Risques

- Le backend retourne encore du Markdown source : ne pas utiliser `innerHTML`.
- Le compte a rebours ne doit pas provoquer d'annonces vocales chaque seconde.
- Les avatars peuvent etre absents : fournir un fallback non ambigu.
- Les assets statiques sont caches par Cloudflare : utiliser des chemins deja versionnes si necessaire.

## Etapes

- [x] Inspecter l'API et le placeholder frontend.
- [x] Ajouter modeles et service API frontend.
- [x] Remplacer le placeholder de la page accueil.
- [x] Ajouter le rendu texte Markdown minimal.
- [x] Ajouter les tests frontend.
- [x] Executer lint, tests et build frontend.
- [x] Relire le diff et documenter les limites.

## Criteres d'acceptation

- La page d'accueil consomme `/api/public/home`.
- L'utilisateur voit un etat utile pendant le chargement, en erreur et si aucun contenu n'est publie.
- Le message actif affiche son importance, son contenu, sa date d'echeance si presente et son etat expire.
- Le timer affiche la date exacte et un compte a rebours lisible sans annonce chaque seconde.
- La presentation et les aventuriers visibles sont affiches dans un ordre coherent.
- Les tests frontend pertinents passent.
