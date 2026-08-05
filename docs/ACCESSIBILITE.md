# Accessibilité

## 1. Objectif

L’application vise une conformité sérieuse au RGAA 4.1.2, avec WCAG 2.2 niveau AA comme référentiel complémentaire.

L’accessibilité concerne :

* le site public ;
* l’administration ;
* les formulaires ;
* les cartes ;
* le compte à rebours ;
* les contenus Markdown ;
* les états de chargement et d’erreur.

Une validation automatique seule ne permet pas de déclarer le site conforme.

## 2. Principes

* privilégier le HTML natif ;
* utiliser ARIA uniquement lorsqu’un élément natif ne suffit pas ;
* conserver une navigation complète au clavier ;
* rendre le focus visible ;
* ne jamais transmettre une information uniquement par la couleur ;
* préserver la lisibilité malgré le thème médiéval ;
* fournir une alternative aux contenus graphiques ;
* réduire les animations lorsque l’utilisateur le demande ;
* tester avec plusieurs tailles d’écran.

## 3. Structure des pages

Chaque page doit contenir :

* un titre principal unique ;
* une hiérarchie de titres logique ;
* des régions structurantes ;
* un contenu principal identifiable ;
* une navigation cohérente ;
* un lien d’évitement vers le contenu principal.

Exemple :

```html
<header></header>
<nav aria-label="Navigation principale"></nav>
<main id="main-content"></main>
<footer></footer>
```

Ne pas utiliser un titre uniquement pour obtenir un style visuel.

## 4. Navigation

### Desktop

Le menu latéral doit :

* être atteignable au clavier ;
* afficher un libellé, pas seulement une icône ;
* identifier la page active ;
* avoir un ordre de tabulation logique.

### Mobile

Le menu inférieur doit :

* avoir des cibles tactiles confortables ;
* ne pas masquer le contenu ;
* conserver les libellés ;
* indiquer la page active autrement que par la couleur seule.

### Logo

Le logo ramenant à l’accueil doit avoir un nom accessible clair.

## 5. Focus

Tout élément interactif doit présenter un focus visible.

Ne pas supprimer `outline` sans fournir un remplacement au moins équivalent.

Après :

* ouverture d’une modale ;
* fermeture d’une modale ;
* changement d’étape ;
* erreur de formulaire ;
* navigation dynamique ;

le focus doit être déplacé de manière prévisible.

Lorsqu’une modale est fermée, le focus revient à l’élément déclencheur.

## 6. Easter egg et administration

L’easter egg ne doit pas rendre l’administration impossible à utiliser au clavier.

La route `/admin` reste accessible directement aux administrateurs authentifiés par Cloudflare Access.

Si le déclencheur de l’easter egg est interactif :

* utiliser un bouton ou un lien ;
* fournir un focus ;
* ne pas imposer uniquement un geste tactile complexe.

L’easter egg n’est pas une mesure de sécurité.

## 7. Parchemin

Le fond parchemin est décoratif.

Exigences :

* contraste suffisant entre texte et fond ;
* contenu disponible même si l’image ne charge pas ;
* largeur de ligne raisonnable ;
* taille de texte adaptable ;
* aucune police décorative pour de longs paragraphes ;
* possibilité de zoom jusqu’à 200 % sans perte de contenu ;
* aucun texte important intégré directement dans une image.

## 8. Compte à rebours

Le compte à rebours doit afficher :

* le temps restant visuel ;
* la date et l’heure exactes de fin ;
* un libellé compréhensible.

Ne pas utiliser une région `aria-live` mise à jour chaque seconde.

Approche recommandée :

* mise à jour visuelle normale ;
* information accessible stable ;
* annonce seulement lors d’un changement important ;
* état final annoncé poliment ;
* aucune redirection automatique à l’expiration.

Le compte à rebours doit fonctionner même si les animations sont réduites.

## 9. Cartes d’aventuriers

Chaque carte doit avoir :

* un titre ;
* une structure cohérente ;
* des libellés explicites pour forces et faiblesses ;
* un avatar avec alternative adaptée ;
* un ordre de lecture logique.

Si l’avatar est décoratif :

```html
alt=""
```

S’il identifie le personnage, fournir un texte alternatif pertinent sans répéter inutilement le texte adjacent.

## 10. Carte de l’aventure

La carte doit fournir :

* une alternative courte ;
* une description textuelle des informations importantes ;
* une présentation utilisable sans perception visuelle de l’image ;
* un affichage responsive ;
* aucun déplacement obligatoire par glisser-déposer.

Si un zoom est proposé :

* fournir des boutons ;
* rendre les boutons utilisables au clavier ;
* conserver une taille de cible correcte ;
* ne pas bloquer le zoom natif du navigateur.

## 11. Onglets du bloc-notes

Les quêtes visibles peuvent être présentées comme de vrais onglets uniquement si leur comportement respecte le modèle attendu.

Structure :

* conteneur `tablist`;
* boutons ayant le rôle `tab`;
* panneaux ayant le rôle `tabpanel`;
* association via identifiants ;
* indication de l’onglet sélectionné.

Clavier :

* flèches gauche et droite pour parcourir ;
* `Home` pour le premier ;
* `End` pour le dernier ;
* `Entrée` ou `Espace` selon le mode d’activation choisi ;
* tabulation vers le contenu.

Une navigation par liens classiques reste acceptable et peut être plus simple.

## 12. Formulaires admin

Chaque champ doit avoir :

* un label visible ;
* une aide associée lorsque nécessaire ;
* un état requis explicite ;
* une erreur compréhensible ;
* une association technique entre champ et erreur.

Ne pas utiliser uniquement un placeholder comme label.

À la soumission invalide :

* afficher un résumé des erreurs ;
* déplacer ou proposer le focus vers ce résumé ;
* conserver les valeurs déjà saisies ;
* identifier chaque champ en erreur.

## 13. Boutons et icônes

Une icône seule doit avoir un nom accessible.

Exemples :

* « Modifier l’aventurier Armand » ;
* « Masquer la quête 2 » ;
* « Activer cette carte ».

Ne pas utiliser :

* « Cliquer ici » ;
* « Voir » sans contexte ;
* un pictogramme sans libellé accessible.

## 14. Couleurs et contrastes

Vérifier :

* texte normal ;
* texte large ;
* composants interactifs ;
* focus ;
* erreurs ;
* éléments sélectionnés ;
* texte sur parchemin ;
* texte sur images.

Les états ne doivent pas dépendre uniquement de :

* vert ;
* rouge ;
* opacité ;
* variation de teinte.

Ajouter du texte, une icône nommée ou une forme.

## 15. Animations

Respecter :

```css
@media (prefers-reduced-motion: reduce)
```

Réduire ou supprimer :

* transitions longues ;
* parallaxe ;
* scintillements ;
* défilements automatiques ;
* animations du parchemin ;
* effets de carte.

Aucun contenu ne doit clignoter à une fréquence dangereuse.

## 16. Markdown rendu

Le rendu doit :

* conserver une hiérarchie logique ;
* éviter plusieurs titres principaux ;
* fournir des textes de liens explicites ;
* préserver les listes ;
* associer les images à des textes alternatifs ;
* ne pas créer de tableau inutilisable sur mobile ;
* ne pas ouvrir une nouvelle fenêtre sans indication.

## 17. Messages dynamiques

Les messages de succès et d’erreur doivent être annoncés de façon appropriée.

Utiliser avec mesure :

* `role="status"` pour une confirmation ;
* `role="alert"` pour une erreur urgente.

Ne pas annoncer chaque mise à jour mineure.

## 18. Responsive et zoom

Tester :

* 320 CSS pixels de largeur ;
* zoom navigateur à 200 % ;
* agrandissement du texte ;
* orientation portrait ;
* orientation paysage ;
* clavier logiciel mobile.

Aucun défilement horizontal ne doit être requis pour lire un texte standard.

Les exceptions graphiques doivent rester utilisables.

## 19. Tests automatiques

Prévoir :

* analyse statique ;
* axe-core dans les tests end-to-end ;
* contrôles de contraste ;
* tests des noms accessibles ;
* tests des composants d’onglets et de modales.

Une absence d’erreur automatisée ne signifie pas une conformité complète.

Commandes cibles à créer avec le socle frontend :

```bash
npm run test:a11y
npm run e2e
```

Les violations automatisées critiques ou sérieuses doivent faire échouer la validation, sauf exception documentée avec justification et ticket de correction.

Scénarios minimaux :

* ordre de tabulation du layout public ;
* navigation mobile ;
* accès clavier à `/admin` et à l’easter egg ;
* formulaire admin invalide avec résumé d’erreurs et focus ;
* modale admin, ouverture et fermeture ;
* carnet sous forme d’onglets ou navigation alternative ;
* compte à rebours avant et après expiration ;
* page carte avec description longue accessible.

## 20. Tests manuels

Pour chaque lot visuel significatif :

1. naviguer sans souris ;
2. vérifier l’ordre du focus ;
3. vérifier le focus visible ;
4. vérifier les titres ;
5. vérifier les labels ;
6. tester à 200 % ;
7. tester sur mobile ;
8. vérifier les contrastes ;
9. vérifier les messages d’erreur ;
10. tester au moins un lecteur d’écran avant la livraison finale.

Le lot final d’accessibilité est un audit de consolidation. Il ne remplace pas les vérifications à effectuer dans chaque lot qui modifie l’interface.

## 20.1 Matrice d’audit minimale

| Écran ou composant | Points obligatoires |
| --- | --- |
| Layout public | lien d’évitement, landmarks, page active, focus visible |
| Navigation mobile | cibles tactiles, libellés, absence de recouvrement |
| Parchemin | contraste, zoom 200 %, contenu indépendant du décor |
| Compte à rebours | date exacte, annonce finale unique, pas d’annonce chaque seconde |
| Carte | `alt` court, description longue accessible, responsive |
| Carnet | titres cohérents, navigation clavier, liens explicites |
| Markdown rendu | images avec alternatives, liens explicites, tableaux utilisables |
| Formulaires admin | labels visibles, erreurs associées, résumé, focus |
| Médias | texte alternatif obligatoire pour les images informatives |
| Erreurs API/UI | messages compréhensibles, annoncés sans bruit excessif |

## 21. Définition de terminé

Une fonctionnalité visuelle n’est pas terminée tant que :

* elle fonctionne au clavier ;
* le focus est visible ;
* son nom accessible est correct ;
* ses états sont compréhensibles ;
* son contraste est suffisant ;
* elle fonctionne sur mobile ;
* les erreurs sont accessibles ;
* les tests applicables ont été exécutés ;
* les limites connues sont documentées.

## 22. Page d’accessibilité

Prévoir avant la mise en production une page d'information indiquant :

* le niveau de conformité évalué ;
* les éventuelles non-conformités ;
* les contenus exemptés le cas échéant ;
* un moyen de contact ;
* la date de l’audit.

Ne pas annoncer une conformité totale sans audit correspondant.
## Addendum 2026-08-05 - Radar

La carte Leaflet du Radar doit être accompagnée d'une alternative textuelle listant les mêmes positions importantes.

Exigences spécifiques :

* la sélection d'identité utilise une vraie modale accessible ;
* le focus reste dans la modale tant que l'utilisateur n'a pas choisi un aventurier ou le mode invité ;
* le refus de géolocalisation affiche une page d'erreur structurée sans créer la carte ;
* les commandes de carte `Recentrer` et `Voir toute la Compagnie` sont utilisables au clavier ;
* les positions anciennes sont signalées autrement que par la couleur ;
* les mises à jour temps réel ne doivent pas provoquer d'annonce vocale continue ;
* les coordonnées, précisions et heures doivent être disponibles hors interaction visuelle avec la carte.
