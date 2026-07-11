# Lot 4 - Layout public

## Objectif

Structurer l'interface publique Angular autour d'un layout accessible, responsive et maintenable pour accueillir les pages Accueil, Carte et Carnet.

## Perimetre

- Header public.
- Navigation principale desktop.
- Navigation principale mobile.
- Shell applicatif public avec lien d'evitement et region principale.
- Indicateur d'etat de navigation.
- Placeholders publics cohérents pour les futurs lots.
- Tests frontend du layout.

## Hors perimetre

- Consommation complète des APIs du lot 3 par les pages métier.
- Design final des pages Accueil, Carte et Carnet.
- Administration.
- Tests end-to-end Playwright complets.

## Etapes

1. Extraire le layout actuel dans des composants dedies.
2. Ajouter un modele de liens de navigation partage.
3. Ameliorer le responsive, les etats actifs, le focus et les landmarks.
4. Ajouter un indicateur de chargement de route non intrusif.
5. Ajuster les placeholders publics.
6. Ajouter ou mettre a jour les tests Angular.
7. Executer lint, tests et build frontend.

## Risques

- Ne pas casser les routes admin chargees paresseusement.
- Ne pas masquer le contenu avec la navigation mobile.
- Ne pas degrader l'accessibilite clavier ou lecteur d'ecran.

## Validation

- `npm run lint`
- `npm test -- --watch=false`
- `npm run build`
- Relecture du diff et verification manuelle des points d'accessibilite du layout.
