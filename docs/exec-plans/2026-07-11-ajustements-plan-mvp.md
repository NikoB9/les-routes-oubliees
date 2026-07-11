# Ajustements MVP actés avant les lots concernés

Ce document complète `docs/PLAN_FINAL.md` pour les lots non encore développés. Il ne remet pas en cause les lots déjà validés, sauf les ajustements immédiats du layout public.

## Navigation publique

- Prévoir des icônes pour les entrées de navigation.
- Sur desktop, conserver icône, libellé et indication claire de page active.
- Sur mobile, une présentation par icônes seules est acceptable si chaque lien garde un nom accessible, une indication de page active non fondée uniquement sur la couleur, et une zone tactile confortable.

## Quêtes administrables

Chaque quête doit avoir deux espaces éditoriaux distincts :

- contenu publiable, soumis au statut éditorial et à la visibilité publique ;
- brouillon interne administrateur, jamais exposé publiquement.

Le brouillon interne sert aux détails que les joueurs ne connaissent pas encore : notes de préparation, indices non révélés, résolution, variantes narratives et rappels admin.

Règles :

- le brouillon interne n'est jamais retourné par les endpoints publics ;
- il n'influence pas la publication du contenu joueur ;
- il reste éditable indépendamment du contenu publiable ;
- il doit être clairement séparé dans l'interface admin.

Impact technique anticipé :

- une colonne `admin_draft_markdown` est ajoutée à la table `quests` ;
- cette colonne reste exclue des DTO et endpoints publics.

## Carte interactive

La cible privilégiée pour la page Carte est une carte interactive hors ligne avec assets locaux et drapeaux personnalisés révélés progressivement.

Chaque drapeau contient au minimum :

- titre ;
- position sur la carte ;
- association à une quête ;
- état actif ou masqué.

Comportement public :

- seuls les drapeaux actifs sont affichés ;
- activer un drapeau au clic ou au clavier ouvre la quête associée dans le carnet ;
- la carte conserve une alternative textuelle accessible ;
- aucun glisser-déposer ne doit être indispensable.

Administration :

- l'administrateur saisit le titre ;
- il positionne le drapeau ;
- il associe le drapeau à une quête ;
- il active ou masque le drapeau.

Impact technique anticipé :

- une table `map_markers` stocke les drapeaux et leur association à une quête ;
- les coordonnées sont normalisées en pourcentage de la carte afin de rester indépendantes de la taille d'affichage.

Fallback MVP :

- si la carte interactive hors ligne devient trop coûteuse, revenir à une image de carte progressive versionnée reste acceptable.
