# Documents d'organisation (PDF) par quête — administration

## Objectif

Permettre à l'organisateur de déposer, retrouver et supprimer les documents PDF d'organisation
d'une quête depuis l'onglet d'administration de cette quête : feuille de route, indices à imprimer,
plan de secours, consignes aux comédiens.

Ces documents sont **strictement réservés à l'organisateur**. Ils ne sont jamais listés, jamais
servis et jamais mentionnés côté joueur — ni en ligne, ni dans le snapshot hors ligne.

## Décisions arrêtées avec l'utilisateur

| Décision | Valeur retenue | Motif |
|---|---|---|
| Cardinalité | **plusieurs** documents par quête | l'organisateur sépare feuille de route, indices, plan de secours |
| Consultation | **ouverture dans un nouvel onglet** | visionneuse native du navigateur, pas d'aperçu intégré ni de téléchargement forcé |
| Plafond de taille | **9 Mio** (9 437 184 octets) | tient dans le `client_max_body_size 10m` déjà versionné, **aucune modification Nginx ni sur le serveur de production** |
| Suppression | **confirmation demandée** | la suppression détruit aussi le fichier, sans recours |

## État des lieux établi

### Ce qui existe déjà et sur quoi s'appuyer

* **Upload et stockage** : `backend/.../media/MediaService.java` fait déjà tout ce qu'il faut pour
  des images — validation MIME, signature binaire, plafond de taille, nom serveur dérivé d'un UUID,
  garde anti-traversée (`resolveStoragePath`, l. 389), audit. Ce sont les **raisonnements** à
  reprendre, pas le code : ne pas modifier `MediaService` dans ce lot.
* **Sous-dossier prévu** : `docs/ARCHITECTURE.md` §8.2 décrit déjà une arborescence
  `media/{group,adventurers,quests,misc}/`. Le sous-dossier `quests/` n'a jamais été utilisé — il
  l'est par ce lot.
* **Sécurité** : `shared/security/SecurityConfig.java` l. 62 protège `/api/admin/**` par
  `hasRole("ADMIN")`, doublé par `auth/AdminAllowlistInterceptor`. Rien à ajouter pour couvrir les
  nouvelles routes.
* **Écran d'administration** : la section `notebook` de `frontend/.../admin-shell/` porte déjà les
  cinq onglets de quête et leur formulaire.

### Le piège central : `/media/**` n'est pas admin

`SecurityConfig` l. 63 : `.requestMatchers("/api/**", "/media/**").hasRole("USER")`. **Tout joueur
authentifié par Cloudflare Access peut lire `/media/{id}`.** Réutiliser `media_assets` et la route
`/media/` pour ces PDF les rendrait accessibles à n'importe quel aventurier connaissant un UUID.

D'où la conception : **table dédiée, route dédiée sous `/api/admin/`**, aucun passage par `/media/`.

### Le piège qui casse un test existant : le plafond servlet est global

`media/MediaUploadConfiguration.java` l. 44-47 dérive le `MultipartConfigElement` du **seul**
`routes-oubliees.media-max-upload-bytes` (5 Mio). C'est une limite du conteneur servlet, donc
**globale** : sans changement, un PDF de 9 Mio serait rejeté pendant l'analyse du multipart, avant
que le nouveau service ne soit atteint — exactement l'écart que cette classe a été écrite pour
refermer côté images.

Il faut donc dériver la limite de `max(mediaMaxUploadBytes, questDocumentMaxUploadBytes)`, ce qui
rend rouge le test existant
`media/AdminMediaIntegrationTests.alignsTheServletUploadCeilingWithTheApplicationCeiling`
(l. 94-99), qui fixe `media-max-upload-bytes=1024` et assert `getMaxFileSize() == 1024`.

## Périmètre et garde-fous

* Aucune nouvelle dépendance : `MultipartFile` natif, pas de bibliothèque PDF (AGENTS.md §4.3, §7).
* Rien dans `PublicQuestService`, `PublicNotebookController`, `offline/PublicOfflineService`,
  `ngsw-config.json`.
* `quest_documents` **ne doit pas** entrer dans
  `PublicContentVersionCalculator.PUBLIC_CONTENT_TABLES` : chaque dépôt de PDF invaliderait sinon le
  cache hors ligne de tous les joueurs, pour un contenu qu'ils ne verront jamais.
* `quest_documents` **ne doit pas** entrer dans `MediaService.MEDIA_REFERENCES` (l. 63-76) : ces
  documents ne portent aucune URL `/media/{id}`.
* Revue de sécurité **obligatoire** en fin de lot (AGENTS.md §5.4 : le lot touche les uploads).

---

## Lot 1 — Backend

### 1.1 Migration `backend/src/main/resources/db/migration/V12__create_quest_documents.sql`

```sql
-- Documents d'organisation d'une quete, reserves a l'organisateur.
-- `on delete cascade` supprime les lignes, jamais les fichiers sur disque : les cinq quetes ne
-- sont jamais supprimees, mais aucun endpoint de suppression de quete ne doit etre ajoute sans
-- balayage du repertoire `quests/`.
create table quest_documents (
    id uuid primary key,
    quest_id uuid not null references quests(id) on delete cascade,
    label varchar(160) not null,
    original_filename varchar(255) not null,
    stored_filename varchar(120) not null,
    relative_path varchar(255) not null,
    mime_type varchar(64) not null,
    size_bytes bigint not null,
    uploaded_by varchar(320),
    created_at timestamptz not null,
    constraint uk_quest_documents_relative_path unique (relative_path),
    constraint uk_quest_documents_stored_filename unique (stored_filename),
    constraint ck_quest_documents_mime_type check (mime_type = 'application/pdf'),
    constraint ck_quest_documents_size check (size_bytes > 0)
);

create index idx_quest_documents_quest on quest_documents (quest_id, created_at desc);
```

Les deux contraintes d'unicité ne sont pas décoratives : sans elles, un défaut pourrait faire
pointer deux lignes sur le même fichier, et la suppression de l'une détruirait le document de
l'autre.

`uploaded_by` est **nullable**, comme `media_assets.created_by`, et pour la même raison :
`auth/AdminIdentity.email()` (l. 11-19) rend `null` si l'authentification est absente ou non
authentifiée. Le cas ne peut pas se produire sous `/api/admin/**`, mais un `not null` ferait
dépendre le schéma d'une garantie portée ailleurs, et l'échec serait un 500 opaque.

`MigrationSafetyTests` surveille les migrations à partir de V10 et `quests` figure dans les tables
éditoriales. Cette migration passe (aucun `delete from`, aucun `alter table quests … drop`).
**Ne pas ajouter le marqueur `LRO_ALLOW_EDITORIAL_DATA_REWRITE`** — vérifier plutôt que le test est
vert.

### 1.2 Code Java — dans le package `quest/`, pas un package séparé

Nouveaux fichiers dans
`backend/src/main/java/fr/lesroutesoubliees/routesoubliees/quest/`, toutes classes
**package-private** comme le reste du package :

| Fichier | Rôle |
|---|---|
| `QuestDocument.java` | entité `@Table(name = "quest_documents")` |
| `QuestDocumentRepository.java` | `findAllByQuestIdOrderByCreatedAtDesc`, `findByIdAndQuestId` |
| `AdminQuestDocumentService.java` | validation, stockage, audit, `@Transactional` |
| `AdminQuestDocumentController.java` | contrôleur fin |
| `AdminQuestDocumentResponse.java` | record DTO |

Motif du placement : `Quest` et `QuestRepository` sont package-private. Un package séparé
obligerait soit à les rendre publics — affaiblissement d'encapsulation sans contrepartie — soit à
re-résoudre `code → id` en JDBC, en doublon de `AdminQuestService`. Le contrôleur vit de toute façon
sous le préfixe `/api/admin/quest-tabs/{code}`.

Pièges de mapping — Hibernate est en `ddl-auto: validate`, une divergence entité/colonne fait
échouer le démarrage du contexte, donc **tous** les tests :

* déclarer explicitement chaque `@Column(length = …)` : sans cela Hibernate attend `varchar(255)` ;
* `timestamptz` ↔ `OffsetDateTime` en UTC via `@PrePersist`, calqué sur `media/MediaAsset.java` ;
* **ne pas** mapper `@ManyToOne Quest` : un `@Column(name = "quest_id") UUID questId` évite le
  lazy-loading et garde `Quest` package-private.

### 1.3 Endpoints — `AdminQuestDocumentController`

`@RequestMapping("/api/admin/quest-tabs/{code}/documents")`

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| GET | `` | – | `List<AdminQuestDocumentResponse>` |
| POST | `` | multipart `file` + `label` | `201` + `AdminQuestDocumentResponse` |
| GET | `/{id}/content` | – | flux PDF |
| DELETE | `/{id}` | – | `204` |

* Résolution du code de quête : appeler `QuestRepository.findByCode(code)` directement.
  `AdminQuestService.findQuest` (l. 90-93) fait exactement cela mais est **privé**, il n'est donc
  pas réutilisable — c'est le repository, package-private, qui est partagé. Reprendre son message,
  `"Quete introuvable."`, plutôt que d'en inventer un second.
* Code de quête inconnu → **404**. Document appartenant à une autre quête → **404** :
  `findByIdAndQuestId` est obligatoire, sinon `…/QUEST_1/documents/{idDeQuest2}/content` sert le
  document d'une autre quête et l'URL ment sur son contenu.
* **Piège de validation** : valider `label` **dans le service** par
  `ResponseStatusException(BAD_REQUEST, …)`, exactement comme `MediaService.normalizeAltText`
  (l. 211). Les annotations `@NotBlank @Size` restent en seconde ligne.

  Motif : `@Validated` au niveau de la classe déclenche la validation par proxy AOP, qui lève une
  `ConstraintViolationException`. Ni `ResponseEntityExceptionHandler` ni
  `DefaultHandlerExceptionResolver` ne la traitent, elle tomberait donc dans
  `shared/web/ApiExceptionHandler.handleUnexpectedException` (l. 64-73) et sortirait en **500** avec
  un détail générique, au lieu du 400 attendu. **Ce mécanisme n'est épinglé par aucun test du
  dépôt** : `AdminMediaIntegrationTests` ne couvre pas le cas d'un `altText` vide, alors même que
  `AdminMediaController` porte les mêmes annotations. Ne pas le tenir pour acquis — le test 10 du
  lot 2 (`rejectsABlankLabel`) est précisément là pour trancher. S'il rend 400 sans validation
  explicite dans le service, le raisonnement ci-dessus est faux et la note doit être corrigée ici.
* CSRF : rien à faire. `SpaCsrfTokenRequestHandler` lit le jeton dans l'en-tête `X-XSRF-TOKEN`,
  jamais dans le corps, et `HttpClient` le pose sur un `FormData` de même origine. Le
  `GET /content`, ouvert par un lien, n'en a pas besoin.
* Jackson `fail-on-unknown-properties` est hors sujet : l'upload est multipart, aucun
  désérialiseur n'intervient.

### 1.4 Stockage et validation — `AdminQuestDocumentService`

* Racine : `SiteProperties.mediaStoragePath()`, sous-dossier **`quests/<uuid>.pdf`**.
* Nom serveur dérivé d'un `UUID.randomUUID()` ; nom d'origine conservé comme simple métadonnée,
  avec repli `"document.pdf"` s'il est vide — reprendre `MediaService.normalizeOriginalFilename`
  (l. 397).
* Anti-traversée : même garde que `MediaService.resolveStoragePath` (l. 389), appliquée **aussi à
  la valeur relue en base** au moment de servir, plus `Files.isRegularFile` avant diffusion.
* **Ne pas** appeler `file.getBytes()` : 9 Mio en tas par upload concurrent.
  `fileSizeThreshold = 0` fait déjà déborder le corps sur disque. Lire
  `file.getInputStream().readNBytes(5)` pour la signature, puis `file.transferTo(target)`
  (déplacement du temporaire, coût quasi nul), puis relire la taille par `Files.size(target)`.
  `Files.createDirectories` puis écriture en `CREATE_NEW` : jamais d'écrasement silencieux.
* Validations, statuts alignés sur l'existant :
  * MIME ≠ `application/pdf` → **415** (comme `MediaService.normalizeMimeType`) ;
  * taille au-delà du plafond → **413** ; fichier vide → **400** ;
  * signature `%PDF-` (`25 50 44 46 2D`) exigée **à l'offset 0 exact**, aucune donnée en amont
    tolérée → **400** sinon. Ne pas contrôler `%%EOF` : les PDF linéarisés et les mises à jour
    incrémentales le déplacent ;
  * `label` vide ou au-delà de 160 caractères → **400**.
* **Cohérence fichier / transaction** — `MediaService` porte deux trous connus, ne pas les recopier :
  * suppression : supprimer la ligne en transaction et enregistrer l'effacement disque par
    `TransactionSynchronizationManager.registerSynchronization(… afterCommit)`. Effacer dans la
    transaction ferait perdre le fichier sur un rollback ultérieur, la ligne, elle, ressuscitant ;
  * upload : enregistrer une synchronisation `afterCompletion(STATUS_ROLLED_BACK)` qui efface le
    fichier neuf.
  * Un orphelin résiduel reste inoffensif — jamais listé, jamais servi, la diffusion exigeant la
    ligne. Le dire en Javadoc plutôt que de bâtir un balayage.
* Audit : `audit.record(actor, "QUEST_DOCUMENT_UPLOADED" | "QUEST_DOCUMENT_DELETED",
  "QUEST_DOCUMENT", id, …)`.

### 1.5 Diffusion — `GET /{id}/content`

* `Content-Type: application/pdf` **forcé serveur**, `X-Content-Type-Options: nosniff`.
* `Content-Disposition: inline`, construit par
  `ContentDisposition.inline().filename(nom, StandardCharsets.UTF_8)`. **Sans le charset l'en-tête
  est invalide dès qu'il y a un accent** : Tomcat le passe en ISO-8859-1. Assainir aussi CR, LF et
  guillemets du nom — injection d'en-tête.
* `Cache-Control: no-store` : contenu organisateur, aucun cache. Nginx en pose déjà un identique sur
  `location ~ ^/api/` et `add_header` **ajoute sans remplacer** ; ne jamais poser une valeur
  *différente* côté backend, c'est le piège déjà documenté pour `/media/`.
* Risque résiduel assumé, à documenter : un PDF peut porter du JavaScript. Atténuations : admin
  seulement, type forcé, `nosniff`, visionneuse native du navigateur. **Ne pas** ajouter de
  `Content-Security-Policy: sandbox` sur la réponse, cela casse la visionneuse.

### 1.6 Plafond d'upload

* Ajouter `questDocumentMaxUploadBytes` à `shared/config/SiteProperties.java` et
  `quest-document-max-upload-bytes: ${QUEST_DOCUMENT_MAX_UPLOAD_BYTES:9437184}` dans le bloc
  `routes-oubliees` d'`application.yml` (l. 47-52). `application-test.yml` ne redéfinit que
  `radar.home-assistant.token` : les profils fusionnent, il n'y a rien à y ajouter.
* **`SiteProperties` est un `record` à cinq composants, et il est construit positionnellement dans
  `backend/src/test/java/.../auth/AdminAllowlistBootstrapTests.java` (l. 21 et l. 34).** Ajouter un
  sixième composant **casse la compilation du module de test**, donc **tous** les tests backend, pas
  seulement ceux des médias. Mettre ces deux appels à jour dans le même commit que la propriété.
* Dériver le `MultipartConfigElement` de `max(mediaMaxUploadBytes, questDocumentMaxUploadBytes)`
  dans `media/MediaUploadConfiguration.java`, mettre son Javadoc à jour, et la renommer en
  `UploadCeilingConfiguration` — elle ne concerne plus les seuls médias.
* **Corriger** `media/AdminMediaIntegrationTests.alignsTheServletUploadCeilingWithTheApplicationCeiling`
  (l. 94-99) : ajouter la nouvelle propriété au `@DynamicPropertySource` et réécrire l'assertion en
  `max(…)`. C'est la régression CI la plus probable du lot.
* Effet de bord assumé, à documenter : le plafond servlet passant à 9 Mio, une image de 6 Mio est
  désormais refusée par `MediaService` (413 avec `detail`) au lieu de l'être par le conteneur (413
  sans corps). C'est une amélioration, mais le message vu par l'administrateur change.
* `client_max_body_size 10m` couvre 9 Mio plus les délimiteurs multipart : **aucune modification
  Nginx**.

### 1.7 DTO — `AdminQuestDocumentResponse`

Exposer `id`, `label`, `originalFilename`, `sizeBytes`, `createdAt`, `uploadedBy` et `contentUrl`
(calculé, comme `AdminMediaResponse.url` l. 23). **Jamais** `relativePath` ni `storedFilename` :
chemins système, interdits par `docs/ARCHITECTURE.md` §5.3.

---

## Lot 2 — Tests backend

Nouveau
`backend/src/test/java/fr/lesroutesoubliees/routesoubliees/quest/AdminQuestDocumentIntegrationTests.java`,
calqué sur `media/AdminMediaIntegrationTests.java` : `@Import(TestcontainersConfiguration.class)`,
`@ActiveProfiles("test")`, `@SpringBootTest`, `@DirtiesContext(AFTER_CLASS)`, **sans**
`@Transactional` (les assertions portent sur des fichiers commités), `@DynamicPropertySource` posant
`media-storage-path` sur un répertoire temporaire et `quest-document-max-upload-bytes` sur une
petite valeur.

1. `requiresAuthenticationForDocumentList` → 401.
2. `refusesAPlainUserOnEveryDocumentRoute` → `roles("USER")` → 403 sur les quatre routes.
   **C'est le test qui porte la garantie « jamais atteignable par les joueurs ».**
3. `refusesUploadWithoutCsrfToken` → 403.
4. `uploadsAPdfAndListsIt` → 201, champs attendus, `jsonPath("$.relativePath").doesNotExist()`.
5. `servesTheDocumentInlineAsPdf` → `application/pdf`, `Content-Disposition` commençant par
   `inline`, `nosniff`, `Cache-Control` contenant `no-store`.
6. `rejectsANonPdfDisguisedAsPdf` → corps `PK\x03\x04` annoncé `application/pdf` → 400.
7. `rejectsAnUnsupportedMimeType` → part `image/png` → 415.
8. `rejectsAnEmptyFile` → 400.
9. `rejectsAFileAboveTheDedicatedCeiling` → 413.
10. `rejectsABlankLabel` → 400 avec `detail` — couvre le piège de validation du §1.3.
11. `keepsDocumentsScopedToTheirQuest` → document de `QUEST_1` lu et supprimé via `QUEST_2` → 404.
12. `refusesAnUnknownQuestCode` → 404.
13. `listsDocumentsNewestFirst`.
14. `deletesTheRowAndTheFile` → 204, `GET /content` → 404, répertoire `quests/` vide sur disque.
15. `neverExposesDocumentsThroughTheMediaRoute` → `GET /media/{idDuDocument}` avec `roles("USER")`
    → 404.
16. `keepsTheOfflineContentVersionStableAcrossADocumentUpload` → `/api/public/content-version`
    inchangé avant et après un dépôt.
17. Correction de `AdminMediaIntegrationTests` (§1.6).
18. Correction des deux `new SiteProperties(…)` d'`AdminAllowlistBootstrapTests` (l. 21 et 34) —
    sans elle, rien ne compile.

Le nouveau service n'a pas besoin de `@DirtiesContext` : contrairement à `MediaService`, il ne lit
rien en JDBC brut hors transaction. Ne l'ajouter que si un test le réclame réellement.

Validation : `cd backend && ./mvnw verify` — JDK 25 et démon Docker requis.

---

## Lot 3 — Frontend

### 3.1 Fichiers

| Rôle | Fichier |
|---|---|
| Modèles | `frontend/src/app/features/admin/quest-document-api.models.ts` (nouveau) |
| Service | `frontend/src/app/features/admin/quest-document-api.service.ts` (nouveau) |
| Logique | `frontend/src/app/features/admin/admin-shell/admin-shell.ts` |
| Template | `frontend/src/app/features/admin/admin-shell/admin-shell.html` |
| Styles | `frontend/src/app/features/admin/admin-shell/admin-shell.css` |
| Tests | `admin-shell.spec.ts`, `quest-document-api.service.spec.ts` (nouveau) |

Le service va dans `features/admin/` et **pas** dans `features/notebook/notebook-api.service.ts` :
ce dernier est importé par la page publique `notebook-page`, donc hors du chunk admin paresseux.
Se calquer sur `features/admin/media-api.service.ts` — `FormData`, `encodeURIComponent` sur le code
de quête **et** sur l'identifiant du document.

### 3.2 Ordre impératif à l'intérieur du lot

1. **D'abord** ajouter le stub `QuestDocumentApiService` aux `providers` de `admin-shell.spec.ts`
   (l. 210-216, à la suite de celui de `MediaApiService`). Sans cela, l'injection du nouveau service
   dans `AdminShell` casse **toutes** les specs existantes en `NullInjectorError`.
   Le stub doit couvrir les **trois** méthodes — `listQuestDocuments`, `uploadQuestDocument`,
   `deleteQuestDocument` — et pas seulement les deux premières : le stub de `MediaApiService` omet
   `deleteAdminMedia`, ce qui est sans effet parce qu'aucune spec n'exerce la suppression d'un
   média, alors que les tests 9 et 10 du §3.5 exercent bien celle d'un document.
2. Ensuite seulement, signaux, gestionnaires, template.

### 3.3 Intégration dans `AdminShell`

* Signaux : `questDocuments`, `questDocumentFile`, `questDocumentLabel`, `questDocumentError`,
  `questDocumentStatus`, `documentPendingDeletion`.
* **Séquencement du chargement** : brancher le chargement dans le **seul** `setSelectedQuest()`
  (l. 1220), et **uniquement lorsque le code de quête change**.

  `setSelectedQuest()` est le point de passage unique de six appelants : `selectQuest()` (l. 578),
  `loadQuests()` pour la sélection initiale (l. 1095), et les quatre retours d'action
  `saveQuest`/`publishQuest`/`hideQuest`/`archiveQuest` (l. 812, 843, 860, 877). Deux erreurs
  symétriques sont donc à éviter :
  * ne brancher que `selectQuest()` → la section reste vide au premier affichage et ne se remplit
    qu'au premier clic d'onglet ;
  * brancher `selectQuest()` **et** `setSelectedQuest()` → deux requêtes à chaque clic d'onglet, et
    un rechargement inutile des documents après chaque enregistrement ou publication.

  Comparer le code entrant à celui de la quête déjà sélectionnée règle les deux cas d'un coup.
  Le test 3 du §3.5 épingle le comportement ; ajouter une assertion « aucune requête documents
  après un enregistrement de la même quête ».
* Insertion dans le template : nouvelle `<section class="admin-panel">` juste après la fermeture du
  `</form>` de la quête (`admin-shell.html` ~l. 743), à l'intérieur de `.quest-workspace`.
* Réutiliser les classes existantes `.admin-panel`, `.panel-heading`, `.admin-list`, `.button-row`,
  `.alert`, `.status`, `.danger`, `.modal-backdrop`. Le budget CSS de 50 kB n'est pas un risque :
  `admin-shell.css` pèse environ 14 ko.
* Modale de confirmation : cloner le patron complet du sélecteur d'images
  (`admin-shell.html` l. 745-820 et `handleImageDialogKeydown()` ~l. 645) — `role="dialog"`,
  `aria-modal="true"`, Échap, Tab cyclique, restauration du focus sur le bouton déclencheur.
* Ouverture du document : vraie balise
  `<a [href]="doc.contentUrl" target="_blank" rel="noopener noreferrer">`, **jamais**
  `window.open()` depuis le code — les bloqueurs de fenêtres surgissantes l'interceptent.

### 3.4 Erreurs et accessibilité

* Messages en constantes en tête de fichier, comme les `MEDIA_ERROR_*` (~l. 78-91). Reprendre le
  raisonnement de `mediaUploadErrorMessage()` (~l. 1649-1660) et ses deux règles : **413 → message
  dédié nommant le plafond (« 9 Mio »)**, et `detail` du `problem+json` relayé **uniquement** en
  4xx, jamais en 5xx. Ne pas factoriser avec la médiathèque dans ce lot : les messages diffèrent,
  « texte alternatif » n'existe pas ici.
* Champ fichier : `<label>` englobant, `accept="application/pdf,.pdf"` — un filtre, jamais une
  validation — et **indication visible du format et de la limite** à côté du champ
  (« PDF, 9 Mio maximum »), exigence RGAA sur les formats et limites attendus.
* Erreurs : `<p class="alert" role="alert" tabindex="-1">` référencé par `viewChild` et focalisé par
  `focusSummary()` (~l. 1672), avec `aria-invalid` et `aria-describedby` sur les deux champs.
  Succès en `role="status"`.
* Liste en `<ul aria-label="Documents d'organisation">`, **pas** de `<table>` —
  `docs/ACCESSIBILITE.md` l. 285, contrainte mobile.
* Le texte du lien est le libellé du document, pas « Ouvrir », avec une mention visuellement masquée
  « (nouvelle fenêtre) » dans le nom accessible.
* Chaque bouton de suppression porte `aria-label="Supprimer le document « … »"`.
* Taille affichée lisible (« 2,4 Mio »), pas les octets bruts de la médiathèque.

### 3.5 Tests frontend

Dans `admin-shell.spec.ts` :

1. provider `QuestDocumentApiService` — prérequis du §3.2 ;
2. `renders the organiser documents only inside the notebook section` — présent en `notebook`,
   absent en `media` et `home` ;
3. `loads the documents of the quest that becomes selected` — `QUEST_1` au premier rendu, puis
   `QUEST_2` après `selectQuest` ; couvre le piège de séquencement ;
4. `opens a document in a new tab without leaking the opener` — `a[target="_blank"]`, `rel`
   contenant `noopener`, `href` exact ;
5. `explains a rejected document upload by its size` — 413 → message citant « 9 Mio » ;
6. `shows the reason the server gives for a rejected document` — 400 avec `detail` → relayé ;
7. `never relays a server-side failure detail` — 500 avec `detail` → message générique ;
8. `names the missing fields when the document form is incomplete` ;
9. `asks for confirmation before deleting a document` — aucun appel API tant que la modale n'est pas
   confirmée, aucune requête si elle est annulée ;
10. `removes the document from the list after a confirmed delete` ;
11. `gives each delete button a name that identifies its document`.

Nouveau `quest-document-api.service.spec.ts` avec `provideHttpClientTesting` : URLs et `FormData`.

Dans `frontend/src/app/core/offline/ngsw-config.spec.ts` : ajouter
`keeps admin APIs out of every data group`. L'assertion n'existe pas aujourd'hui ; les `dataGroups`
ne couvrent que `/api/public/**` et `/media/**`, rien n'est donc à retirer de ce côté.

**Correctif du 2026-08-11, après essai en production.** L'affirmation « `ngsw-config.json` reste
inchangé » était fausse, et le lot est parti avec le défaut. Les `dataGroups` n'étaient effectivement
pas en cause — c'est `navigationUrls` qui l'était. Ouvrir un document dans un onglet est une
**navigation** : le service worker la compare à ses motifs, `/api/admin/quest-tabs/{code}/documents/
{id}/content` passe le `/**` positif sans être repris par aucun motif négatif — `!/**/*.*` exige un
point dans le dernier segment, or celui-ci est `content` — et il répond la coquille applicative
depuis son cache. Angular n'a pas de route `/api/…`, l'organisateur voyait donc « Page introuvable »
et la requête n'atteignait jamais le serveur.

Le dépôt, lui, fonctionnait : un `POST` en `FormData` est une requête `fetch`, jamais une navigation.
C'est ce qui rend le défaut invisible au reste de l'application, dont aucun appel d'API ne passe par
une navigation — et invisible aux tests, qui ne montent pas de service worker.

Correctif : ajouter `!/api/**` à `navigationUrls`, plus l'assertion
`never serves the shell for API requests`. Aucun effet sur le mode hors ligne : `navigationUrls` ne
décide que du sort des navigations, la mise en cache de `/api/public/**` restant l'affaire des
`dataGroups`. Même piège que `!/cdn-cgi/**`, déjà documenté dans ce fichier de test.

Validation, via Docker — le Node de la machine est trop ancien pour Angular 22 :

```powershell
.\scripts\frontend-check.ps1 -Task all   # lint + test + build
```

---

## Lot 4 — Documentation

| Fichier | Quoi |
|---|---|
| `AGENTS.md` §12 | Paragraphe « Documents d'organisation » : PDF seul, admin uniquement, jamais public, jamais référencé en Markdown, pas de texte alternatif — ce n'est pas une image — plafond dédié |
| `docs/ARCHITECTURE.md` §5.3 | Les quatre nouveaux endpoints |
| `docs/ARCHITECTURE.md` §8.2 | Sous-dossier `quests/` désormais utilisé. **Réécrire la l. 458** : « Trois plafonds encadrent un téléversement, et un seul réglage les gouverne » devient faux — il y a désormais deux réglages applicatifs, et `MediaUploadConfiguration` dérive le plafond servlet de leur **maximum** |
| `docs/ARCHITECTURE.md` §8.3 | Route admin dédiée, `inline`, type forcé, `nosniff`, `no-store`, aucun passage par `/media/**` |
| `docs/ARCHITECTURE.md` | Un « Addendum 2026-08-11 — Documents d'organisation » plutôt que de disséminer : le fichier utilise déjà ce format |
| `docs/DEPLOIEMENT.md` ~284-294 | Nouvelle variable ; **réécrire** la phrase « `MEDIA_MAX_UPLOAD_BYTES` est le seul réglage à modifier », devenue fausse. Préciser que `client_max_body_size 10m` reste suffisant |
| `docs/DEPLOIEMENT.md` ~409-434 | La sauvegarde médias (`scripts/backup-media.sh`) contient désormais des PDF d'organisation : confidentialité et rétention |
| `docs/DEPLOIEMENT.md` ~874 | Point de contrôle : les routes documents répondent 403 à une identité non admin |
| `.env.example` | `QUEST_DOCUMENT_MAX_UPLOAD_BYTES=9437184` et rappel du lien avec `client_max_body_size` |

Pas d'ADR : aucune décision d'architecture n'est renversée.

---

## Vérification de bout en bout

1. `cd backend && ./mvnw verify` — vert, `MigrationSafetyTests` compris.
2. `.\scripts\frontend-check.ps1 -Task all` — lint, tests Vitest, build.
3. Application lancée en profil `dev`, identité `admin@example.invalid` fabriquée par
   `DevelopmentIdentityFilter` :
   * `/admin/notebook`, onglet `QUEST_1`, déposer un PDF avec un libellé → il apparaît dans la liste
     avec sa taille lisible ;
   * clic sur le libellé → le PDF s'ouvre dans un nouvel onglet et **s'affiche** ;
   * **vérifier avec le service worker actif**, et pas seulement en navigation privée : c'est
     précisément la configuration où le défaut de `navigationUrls` se manifestait. Un service worker
     déjà installé garde son ancien manifeste jusqu'à sa mise à jour ; après déploiement, recharger
     la page d'administration une fois de plus avant de conclure ;
   * **vérifier en Chrome et en Firefox** : la CSP `default-src 'self'` posée par Nginx sur
     `location ~ ^/api/` s'applique aussi à la réponse PDF, et un `object-src`/`frame-src` hérité a
     historiquement cassé la visionneuse intégrée de Chrome. Aucun test automatisé ne le détectera.
     Repli si cassé : ajouter `object-src 'self'` à la CSP, ou exempter l'emplacement des documents ;
   * déposer un fichier de 10 Mio → message citant « 9 Mio » ; déposer un `.png` renommé `.pdf` →
     refus ;
   * supprimer → la modale demande confirmation, l'annulation ne supprime rien, la confirmation
     retire la ligne et le fichier du volume ;
   * changer d'onglet de quête → la liste suit la quête sélectionnée.
4. Étanchéité, à la main : identité **hors allowlist** → 403 sur les quatre routes ;
   `GET /media/{idDuDocument}` → 404 ; aucune réponse de `/api/public/**` ne mentionne un document.
5. `npm run test:a11y` — Playwright et axe.
6. **Revue de sécurité obligatoire** (AGENTS.md §5.4), puis relecture complète du diff.

## Git

Branche dédiée depuis `main`, jamais de commit sur `main`. Messages Conventional Commits :
`feat(quest): déposer des documents d'organisation`, `test(quest): …`, `docs(quest): …`.
Pas de push GitHub sans instruction explicite.
