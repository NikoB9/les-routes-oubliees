# Correction du rendu Markdown public

## Objectif

Rendre les champs Markdown publics avec le HTML nettoye produit par le backend pour les parchemins, la Compagnie et la carte, tout en conservant le resume public des quetes en texte brut.

## Perimetre

- Backend : factorisation du rendu Markdown, enrichissement des DTO publics, tests de sanitation et de rendu.
- Frontend public : utilisation du HTML public nettoye sans contournement Angular.
- Administration : barre d'outils Markdown reusable sur les vrais champs Markdown, pas sur le resume public.
- Tests : backend et frontend pertinents, puis lint/build applicables.

## Etapes

1. Identifier les usages actuels du Markdown backend et frontend.
2. Deplacer le renderer Markdown dans un module partage et l'injecter dans les services publics concernes.
3. Ajouter `contentHtml`, `longDescriptionHtml` et `descriptionHtml` aux reponses publiques.
4. Adapter Angular pour afficher ces champs HTML et garder `quest.summary` en texte brut.
5. Factoriser la barre d'outils Markdown admin et corriger le libelle `Résumé public`.
6. Ajouter ou mettre a jour les tests backend et frontend.
7. Executer les validations pertinentes et relire le diff.

## Risques

- Injection HTML non fiable cote Angular : utiliser uniquement le HTML sanitize par Angular, sans `bypassSecurityTrustHtml`.
- Regression de compatibilite API : conserver les champs Markdown source existants dans les reponses publiques.
- Images Markdown : conserver les restrictions existantes sur `/media/{uuid}` et `/assets/...` en formats image autorises.

## Criteres de validation

- Les champs publics Markdown affichent gras, italique, liens et listes.
- Le HTML dangereux n'est pas expose comme balisage executable.
- Les images Markdown restent limitees aux chemins autorises.
- Le resume public des quetes reste affiche comme texte brut.
- Les outils Markdown apparaissent dans les champs admin Markdown concernes, pas sur le resume public.

## Etat d'execution

- Backend : renderer Markdown deplace dans `shared.markdown`, champs HTML publics ajoutes pour parchemin, Compagnie, carte et quetes.
- Securite : les API publiques n'exposent plus les sources Markdown des champs narratifs ; elles restent disponibles cote administration.
- Frontend public : rendu des champs HTML backend via `[innerHTML]`, suppression du parseur Markdown local.
- Administration : barre d'outils Markdown factorisee en composant partage, appliquee aux champs Markdown concernes, avec labels separes des controles et focus piege dans la modale d'image.
- Tests : lint frontend, tests frontend, build frontend et test unitaire backend MarkdownRenderer reussis.
- Limite : les tests d'integration backend Testcontainers n'ont pas pu demarrer dans le conteneur de validation sans acces au socket Docker hote.
