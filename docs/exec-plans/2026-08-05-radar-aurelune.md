# Radar d'Aurelune

## Objectif

Ajouter un module `Radar` protege par Cloudflare Access permettant aux aventuriers authentifies de partager leur position en temps reel, de voir la position des autres participants et, lorsque l'administration l'autorise, la position de la balise du tresor.

Le titre public de la page sera `Le Radar d'Aurelune`.

Le lot remplace l'authentification administrateur Google geree par Spring par une authentification en amont via Cloudflare Access. Le backend reste responsable de la validation du JWT Access, de l'attribution des roles et de toutes les autorisations API.

## Perimetre

Inclus :

1. Documentation fonctionnelle, architecture, accessibilite, deploiement et README.
2. Authentification backend par `Cf-Access-Jwt-Assertion`.
3. Roles `ROLE_USER`, `ROLE_ADMIN` et `ROLE_HOME_ASSISTANT`.
4. Attribution unique d'un aventurier a une identite Cloudflare.
5. Mode invite authentifie lorsque tous les aventuriers visibles sont deja attribues.
6. Page publique protegee `/radar` avec carte Leaflet, geolocalisation obligatoire et SSE.
7. Reception de la position du tresor depuis Home Assistant via Bearer applicatif.
8. Reglage admin pour afficher ou masquer le tresor.
9. Adaptations Nginx et consignes Cloudflare Zero Trust.
10. Tests backend, frontend, E2E et accessibilite pertinents.

Hors perimetre :

* anonymat complet sur Radar ;
* historique persistant des positions des utilisateurs ;
* chat, notifications, Telegram, push ou mode hors ligne Radar ;
* roles complexes ;
* application mobile native ;
* integration Apple dediee tant qu'elle n'est pas validee dans Cloudflare Zero Trust.

## Decisions structurantes

* `Radar` est un module connecte. Un invite Radar est authentifie par Cloudflare Access mais n'a pas d'aventurier attribue.
* Le choix de personnage n'est pas stocke dans `localStorage`. Il est persiste cote serveur et rattache au sujet Cloudflare.
* Un utilisateur ordinaire ne peut pas modifier lui-meme son attribution apres confirmation. Seul un administrateur peut corriger une attribution.
* L'unicite d'attribution est garantie par PostgreSQL avec une contrainte unique sur `adventurer_id`.
* Les positions des utilisateurs ne sont conservees qu'en memoire, avec expiration courte.
* La position du tresor est persistee, mais elle n'est jamais exposee quand `treasure_visible=false`.
* SSE avec `SseEmitter` est retenu plutot que WebSocket pour garder une architecture simple.
* Leaflet `1.9.4` est la version cible, car c'est la version stable officielle actuelle.
* Radar est exclu du cache PWA, d'IndexedDB et du snapshot hors ligne.

## Questions a trancher avant implementation

1. Quelle sera la liste exacte des emails autorises dans Cloudflare Access pour l'application principale ?
2. Faut-il proteger toute l'administration par la meme application Access que Radar, ou creer deux applications Access separees avec deux politiques differentes ?
3. Quel est le `team name` Cloudflare Access et l'`AUD tag` de l'application a utiliser en production ?
4. Quel fournisseur de tuiles est retenu pour Leaflet : OpenStreetMap standard, tuiles auto-hebergees, ou autre fournisseur ?
5. Quel asset utiliser pour le marqueur tresor : creer `frontend/public/assets/radar/treasure-marker.webp` dans le lot, ou fournir une image existante ?
6. Quel libelle afficher pour les invites sur la carte : `Invite`, `Ombre de la Compagnie`, ou autre libelle narratif ?

Ces questions ne bloquent pas le plan technique, mais elles doivent etre resolues avant la mise en production.

## Etape 0 - Preparation

1. Creer une branche de travail :

   ```bash
   git switch -c feat/radar-aurelune
   ```

2. Relire les sources de verite :

   * `docs/PLAN_FINAL.md`
   * `docs/ARCHITECTURE.md`
   * `docs/ACCESSIBILITE.md`
   * `docs/DEPLOIEMENT.md`
   * `README.md`

3. Verifier l'etat du depot :

   ```bash
   git status --short --branch
   ```

4. Identifier les changements existants et ne jamais les reinitialiser.

## Etape 1 - Documentation de cadrage

Modifier :

* `docs/PLAN_FINAL.md`
* `docs/ARCHITECTURE.md`
* `docs/ACCESSIBILITE.md`
* `docs/DEPLOIEMENT.md`
* `README.md`
* `.env.example`

Points a documenter :

1. Le MVP inclut desormais un module temps reel limite au Radar.
2. La navigation publique contient une quatrieme entree `Radar`.
3. La navigation mobile accepte quatre entrees, avec verification explicite a 320 px.
4. L'administration et Radar passent par Cloudflare Access.
5. L'Cloudflare Access est remplace par la validation backend du JWT Cloudflare Access.
6. Les pages de contenu historiques restent accessibles apres authentification Cloudflare Access globale.
7. Radar exige HTTPS, Cloudflare Access, geolocalisation et connexion reseau.
8. Radar est exclu du cache hors ligne public.
9. Les operations manuelles Cloudflare et Nginx sont decrites sans pretendre qu'elles ont ete appliquees en production.

Mettre a jour `.env.example` avec des valeurs factices :

```text
CF_ACCESS_TEAM_DOMAIN=https://example.cloudflareaccess.com
CF_ACCESS_AUDIENCE=example-audience-tag
CF_ACCESS_CERTS_URL=https://example.cloudflareaccess.com/cdn-cgi/access/certs
```

Supprimer ou rendre obsoletes les variables Google seulement lorsque le code ne les utilise plus.

## Etape 2 - Authentification Cloudflare Access

Backend :

1. Conserver `spring-boot-starter-oauth2-resource-server` pour valider le JWT Cloudflare Access humain.
2. Supprimer les anciens flux Spring OAuth2 internes et la page Angular `/admin/login`.
3. Ajouter une configuration `CloudflareAccessProperties` :

   * `teamDomain`
   * `audience`
   * `certsUrl`
   * cache TTL des cles publiques

4. Ajouter un filtre Spring Security qui :

   * lit uniquement `Cf-Access-Jwt-Assertion` ;
   * refuse les emails transmis par en-tete non signe ;
   * valide signature RS256, `iss`, `aud`, `exp`, `nbf` ;
   * extrait `sub` et `email` apres validation ;
   * normalise l'email ;
   * cree une authentication avec `ROLE_USER` ;
   * ajoute `ROLE_ADMIN` si l'email est actif dans `admin_allowed_emails`.

5. Conserver CSRF pour les ecritures navigateur.
6. Configurer les autorisations :

   * routes publiques existantes : accessibles sans JWT ;
   * `/radar` et `/api/radar/**` : utilisateur Access authentifie ;
   * `/api/portal/**` : utilisateur Access authentifie ;
   * `/admin/**` et `/api/admin/**` : `ROLE_ADMIN`, sauf page Angular de refus si necessaire ;
   * `/api/integrations/home-assistant/**` : `ROLE_HOME_ASSISTANT` ;
   * `/actuator/health` : selon regle locale existante.

7. Ajouter une URL de deconnexion frontend vers :

   ```text
   /cdn-cgi/access/logout
   ```

Tests backend minimum :

* JWT absent sur `/api/radar/snapshot` => 401 ou 403 coherent ;
* JWT mal signe => refuse ;
* mauvaise audience => refuse ;
* expiration => refuse ;
* email falsifie dans un autre en-tete sans JWT => ignore/refuse ;
* admin reconnu par allowlist active ;
* utilisateur ordinaire refuse sur `/api/admin/**`.

## Etape 3 - Identites portail et attribution des aventuriers

Migration cible :

```text
backend/src/main/resources/db/migration/V11__create_portal_identities_and_radar.sql
```

Table `portal_identities` :

```sql
create table portal_identities (
    id uuid primary key,
    cloudflare_subject varchar(255) not null,
    normalized_email varchar(320) not null,
    adventurer_id uuid null references adventurers(id),
    access_mode varchar(32) not null,
    selected_at timestamptz null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_portal_identities_subject unique (cloudflare_subject),
    constraint uq_portal_identities_email unique (normalized_email),
    constraint ck_portal_identities_access_mode check (access_mode in ('ADVENTURER', 'GUEST')),
    constraint ck_portal_identities_assignment check (
        (access_mode = 'ADVENTURER' and adventurer_id is not null and selected_at is not null)
        or
        (access_mode = 'GUEST' and adventurer_id is null and selected_at is not null)
    )
);

create unique index uq_portal_identities_adventurer
    on portal_identities(adventurer_id)
    where adventurer_id is not null;
```

Adapter les noms de tables/colonnes a l'existant exact avant d'ecrire la migration.

Backend module suggere :

```text
backend/src/main/java/fr/lesroutesoubliees/routesoubliees/portal/
```

Endpoints :

| Methode | Endpoint | Autorisation | Role |
| --- | --- | --- | --- |
| GET | `/api/portal/me` | Access | Lire l'identite et les choix disponibles |
| POST | `/api/portal/me/adventurer` | Access + CSRF | Attribuer definitivement un aventurier |
| POST | `/api/portal/me/guest` | Access + CSRF | Passer invite si aucun aventurier visible n'est disponible |
| GET | `/api/admin/portal-identities` | Admin | Lister les identites avec emails |
| PUT | `/api/admin/portal-identities/{id}/assignment` | Admin + CSRF | Corriger/liberer/reaffecter |

Regles :

1. `GET /api/portal/me` cree l'identite si elle n'existe pas encore.
2. La reponse publique ne renvoie jamais l'email des autres utilisateurs.
3. La liste des choix contient uniquement les aventuriers visibles et non attribues.
4. Un utilisateur deja attribue ne peut pas changer son choix via endpoint public.
5. Une selection concurrente du meme aventurier renvoie `409 Conflict`.
6. `POST /api/portal/me/guest` est accepte uniquement si aucun aventurier visible non attribue n'existe.
7. L'admin peut liberer un aventurier, attribuer un autre aventurier, ou transformer une identite en invite.
8. Toute correction admin est auditee.

Tests :

* creation automatique d'identite ;
* unicite par sujet Cloudflare ;
* unicite par email normalise ;
* unicite d'aventurier ;
* conflit concurrent ;
* modification utilisateur refusee apres selection ;
* mode invite refuse tant qu'un aventurier est disponible ;
* correction admin autorisee et auditee.

## Etape 4 - Etat Radar et Home Assistant

Completer la migration `V11__create_portal_identities_and_radar.sql` avec `radar_state` :

```sql
create table radar_state (
    id smallint primary key,
    treasure_visible boolean not null,
    treasure_latitude numeric(9, 6) null,
    treasure_longitude numeric(9, 6) null,
    treasure_accuracy_m numeric(8, 2) null,
    treasure_observed_at timestamptz null,
    treasure_received_at timestamptz null,
    treasure_visibility_updated_by uuid null,
    treasure_visibility_updated_at timestamptz null,
    constraint ck_radar_state_singleton check (id = 1),
    constraint ck_radar_state_latitude check (treasure_latitude is null or treasure_latitude between -90 and 90),
    constraint ck_radar_state_longitude check (treasure_longitude is null or treasure_longitude between -180 and 180),
    constraint ck_radar_state_accuracy check (treasure_accuracy_m is null or treasure_accuracy_m > 0)
);

insert into radar_state(id, treasure_visible)
values (1, false);
```

Adapter les precisions SQL si les conventions du projet utilisent un autre type.

Endpoint Home Assistant :

| Methode | Endpoint | Autorisation |
| --- | --- | --- |
| POST | `/api/integrations/home-assistant/radar/treasure-position` | `ROLE_HOME_ASSISTANT` |

Payload :

```json
{
  "schemaVersion": 1,
  "beacon": "tresor-aurelune",
  "latitude": 46.495854,
  "longitude": -1.775551,
  "accuracyM": 6.414,
  "observedAt": "2026-08-04T21:51:57Z"
}
```

Reponse nominale : `204 No Content`.

Validation :

* `schemaVersion=1` obligatoire ;
* `beacon=tresor-aurelune` obligatoire ;
* latitude entre `-90` et `90` ;
* longitude entre `-180` et `180` ;
* precision positive et bornee ;
* `observedAt` valide, pas anormalement futur ;
* ignorer ou rejeter de facon idempotente un releve plus ancien que le dernier releve stocke.

Ne pas stocker :

* altitude ;
* Plus Code ;
* compte Google ;
* identifiant Google de la balise ;
* historique de deplacements.

## Etape 5 - Bearer applicatif pour Home Assistant

Configurer manuellement dans Cloudflare Zero Trust une application plus specifique pour le chemin exact :

```text
api/integrations/home-assistant/radar/treasure-position
```

Politique :

* action `Bypass` / `Contourner` ;
* include `Everyone` / `Tout le monde` ;
* aucun joker ;
* aucun Service Token Cloudflare ;
* aucun second tunnel ou second sous-domaine.

Home Assistant envoie :

```text
Authorization: Bearer <RADAR_HOME_ASSISTANT_TOKEN>
```

Le backend doit valider le Bearer applicatif :

* endpoint exact uniquement ;
* methode `POST` uniquement ;
* `401 Unauthorized` si absent, vide ou incorrect ;
* schema `Bearer` accepte sans sensibilite a la casse ;
* autres schemas refuses ;
* comparaison adaptee aux secrets ;
* `Cache-Control: no-store` ;
* validation stricte du JSON, des coordonnees, de la precision et de `observedAt`.

Les chemins voisins de `/api/integrations/**` ne doivent pas beneficier de cette exception.

## Etape 6 - API Radar temps reel

Module backend suggere :

```text
backend/src/main/java/fr/lesroutesoubliees/routesoubliees/radar/
```

Endpoints :

| Methode | Endpoint | Autorisation | Cache |
| --- | --- | --- | --- |
| GET | `/api/radar/snapshot` | Access attribue ou invite | `no-store` |
| GET | `/api/radar/events` | Access attribue ou invite | SSE `no-store` |
| PUT | `/api/radar/me/location` | Access attribue ou invite + CSRF | `no-store` |
| GET | `/api/admin/radar/settings` | Admin | `no-store` |
| PUT | `/api/admin/radar/settings` | Admin + CSRF | `no-store` |

Snapshot Radar :

```json
{
  "serverTime": "2026-08-05T08:00:00Z",
  "currentIdentity": {
    "mode": "ADVENTURER",
    "adventurerId": "uuid",
    "displayName": "Aurelune",
    "avatarPath": "/media/..."
  },
  "treasure": {
    "latitude": 46.495854,
    "longitude": -1.775551,
    "accuracyM": 6.41,
    "observedAt": "2026-08-04T21:51:57Z",
    "stale": false
  },
  "participants": [
    {
      "identityId": "uuid",
      "mode": "ADVENTURER",
      "adventurerId": "uuid",
      "displayName": "Aurelune",
      "avatarPath": "/media/...",
      "latitude": 46.49,
      "longitude": -1.77,
      "accuracyM": 12.0,
      "observedAt": "2026-08-05T08:00:00Z",
      "receivedAt": "2026-08-05T08:00:01Z",
      "stale": false
    }
  ]
}
```

Quand `treasure_visible=false`, retourner :

```json
{
  "treasure": null
}
```

et ne jamais diffuser de coordonnees du tresor dans SSE.

Registry memoire :

* une entree par identite portail ;
* dernier releve gagnant ;
* etat `stale` apres environ 15 secondes ;
* suppression apres environ 45 secondes ;
* purge periodique ;
* aucune persistance utilisateur.

SSE :

* `SseEmitter` avec timeout explicite ;
* evenement initial `snapshot` ;
* evenement `snapshot` apres position acceptee ou modification admin ;
* heartbeat toutes les 20 secondes ;
* nettoyage `onCompletion`, `onTimeout`, `onError` ;
* reconnexion automatique cote frontend ;
* fallback polling si SSE echoue durablement.

Tests :

* `Cache-Control: no-store` ;
* snapshot initial ;
* mise a jour SSE ;
* heartbeat ;
* nettoyage des emitters ;
* expiration memoire ;
* tresor masque absent des reponses ;
* toggle admin audite avec action `RADAR_TREASURE_VISIBILITY_UPDATED`.

## Etape 7 - Frontend portail

Ajouter :

```text
frontend/src/app/core/portal/
frontend/src/app/shared/components/portal-identity-dialog/
```

Comportement :

1. Sur l'interface publique protegee, appeler `GET /api/portal/me`.
2. Si l'identite est attribuee, continuer.
3. Si aucune attribution n'existe, ouvrir une modale obligatoire.
4. La modale liste les aventuriers visibles et non attribues.
5. La selection demande une confirmation explicite.
6. En cas de `409 Conflict`, recharger la liste et annoncer que le personnage vient d'etre choisi.
7. Si aucun aventurier n'est disponible, afficher le bouton `Acceder comme invite` avec un visuel de fantome decoratif.
8. Ne jamais afficher l'email dans l'interface publique.

Accessibilite modale :

* role dialog ou composant natif equivalent ;
* focus place dans la modale a l'ouverture ;
* focus contenu tant que le choix est obligatoire ;
* titres et libelles explicites ;
* erreurs associees ;
* navigation clavier complete ;
* pas de fermeture qui permettrait d'utiliser Radar sans choix ou mode invite.

Admin :

* supprimer `/admin/login` ou le convertir en redirection/compatibilite si necessaire ;
* le bouton d'acces admin pointe vers `/admin` ;
* un non-admin authentifie voit une page narrative de refus ;
* les appels `/api/admin/**` restent proteges cote backend.

Message suggere :

```text
Le portail a reconnu votre sceau, mais celui-ci ne porte pas les marques des eclaireurs autorises. L'acces a l'administration vous est refuse.
```

Conserver les accents dans les textes visibles lors de l'implementation.

## Etape 8 - Frontend Radar

Ajouter la route paresseuse :

```text
/radar
```

Ajouter l'entree `Radar` :

* navigation desktop ;
* navigation mobile ;
* tests de largeur a 320 px ;
* cibles tactiles conformes.

Installer :

```bash
cd frontend
npm install leaflet@1.9.4
npm install --save-dev @types/leaflet
```

Verifier licence et poids dans la documentation du lot.

Composants/services suggeres :

```text
frontend/src/app/features/radar/radar-page/
frontend/src/app/features/radar/radar-api.service.ts
frontend/src/app/features/radar/radar.models.ts
frontend/src/app/features/radar/radar-presence.service.ts
frontend/src/app/features/radar/radar-geolocation.service.ts
```

Flux :

1. Verifier l'identite portail.
2. Afficher un etat d'introduction avec bouton `Autoriser ma localisation`.
3. Appeler `navigator.geolocation.watchPosition()`.
4. Ne creer la carte qu'apres le premier releve valide.
5. Envoyer la position toutes les 5 a 10 secondes lorsque la page est visible.
6. Suspendre l'envoi lorsque `document.visibilityState !== 'visible'`.
7. Appeler `clearWatch()` a la destruction du composant.
8. Ouvrir `EventSource('/api/radar/events')`.
9. Appliquer les snapshots SSE sans recentrage automatique.
10. Basculer en polling si SSE echoue durablement.

Erreurs a afficher sans carte :

* permission refusee ;
* geolocalisation indisponible ;
* navigateur incompatible ;
* delai depasse ;
* contexte non securise ;
* connexion absente.

Carte :

* Leaflet charge uniquement avec la route Radar ;
* controles de zoom natifs ;
* bouton `Recentrer` ;
* bouton `Voir toute la Compagnie` ;
* cercle d'exactitude pour chaque position ;
* tresor avec `treasure-marker.webp` ;
* aventuriers avec leur avatar ;
* fallback initiales si portrait indisponible ;
* invite avec marqueur fantome ;
* utilisateur courant visuellement distinct ;
* popups construits en DOM avec `textContent`, sans HTML injecte ;
* donnees au clic : nom, latitude, longitude, precision, heure du releve, anciennete ;
* indicateur clair de position perimee.

Alternative accessible :

* liste textuelle sous la carte ;
* chaque entree permet de focaliser/recentrer le marqueur ;
* les coordonnees et heures sont lisibles sans interaction carte ;
* les changements importants ne sont pas annonces en continu par lecteur d'ecran.

PWA :

* ne pas ajouter Radar au snapshot hors ligne ;
* ne pas stocker les positions en IndexedDB ;
* ne pas configurer de `dataGroups` Angular service worker pour `/api/radar/**`;
* hors connexion, afficher `Connexion requise`.

## Etape 9 - Administration Radar

Ajouter un panneau admin minimal :

* lecture de `GET /api/admin/radar/settings` ;
* toggle `Afficher le tresor sur le Radar` ;
* sauvegarde via `PUT /api/admin/radar/settings` ;
* affichage de la derniere reception Home Assistant : heure, precision, etat stale ;
* pas d'affichage public quand le tresor est masque.

Regles :

* seul `ROLE_ADMIN` peut modifier ;
* audit `RADAR_TREASURE_VISIBILITY_UPDATED` ;
* SSE notifie immediatement les cartes ouvertes ;
* le backend retire les coordonnees publiques lorsque masque.

## Etape 10 - Nginx et Cloudflare

Modifier :

```text
infra/nginx/les-routes-oubliees.conf.example
```

Changements attendus :

1. Autoriser la geolocalisation :

   ```nginx
   add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
   ```

2. Transmettre le JWT Cloudflare Access :

   ```nginx
   proxy_set_header Cf-Access-Jwt-Assertion $http_cf_access_jwt_assertion;
   ```

3. Adapter la CSP pour les tuiles retenues. Pour OpenStreetMap standard, prevoir au minimum le domaine de tuiles dans `img-src`.
4. Ajouter un bloc specifique SSE :

   ```nginx
   location = /api/radar/events {
       proxy_pass http://127.0.0.1:8080;
       proxy_http_version 1.1;
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 1h;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
       proxy_set_header X-Forwarded-Host $host;
       proxy_set_header X-Forwarded-Port 443;
       proxy_set_header Cf-Access-Jwt-Assertion $http_cf_access_jwt_assertion;
   }
   ```

5. Retirer les routes OAuth2/login du proxy lorsque le backend ne les expose plus.
6. Ajouter des en-tetes `no-store` pour les routes d'identite, Radar et admin si necessaire.

Consignes Cloudflare Zero Trust a documenter dans `docs/DEPLOIEMENT.md` :

* application Access humaine pour tout l'hote, avec le champ `Path` vide ;
* fournisseurs recommandes : Google et One-time PIN par email ;
* autorisation administrateur conservee dans l'allowlist applicative, pas uniquement dans Cloudflare ;
* application Access d'exception Home Assistant plus specifique pour le chemin exact `api/integrations/home-assistant/radar/treasure-position`, en `Bypass` avec `Everyone` ;
* aucun Service Token Cloudflare, second tunnel, second sous-domaine, joker d'exception ou audience separee ;
* Bearer applicatif dedie a Home Assistant ;
* variables `CF_ACCESS_ISSUER`, `CF_ACCESS_AUDIENCE` et `CF_ACCESS_CERTS_URL` pour l'unique application humaine.

A la fin du lot, fournir les actions manuelles :

```bash
sudo nginx -t
sudo systemctl reload nginx
```

et preciser le fichier de production a modifier, probablement :

```text
/etc/nginx/sites-available/les-routes-oubliees
```

ou le chemin reel si different sur le serveur.

## Etape 11 - Tests et validations

Backend :

```bash
cd backend
./mvnw verify
```

Frontend :

```bash
cd frontend
npm ci
npm run lint
npm test -- --watch=false
npm run build
npm run e2e
npm run test:a11y
```

Si l'installation de Leaflet modifie `package-lock.json`, utiliser ensuite `npm ci` pour valider le verrou.

Tests backend obligatoires :

* JWT absent, expire, mal signe, mauvaise audience ;
* en-tete email falsifie sans JWT valide ;
* role admin par allowlist ;
* utilisateur ordinaire refuse sur `/api/admin/**` ;
* Bearer Home Assistant valide/invalide ;
* validation coordonnees tresor ;
* releves plus anciens ignores ou rejetes ;
* attribution unique d'un aventurier ;
* conflit de selection concurrente ;
* mode invite seulement quand liste vide ;
* modification utilisateur refusee apres attribution ;
* correction admin autorisee ;
* tresor masque absent de snapshot et SSE ;
* `Cache-Control: no-store` sur identite, Radar et admin ;
* SSE initial, update et heartbeat ;
* expiration memoire des participants.

Tests frontend obligatoires :

* modale obligatoire apres authentification sans attribution ;
* pas de modale sur les routes d'administration ;
* exclusion des routes admin du choix personnage ;
* `409 Conflict` recharge la liste ;
* bouton invite affiche uniquement quand liste vide ;
* refus geolocalisation => page d'erreur sans carte ;
* succes geolocalisation => creation carte ;
* `clearWatch()` appele a la destruction ;
* SSE met a jour les marqueurs ;
* tresor retire en temps reel ;
* positions perimees signalees ;
* popups et liste alternative ;
* navigation mobile a quatre entrees a 320 px ;
* aucun email visible hors admin.

Tests E2E/a11y :

* connexion simulee par JWT de test ou profil de test ;
* parcours selection aventurier ;
* parcours invite ;
* parcours Radar avec geolocalisation mockee ;
* refus admin narratif pour non-admin ;
* acces admin direct pour admin ;
* navigation clavier dans la modale ;
* focus visible et structure de titres ;
* alternative textuelle de la carte.

## Etape 12 - Revue finale

Avant commit :

1. Relire le diff complet.
2. Verifier qu'aucun secret reel n'a ete ajoute.
3. Verifier que les emails reels ne sont pas versionnes hors configuration locale.
4. Verifier que les coordonnees utilisateur ne sont jamais persistees.
5. Verifier que `treasure_visible=false` masque les coordonnees cote backend.
6. Verifier que Radar n'est pas cache par la PWA.
7. Verifier que les docs de deploiement listent les actions manuelles Cloudflare/Nginx.
8. Lancer les validations pertinentes et consigner tout echec.

Commit suggere si tout est coherent :

```text
feat(radar): add Cloudflare-protected magical radar
```

## Criteres d'acceptation

* `Radar` apparait dans la navigation desktop et mobile.
* `/radar` est accessible uniquement apres authentification Cloudflare Access.
* Un utilisateur authentifie doit choisir un aventurier disponible ou passer invite uniquement si aucun aventurier n'est disponible.
* Un aventurier choisi disparait des choix des autres utilisateurs.
* Un utilisateur ordinaire ne peut pas changer seul son attribution.
* Un administrateur peut corriger les attributions.
* La carte n'apparait pas si la geolocalisation est refusee ou indisponible.
* Les positions utilisateurs s'affichent en temps reel et expirent sans persistance.
* Le tresor s'affiche uniquement quand l'administration l'autorise.
* Les coordonnees exactes, precisions et heures sont consultables au clic et dans une alternative textuelle.
* Home Assistant peut publier la position du tresor via Bearer applicatif.
* Les API admin refusent un utilisateur non-admin.
* Les routes Radar, identite et admin ne sont pas mises en cache.
* Nginx versionne autorise la geolocalisation, transmet le JWT Access et supporte SSE.
* La documentation indique clairement les etapes manuelles Cloudflare et production.

## Risques

* Une mauvaise politique Cloudflare Access peut ouvrir Radar a trop d'utilisateurs. La politique doit cibler des emails exacts ou un groupe explicitement maitrise.
* Lire un email dans un en-tete non signe serait une faille. Seul le JWT valide doit etre utilise.
* Cloudflare Access et Nginx doivent transmettre correctement `Cf-Access-Jwt-Assertion`; sinon le backend refusera les routes protegees.
* Les navigateurs mobiles suspendent la geolocalisation en arriere-plan. L'interface doit expliquer que le partage fonctionne quand Radar est ouvert.
* Les tuiles externes creent une dependance reseau et de confidentialite. Documenter le fournisseur choisi.
* SSE peut etre affecte par le buffering proxy. Le bloc Nginx dedie doit etre valide en production.
* La migration d'authentification peut casser l'administration si l'allowlist admin ou l'audience Cloudflare sont mal configurees.
