# Plan fonctionnel et technique final

## 1. Présentation

**Les Routes Oubliées** est une application web immersive destinée à accompagner les aventures de la **Compagnie des Routes Oubliées**.

L’application publique permet aux aventuriers de :

* consulter le message important de l’étape actuelle ;
* voir un compte à rebours éventuel ;
* découvrir la présentation de la Compagnie ;
* consulter les cartes des aventuriers ;
* observer la progression de la carte ;
* lire le carnet des quêtes révélées.

Une interface d’administration permet de préparer et publier les contenus sans modifier le code ni redéployer l’application.

## 2. Objectifs

Le projet doit fournir :

* une expérience visuelle inspirée d’un univers médiéval-fantastique ;
* une navigation simple sur ordinateur et mobile ;
* une gestion progressive des révélations ;
* une séparation stricte entre brouillons et contenus publics ;
* une administration sécurisée par Google OpenID Connect ;
* une interface accessible ;
* une architecture simple à maintenir ;
* un déploiement léger dans un conteneur Proxmox LXC.

## 3. Utilisateurs

### 3.1 Visiteur ou aventurier

Peut :

* consulter les pages publiques ;
* voir uniquement les contenus publiés et révélés ;
* naviguer sans compte ;
* consulter le site sur ordinateur, tablette ou téléphone.

Ne peut pas :

* accéder aux brouillons ;
* modifier un contenu ;
* choisir la carte active ;
* révéler une quête ;
* accéder aux fonctions d’administration.

### 3.2 Administrateur autorisé

Peut :

* se connecter avec Google ;
* accéder à l’administration si son email est autorisé ;
* gérer les contenus ;
* publier ou masquer les quêtes ;
* sélectionner le message actif ;
* sélectionner la carte active ;
* administrer les aventuriers ;
* gérer les médias ;
* consulter le journal d’audit ;
* gérer les emails administrateurs autorisés.

## 4. Périmètre du MVP

Le MVP comprend :

* le socle Angular ;
* le socle Spring Boot ;
* PostgreSQL ;
* Flyway ;
* l’authentification Google ;
* l’allowlist d’administrateurs ;
* la page d’accueil ;
* la page carte ;
* le carnet des quêtes ;
* l’administration ;
* la gestion des médias hors cartes ;
* la prévisualisation ;
* le responsive ;
* les exigences d’accessibilité ;
* le journal d’audit léger ;
* la documentation de déploiement et de sauvegarde.

Le MVP n’inclut pas :

* le chat Arkhavel ;
* Telegram ;
* le temps réel ;
* les notifications push ;
* le versioning complet des contenus ;
* le rollback éditorial ;
* une gestion complexe des rôles ;
* une application mobile native.

## 5. Navigation publique

### 5.1 Header

Le header contient :

* le logo de la Compagnie ;
* le nom du site ;
* éventuellement un sous-titre ;
* un lien vers l’accueil sur le logo et le titre.

### 5.2 Navigation desktop

Sur écran large :

* menu latéral ;
* icône et libellé pour chaque entrée ;
* indication claire de la page active.

Entrées :

1. Accueil ;
2. Carte ;
3. Bloc-notes.

### 5.3 Navigation mobile

Sur mobile :

* barre de navigation inférieure ;
* trois entrées maximum ;
* icône et libellé ;
* zone tactile suffisamment grande ;
* aucun recouvrement du contenu.

Entrées :

1. Accueil ;
2. Carte ;
3. Notes.

## 6. Page d’accueil

La page d’accueil est une page verticale composée de trois sections principales.

### 6.1 Parchemin de l’étape actuelle

Le parchemin présente le message actuellement sélectionné.

Champs d’un message :

* identifiant ;
* titre ;
* contenu Markdown ;
* niveau d’importance ;
* statut éditorial ;
* indicateur actif ;
* activation du compte à rebours ;
* date et heure de fin ;
* message à afficher après expiration ;
* dates de création et de modification ;
* auteur de la dernière modification.

Niveaux d’importance proposés :

* information ;
* avertissement ;
* quête imminente ;
* réussite ;
* mystère.

Règles :

* un seul message actif à la fois ;
* seul un message publié peut être actif ;
* un brouillon ne peut jamais être exposé par l’API publique ;
* un message archivé ne peut pas être actif ;
* la date de fin est enregistrée en UTC ;
* le fuseau d’affichage par défaut est `Europe/Paris`;
* la date exacte de fin reste consultable même lorsqu’un compte à rebours est affiché ;
* après expiration, afficher le message prévu ou un état terminé neutre ;
* le compte à rebours ne doit pas provoquer d’annonces vocales chaque seconde.

### 6.2 Présentation de la Compagnie

La section présente :

* le nom de la Compagnie ;
* son icône ou logo ;
* une description courte ;
* une description longue ;
* le texte alternatif de l’image.

Le cadre peut être décoratif, mais le texte doit rester lisible sans l’image de fond.

### 6.3 Aventuriers

Chaque aventurier dispose d’une carte contenant :

* nom ;
* titre, classe ou fonction ;
* avatar ;
* description courte ;
* forces ;
* faiblesses ;
* texte alternatif ;
* visibilité ;
* ordre d’affichage.

Règles :

* seules les cartes visibles apparaissent publiquement ;
* l’ordre est administrable ;
* les forces et faiblesses doivent être lisibles sans dépendre uniquement d’icônes ;
* une carte masquée reste modifiable dans l’administration.

## 7. Page Carte

### 7.1 Objectif

La page Carte révèle progressivement la destination recherchée.

### 7.2 Ressources

Les images de carte sont versionnées dans le dépôt public, dans un répertoire dédié tel que :

```text
frontend/public/assets/maps/
```

Les cartes peuvent donc être consultées dans l’historique du dépôt. Ce risque de divulgation est accepté.

La base de données conserve :

* le nom de la vision ;
* sa description ;
* son chemin d’asset ;
* son texte alternatif ;
* son ordre ;
* son statut ;
* son état actif.

### 7.3 Étapes initiales

Prévoir au minimum :

1. carte entièrement dissimulée ;
2. carte révélant la première quête ;
3. carte après la deuxième quête ;
4. carte après la troisième quête ;
5. carte après la quatrième quête ;
6. carte finale révélant le Val d’Aurelune.

Les titres affichés peuvent être modifiés depuis l’administration.

### 7.4 Règles

* une seule carte active publiquement ;
* seule une carte publiée peut être active ;
* une carte brouillon reste visible uniquement en prévisualisation admin ;
* l’image doit s’adapter aux petits écrans ;
* un zoom ne doit pas être indispensable pour accéder à l’information principale ;
* une description textuelle doit expliquer les informations essentielles portées par la carte.

## 8. Bloc-notes des quêtes

### 8.1 Structure

Cinq entrées fixes existent dans l’administration :

1. Quête 1 ;
2. Quête 2 ;
3. Quête 3 ;
4. Quête 4 ;
5. Val d’Aurelune.

Chaque entrée possède un code technique stable :

```text
QUEST_1
QUEST_2
QUEST_3
QUEST_4
VAL_D_AURELUNE
```

Le titre public peut être personnalisé sans modifier le code technique.

### 8.2 Contenu d’une quête

Chaque quête comprend :

* titre ;
* résumé ;
* événements importants ;
* indices découverts ;
* épreuves réalisées ;
* contenu complémentaire ;
* médias éventuels ;
* statut éditorial ;
* visibilité publique ;
* ordre ;
* dates de création et de modification.

Les champs narratifs sont écrits en Markdown.

### 8.3 États

Statut éditorial :

* `DRAFT`;
* `PUBLISHED`;
* `ARCHIVED`.

Visibilité :

* `visibleToPlayers = true`;
* `visibleToPlayers = false`.

Une quête est visible publiquement uniquement si :

```text
publicationStatus = PUBLISHED
ET
visibleToPlayers = true
```

### 8.4 Règles

* les cinq quêtes sont toujours visibles dans l’administration ;
* les quêtes masquées n’apparaissent pas dans la navigation publique ;
* une quête en brouillon ne doit jamais être rendue publique ;
* la case « Afficher aux aventuriers » ne suffit pas si le contenu est encore en brouillon ;
* une quête archivée ne doit plus être affichée ;
* si aucune quête n’est visible, afficher un état d’attente narratif ;
* l’administration doit clairement distinguer brouillon, publié, visible et archivé.

Message vide initial suggéré :

> Les pages du carnet demeurent encore scellées. Elles se dévoileront lorsque la Compagnie aura franchi ses premières épreuves.

## 9. Édition Markdown

### 9.1 Fonctionnalités

L’éditeur permet :

* paragraphes ;
* titres ;
* gras ;
* italique ;
* listes ;
* citations ;
* liens ;
* images issues de la médiathèque ;
* prévisualisation.

### 9.2 Sécurité

Le système doit :

* stocker le Markdown source ;
* refuser le HTML brut ;
* produire un HTML nettoyé ;
* refuser les scripts ;
* refuser les gestionnaires d’événements inline ;
* refuser les protocoles d’URL dangereux ;
* empêcher toute exécution de code ;
* tester des charges XSS connues.

## 10. Administration

### 10.1 Accès par easter egg

L’easter egg :

* est présent dans l’interface publique ;
* déclenche l’ouverture de la connexion admin ;
* peut rediriger vers `/admin/login`;
* ne constitue pas une protection ;
* ne doit jamais accorder de session ou de privilège directement.

L’accès direct à `/admin/login` peut exister. L’absence de lien visible n’est pas une mesure de sécurité.

Le geste exact de l’easter egg sera choisi lors du lot UI. Cette décision n’est pas bloquante.

### 10.2 Authentification Google

Flux attendu :

1. l’utilisateur ouvre la connexion ;
2. il choisit « Se connecter avec Google » ;
3. Google authentifie l’utilisateur ;
4. le backend reçoit et valide l’identité OpenID Connect ;
5. le backend vérifie que l’email est confirmé ;
6. le backend normalise l’adresse ;
7. le backend vérifie l’allowlist ;
8. une session admin est créée si l’accès est autorisé ;
9. sinon, l’accès est refusé.

Message de refus :

> Accès réservé aux éclaireurs autorisés.

Ne pas révéler :

* la liste des emails autorisés ;
* la raison technique détaillée ;
* les identifiants internes ;
* les claims reçus.

### 10.3 Allowlist des administrateurs

Table prévue :

```text
admin_allowed_emails
- id
- email
- label
- active
- created_at
- updated_at
```

Variable d’amorçage :

```text
ADMIN_BOOTSTRAP_EMAILS
```

Règle d’amorçage :

* si la table ne contient encore aucun administrateur, importer les emails de la variable ;
* une fois la table initialisée, elle devient la source de vérité ;
* ne pas réinsérer automatiquement à chaque démarrage un email supprimé ;
* empêcher la désactivation ou la suppression du dernier administrateur actif ;
* normaliser les emails en minuscules ;
* ne jamais exposer la liste dans l’API publique.

### 10.4 Tableau de bord

Afficher au minimum :

* le message parchemin actif ;
* la carte active ;
* les quêtes visibles ;
* le nombre d’aventuriers visibles ;
* les dernières actions d’audit ;
* un accès à la prévisualisation.

### 10.5 Modules

L’administration comprend :

* Accueil et parchemins ;
* Compagnie ;
* Aventuriers ;
* Carte ;
* Bloc-notes ;
* Médias ;
* Administrateurs ;
* Journal d’audit ;
* Paramètres.

## 11. Gestion des médias

### 11.1 Périmètre

Sont administrables :

* logo de la Compagnie ;
* avatars ;
* illustrations des quêtes ;
* autres images narratives.

Les cartes géographiques sont gérées comme assets versionnés dans le dépôt.

### 11.2 Stockage

* fichier dans un volume persistant ;
* métadonnées en base ;
* pas de fichier binaire volumineux dans PostgreSQL.

Métadonnées :

```text
media_assets
- id
- original_filename
- stored_filename
- relative_path
- mime_type
- size_bytes
- width
- height
- alt_text
- created_at
- created_by
```

### 11.3 Contraintes

Formats MVP :

* PNG ;
* JPEG ;
* WebP.

Règles :

* taille maximale configurable ;
* nom serveur généré ;
* validation côté backend ;
* pas de SVG dans le MVP ;
* pas de chemin fourni directement par le client ;
* suppression interdite lorsqu’un média est utilisé, sauf remplacement explicite ;
* texte alternatif obligatoire pour un média informatif.

## 12. Prévisualisation

Un administrateur doit pouvoir prévisualiser :

* un message non actif ;
* une carte non active ;
* une quête masquée ou en brouillon ;
* une carte d’aventurier masquée.

La prévisualisation :

* exige une session admin ;
* ne rend pas le contenu accessible par l’API publique ;
* doit être clairement identifiée comme prévisualisation ;
* ne doit pas modifier automatiquement le statut de publication.

## 13. Journal d’audit léger

Le MVP ne comporte pas de versioning complet.

Table :

```text
audit_logs
- id
- actor_email
- action
- entity_type
- entity_id
- summary
- created_at
```

Actions minimales :

* connexion admin réussie ;
* connexion admin refusée sans enregistrer inutilement de données sensibles ;
* création et modification d’un message ;
* activation d’un message ;
* modification de la Compagnie ;
* création et modification d’un aventurier ;
* activation d’une carte ;
* publication, masquage ou archivage d’une quête ;
* ajout ou suppression d’un administrateur ;
* upload ou suppression d’un média.

Ne pas enregistrer :

* les tokens Google ;
* les cookies ;
* les secrets ;
* l’intégralité de chaque contenu avant/après ;
* des données personnelles inutiles.

Durée de conservation configurable ultérieurement.

## 14. Paramètres du site

Prévoir une configuration pour :

* nom du site ;
* sous-titre ;
* logo ;
* fuseau horaire ;
* message de maintenance ;
* état du site ;
* informations d’accessibilité.

Valeurs initiales :

```text
siteName = Les Routes Oubliées
timezone = Europe/Paris
```

## 15. API publique indicative

```text
GET /api/public/settings
GET /api/public/home
GET /api/public/map
GET /api/public/notebook
GET /api/public/media/{id}
```

Les réponses publiques ne doivent jamais contenir :

* brouillons ;
* emails administrateurs ;
* informations d’audit ;
* chemins internes du serveur ;
* métadonnées de sécurité ;
* tokens ;
* données masquées.

## 16. API admin indicative

### Session

```text
GET  /api/admin/me
POST /api/admin/logout
```

### Parchemins

```text
GET    /api/admin/home/messages
POST   /api/admin/home/messages
GET    /api/admin/home/messages/{id}
PUT    /api/admin/home/messages/{id}
DELETE /api/admin/home/messages/{id}
POST   /api/admin/home/messages/{id}/activate
```

### Compagnie

```text
GET /api/admin/group
PUT /api/admin/group
```

### Aventuriers

```text
GET    /api/admin/adventurers
POST   /api/admin/adventurers
GET    /api/admin/adventurers/{id}
PUT    /api/admin/adventurers/{id}
DELETE /api/admin/adventurers/{id}
PUT    /api/admin/adventurers/reorder
```

### Carte

```text
GET    /api/admin/map-views
POST   /api/admin/map-views
GET    /api/admin/map-views/{id}
PUT    /api/admin/map-views/{id}
DELETE /api/admin/map-views/{id}
POST   /api/admin/map-views/{id}/activate
```

### Quêtes

```text
GET  /api/admin/quest-tabs
GET  /api/admin/quest-tabs/{id}
PUT  /api/admin/quest-tabs/{id}
POST /api/admin/quest-tabs/{id}/publish
POST /api/admin/quest-tabs/{id}/hide
POST /api/admin/quest-tabs/{id}/archive
```

### Médias

```text
GET    /api/admin/media
POST   /api/admin/media
GET    /api/admin/media/{id}
PUT    /api/admin/media/{id}
DELETE /api/admin/media/{id}
```

### Administrateurs

```text
GET    /api/admin/allowed-emails
POST   /api/admin/allowed-emails
PUT    /api/admin/allowed-emails/{id}
DELETE /api/admin/allowed-emails/{id}
```

### Audit

```text
GET /api/admin/audit-logs
```

Les chemins exacts pourront être affinés sans modifier les règles métier.

## 17. Modèle de données principal

Tables prévues :

```text
site_settings
group_profile
home_messages
adventurers
map_views
quest_tabs
media_assets
admin_allowed_emails
audit_logs
```

Principes :

* clés primaires UUID ;
* contraintes d’unicité explicites ;
* index sur les champs de recherche et de statut pertinents ;
* dates en UTC ;
* migrations Flyway versionnées ;
* aucune dépendance à l’ordre implicite des lignes ;
* contraintes garantissant autant que possible les règles critiques.

## 18. Exigences non fonctionnelles

### 18.1 Sécurité

* authentification Google OIDC ;
* allowlist backend ;
* session serveur ;
* cookies sécurisés ;
* CSRF actif ;
* CORS restrictif ;
* validation des entrées ;
* sanitation Markdown ;
* contrôle des uploads ;
* secrets hors Git ;
* journalisation prudente ;
* endpoints d’administration protégés.

### 18.2 Accessibilité

Respecter `docs/ACCESSIBILITE.md`.

La cible est :

* RGAA 4.1.2 ;
* WCAG 2.2 niveau AA comme référentiel complémentaire ;
* navigation clavier ;
* focus visible ;
* contraste suffisant ;
* contenu compréhensible sans décoration ;
* alternatives textuelles.

### 18.3 Responsive

Cibles :

* mobile ;
* tablette ;
* desktop.

Seuils indicatifs :

```text
mobile : moins de 768 px
tablette : 768 à 1023 px
desktop : 1024 px et plus
```

Ces valeurs peuvent être ajustées selon le contenu réel.

### 18.4 Performance

Objectifs :

* éviter les images non optimisées ;
* charger paresseusement l’administration ;
* ne pas charger les quêtes masquées dans l’API publique ;
* limiter les dépendances ;
* éviter les requêtes répétitives ;
* paginer les listes admin lorsque cela devient nécessaire ;
* conserver une expérience correcte sur connexion mobile.

### 18.5 Compatibilité

Prendre en charge les versions maintenues des principaux navigateurs modernes.

Ne pas ajouter de compatibilité avec des navigateurs obsolètes au détriment du code courant.

## 19. Données publiques et dépôt public

Le dépôt GitHub est public.

Ne doivent pas être commis :

* les contenus réels exportés de production ;
* les emails administrateurs réels ;
* les secrets ;
* la base de données ;
* les uploads privés ;
* les journaux de production.

Les cartes sont volontairement publiques dans le dépôt.

Les données de démonstration doivent être fictives.

## 20. Découpage en lots

### Lot 1 — Socle

* arborescence ;
* Angular ;
* Spring Boot ;
* Maven Wrapper ;
* PostgreSQL ;
* Flyway ;
* lint ;
* tests initiaux ;
* scripts de développement ;
* documentation de lancement.

### Lot 2 — Authentification

* Google OIDC ;
* session ;
* allowlist ;
* amorçage ;
* protection backend ;
* route admin ;
* refus d’accès ;
* tests de sécurité.

### Lot 3 — Modèle de données et API publique

* tables ;
* migrations ;
* services ;
* données de démonstration ;
* endpoints publics ;
* règles de filtrage.

### Lot 4 — Layout public

* header ;
* navigation desktop ;
* navigation mobile ;
* routing ;
* responsive ;
* états de chargement et d’erreur.

### Lot 5 — Accueil

* parchemin ;
* timer ;
* présentation ;
* aventuriers ;
* tests ;
* accessibilité.

### Lot 6 — Carte

* assets ;
* modèle ;
* sélection active ;
* page publique ;
* description accessible ;
* administration.

### Lot 7 — Bloc-notes

* cinq quêtes ;
* Markdown ;
* visibilité ;
* publication ;
* page publique ;
* administration ;
* sanitation.

### Lot 8 — Médias

* stockage ;
* upload ;
* validation ;
* médiathèque ;
* rattachement aux contenus ;
* suppression contrôlée.

### Lot 9 — Administration complète

* tableau de bord ;
* formulaires ;
* prévisualisation ;
* gestion des administrateurs ;
* journal d’audit.

### Lot 10 — Accessibilité et qualité

Ce lot est un audit final et une consolidation. Les vérifications d’accessibilité et les tests pertinents doivent déjà être intégrés dans chaque lot qui modifie l’interface.

* audit ;
* corrections ;
* tests clavier ;
* tests automatisés ;
* tests end-to-end ;
* revue de sécurité ;
* documentation.

### Lot 11 — Préparation production

* build ;
* configuration ;
* service systemd ;
* proxy ;
* Cloudflare Tunnel ;
* sauvegardes ;
* restauration ;
* supervision ;
* procédure de mise à jour.

## 21. Critères d’acceptation du MVP

Le MVP est accepté lorsque :

* les trois pages publiques sont disponibles ;
* le menu est adapté au desktop et au mobile ;
* l’accueil affiche le message actif ;
* le compte à rebours fonctionne ;
* la Compagnie est configurable ;
* les aventuriers sont configurables ;
* une seule carte publiée peut être active ;
* les cinq quêtes sont toujours présentes dans l’administration ;
* seules les quêtes publiées et révélées sont publiques ;
* le Markdown est nettoyé ;
* les médias sont validés ;
* la connexion Google fonctionne ;
* les emails non autorisés sont refusés ;
* le dernier administrateur actif ne peut pas être supprimé ;
* toutes les routes admin sont protégées côté backend ;
* l’interface est navigable au clavier ;
* les principaux parcours sont testés ;
* PostgreSQL conserve les données après redémarrage ;
* les sauvegardes et la restauration sont documentées ;
* aucun secret n’est présent dans Git ;
* le code compile et les tests réussissent.

## 22. Décisions différées non bloquantes

Les éléments suivants seront décidés pendant les lots concernés :

* geste exact de l’easter egg ;
* direction artistique définitive ;
* polices décoratives ;
* domaine public définitif ;
* illustrations finales ;
* taille maximale exacte des uploads ;
* éventuelle galerie avancée.

Ces décisions ne doivent pas bloquer la création du socle.

## 23. Phase 2 éventuelle

Éléments possibles :

* chat Arkhavel ;
* bot Telegram ;
* notifications ;
* galerie plus riche ;
* sons et ambiance ;
* historique éditorial complet ;
* rollback ;
* import/export de contenu ;
* rôles administratifs plus fins.

Aucun de ces éléments ne doit être anticipé dans le MVP au prix d’une complexité supplémentaire.
