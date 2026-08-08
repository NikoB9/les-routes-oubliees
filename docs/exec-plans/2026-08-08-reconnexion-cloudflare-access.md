# Reconnexion Cloudflare Access — relevé, correctif, vérification

## Objectif

Rendre la reprise d'une session Cloudflare Access expirée possible depuis **toutes** les pages,
et supprimer l'incohérence d'un menu profil qui propose « Se déconnecter » alors que la session
n'existe plus.

Ce document est écrit après l'annulation `53d20ff`, qui a défait sept correctifs successifs sur ce
même défaut. Il est donc construit pour une contrainte supplémentaire : **ne pas produire une
huitième hypothèse non vérifiée**. Chaque étape porte sa preuve, chaque piège porte son garde, et
l'étape 1 est un relevé — pas du code.

## État des lieux établi

### Le partage qui explique tout

`frontend/ngsw-config.json:4-11` déclare `"/**"` en positif : le service worker sert la coquille
applicative depuis son cache pour **toutes** les navigations, sauf les cinq motifs négatifs
`!/**/*.*`, `!/cdn-cgi/**`, `!/radar`, `!/admin`, `!/admin/**`.

Dans le `ngsw-worker.js` réellement installé (`@angular/service-worker` 22) :

* `AppVersion.handleFetch` (l. 1214-1221) — aucun groupe d'actifs ni de données ne correspond, mais
  `isNavigationRequest()` est vrai : la réponse est `/index.html` **pris dans le cache**. La requête
  ne quitte jamais le navigateur.
* `Driver.handleFetch` (l. 1854-1856) — si `AppVersion.handleFetch` rend `null` (motif exclu), le
  pilote appelle `safeFetch(event.request)` avec la **requête de navigation d'origine**, donc
  `redirect: 'manual'`. Cloudflare répond 302, la réponse est `opaqueredirect`, `respondWith()` a le
  droit de la rendre à une navigation, et le navigateur suit la redirection.

Conséquence directe, et c'est exactement l'observation de l'utilisateur :

| page | `window.location.assign(href)` | résultat |
|---|---|---|
| `/radar` | motif `^\/radar$` exclu | départ réseau, 302 Cloudflare, authentification, retour — **fonctionne** |
| `/`, `/map`, `/notebook` | motif `^\/.*$` positif | coquille rendue depuis le cache, Cloudflare jamais consulté — **clique dans le vide** |

`cloudflare-access-session.service.ts:57-61` (`retryNow()`) fait précisément ce
`window.location.assign(window.location.href)`. Le code du bouton est identique sur les deux pages ;
seules deux lignes de `ngsw-config.json` les séparent.

### L'en-tête n'a pas d'état « non authentifié »

`public-header.html:21-56` rend le bloc profil sans condition, et
`public-header.ts:26-35` réduit trois situations distinctes à un seul libellé :

```ts
if (identity?.displayName) return identity.displayName;
if (this.portal.loading())  return 'Portail';
return 'Choix requis';          // session expirée, hors ligne, ou backend en erreur
```

Après une déconnexion Access, `identity()` reste `null` et `loading()` retombe à `false` :
l'en-tête affiche un avatar « CR » nommé « Choix requis », dont le panneau propose « Se
déconnecter ». Il n'existe aucun signal d'authentification distinct de l'erreur générique
`portal.error()` (`portal-identity.store.ts:44-46`), qui est levée par n'importe quel échec.

### Le piège qui a rendu les sept tentatives illisibles

`ngsw-worker.js:1988` :

```js
const res = await this.safeFetch(this.adapter.newRequest("ngsw.json?ngsw-cache-bust=" + Math.random()));
```

Cette requête est émise **par le service worker**, donc sans l'en-tête `X-Requested-With` que pose
`cloudflare-access.interceptor.ts:33-36`. Cloudflare ne répond donc pas `401` mais **302 vers la page
de connexion** ; la requête, construite en `mode: 'cors'` / `redirect: 'follow'`, suit vers
`*.cloudflareaccess.com`, échoue en CORS, `safeFetch` rend un 504 de synthèse et
`fetchLatestManifest` lève.

**Tant que la session Access est expirée, l'application ne peut plus se mettre à jour.** Un
navigateur qui se trouve dans l'état « déconnecté + coquille en cache » reste figé sur le bundle
d'avant le correctif, et rejoue donc indéfiniment le défaut d'origine — quel que soit le nombre de
correctifs déployés entre-temps.

C'est la première cause à écarter avant toute conclusion sur un correctif futur, et c'est la raison
d'être de l'étape 1.3 ci-dessous.

## Périmètre

Inclus :

* `frontend/ngsw-config.json` et son test de motifs ;
* un chemin applicatif `/reconnexion` exclu du cache de navigation, et son composant ;
* `CloudflareAccessSessionService` et son test ;
* `PublicHeaderComponent`, son gabarit, sa feuille de style et son test ;
* `app.html` / `app.css` / `app.ts` : retrait du bandeau, région d'annonce ;
* `cloudflare-access.interceptor.spec.ts` : suivi du renommage ;
* `docs/ACCESSIBILITE.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOIEMENT.md`.

Hors périmètre :

* toute modification de la configuration Cloudflare Access (hors dépôt) ;
* toute modification du backend ;
* la stratégie de cache hors ligne des pages publiques, qui reste inchangée ;
* le comportement de `/cdn-cgi/access/logout`, qui fonctionne et n'est pas touché.

---

# Étape 1 — Relevé navigateur

**Statut : à faire. Aucune ligne de code n'est écrite avant que cette étape ne soit close.**

Objet : établir par l'observation, et non par déduction, que le document de navigation est servi par
le service worker sur `/` et par le réseau sur `/radar`. Trois mesures, dans l'ordre. Compter dix
minutes.

## 1.1 Partir d'un navigateur dont on connaît l'état

Le relevé n'a de valeur que si l'on sait quel code tourne. Sur le poste de test, **session Access
valide** :

1. Ouvrir le site dans une fenêtre normale (pas de navigation privée : le service worker doit être
   installé, c'est l'objet de la mesure).
2. DevTools → **Application → Service Workers**. Relever : l'état (`activated and is running`), et
   cocher **rien** — ni « Bypass for network », ni « Update on reload ». Ces cases fausseraient
   entièrement le relevé.
3. Ouvrir `https://<site>/ngsw/state` dans un onglet. Cette adresse est servie par le service worker
   lui-même (`ngsw-worker.js:1612`), sans réseau. Relever la ligne `Latest manifest hash`.

Noter les deux valeurs :

```
Manifest hash (avant)  : ........................
main-*.js chargé       : ........................   (onglet Réseau, ou source de la page)
```

## 1.2 Provoquer l'expiration

Deux façons, la seconde est préférable car elle reproduit le cas signalé :

* attendre l'expiration naturelle de la session Access ; ou
* ouvrir `https://<site>/cdn-cgi/access/logout` dans le **même** onglet, puis revenir sur le site par
  le bouton « précédent » ou en retapant l'adresse racine.

À ce moment, relever l'écran : l'en-tête affiche-t-il encore l'avatar et le nom de profil ? C'est la
confirmation du problème A, et elle vaut capture d'écran.

## 1.3 Mesure A — Accueil (le cas défaillant)

Sur `/`, DevTools → **Réseau**, filtre **Doc**, case « Preserve log » cochée, puis cliquer
« Se reconnecter ».

Relever la ligne de type `document` :

| à relever | valeur attendue si le diagnostic est bon |
|---|---|
| une ligne `document` apparaît-elle ? | oui |
| colonne **Size** | `(from ServiceWorker)` ou `(disk cache)` |
| colonne **Status** | `200` |
| une requête vers `*.cloudflareaccess.com` | **aucune** |
| la console porte-t-elle une erreur | non |

Si la colonne Size indique `(from ServiceWorker)` et qu'aucune requête ne part vers Cloudflare, le
diagnostic est **confirmé** et l'étape 2 s'applique telle qu'écrite.

## 1.4 Mesure B — Radar (le cas qui fonctionne, témoin)

Revenir sur `/radar`, provoquer de nouveau l'expiration, et rejouer le même relevé.

| à relever | valeur attendue |
|---|---|
| colonne **Size** de la ligne `document` | une taille en octets, **pas** `(from ServiceWorker)` |
| statut intermédiaire | `302` |
| requête vers `*.cloudflareaccess.com` | **présente** |

Cette mesure est le témoin : elle prouve que le mécanisme visé par l'étape 2 — un chemin exclu de
`navigationUrls` — fonctionne déjà en production sur ce site, avec cette version de Cloudflare et
cette configuration nginx.

## 1.5 Grille de décision

| observation | conclusion | suite |
|---|---|---|
| A servi par le service worker, B parti au réseau | diagnostic confirmé | étape 2 telle qu'écrite |
| A **et** B servis par le service worker | `navigationUrls` n'est pas la cause, ou le bundle est figé | reprendre en 1.1 : le hash de manifeste correspond-il au dernier déploiement ? |
| A parti au réseau sans 302 Cloudflare | la session n'était pas réellement expirée | rejouer 1.2 par la déconnexion explicite |
| A parti au réseau avec 302, et l'écran ne change toujours pas | cause inconnue, hors de ce diagnostic | **arrêter** ; relever console + chaîne de redirections complète avant toute écriture de code |

La dernière ligne est la plus importante : c'est celle où l'ancien cas s'est joué sept fois.

---

# Étape 2 — Correctif

**Statut : à faire, après l'étape 1. Un seul commit.**

Principe directeur : **une seule variable change**. Le mécanisme retenu est celui dont la mesure B
prouve qu'il fonctionne aujourd'hui — un chemin exclu de `navigationUrls`. Le marqueur `ngsw-bypass`
n'est pas retenu, non parce qu'il serait faux (l. 1609-1611 du worker est un `return` propre, avant
tout `respondWith`), mais parce qu'il a déjà été livré deux fois et jugé inopérant : le reprendre
serait reparier sur l'hypothèse perdue.

## 2.1 Le chemin réseau `/reconnexion`

**`frontend/ngsw-config.json`** — ajouter `"!/reconnexion"` aux motifs négatifs. Le compilateur
produit `^\/reconnexion$` ; `isNavigationRequest()` teste l'URL **privée de sa requête et de son
fragment** (`ngsw-worker.js:1238`), donc `?retour=...` ne gêne pas.

**`frontend/src/app/app.routes.ts`** — insérer avant la route générique `**` :

```ts
{
  path: 'reconnexion',
  loadComponent: () =>
    import('./features/access/reconnect-page/reconnect-page').then((m) => m.ReconnectPage),
  title: 'Reconnexion - Les Routes Oubliées',
},
```

**`frontend/src/app/features/access/reconnect-page/reconnect-page.ts`** — nouveau. Le composant
n'appelle **aucune** API : quand il s'exécute, l'authentification a déjà eu lieu, puisque Cloudflare
a laissé passer la navigation. Il ne fait que rebondir :

* lit `retour` dans les paramètres de requête ;
* le valide (voir piège nº 3) ;
* `router.navigateByUrl(destination, { replaceUrl: true })` — `replaceUrl` évite que le bouton
  « précédent » ne ramène sur `/reconnexion` ;
* affiche `<app-loading-indicator label="Reprise de votre session." />` le temps du rebond.

Nginx n'a rien à faire : `location /` et son `try_files $uri $uri/ /index.html`
(`frontend/nginx.conf:97-99` et `infra/nginx/les-routes-oubliees.conf.example:26-28`) couvrent déjà
n'importe quelle route de la SPA.

## 2.2 Le service de session

**`frontend/src/app/core/api/cloudflare-access-session.service.ts`** — le fichier se réduit à un
signal et deux méthodes :

| aujourd'hui | après | pourquoi |
|---|---|---|
| `reconnectRequired` (levé au **second** 401) | `sessionExpired` (levé au **premier**) | plus rien ne navigue tout seul : il n'y a plus de raison d'attendre un second échec pour le dire |
| `reauthenticate()` → `location.assign` | `noteExpiredSession()` → `set(true)` | l'intercepteur appelle à chaque 401 ; la méthode doit être idempotente et sans effet de bord |
| `retryNow()` | **supprimé** | l'action devient un lien HTML : plus aucune navigation en JavaScript, donc plus aucune façon d'y réintroduire une navigation interne |
| `reauthKey`, `pendingInMemory`, `isPending()`, `markPending()` | **supprimés** | le verrou n'existait que pour empêcher la boucle du rechargement automatique ; sans rechargement automatique, il n'y a plus de boucle |
| `confirmValidSession()` | conservé, simplifié | reste appelé par `portal-identity.store.ts:40`, seule preuve d'une session valide |

Le renommage `reauthenticate` → `noteExpiredSession` n'est pas cosmétique : il force à revisiter les
deux appelants (`cloudflare-access.interceptor.ts:47` et son double de test), et il dit ce que la
méthode fait désormais — constater, pas agir.

## 2.3 L'en-tête à quatre états

**`frontend/src/app/layout/header/public-header.html` / `.ts`** — le bloc profil devient exclusif :

| ordre | condition | rendu |
|---|---|---|
| 1 | `!online()` | « Hors ligne », **aucune action**, aucun menu |
| 2 | `accessSession.sessionExpired()` | un lien unique **`<a href>`** « Se reconnecter », aucun menu |
| 3 | `portal.loading()` | « Portail » (inchangé) |
| 4 | `portal.identity()` | menu profil actuel, **strictement inchangé** |
| 5 | sinon | « Indisponible », aucune action |

L'ordre compte : quand la session expire, `portal.error()` est vrai **aussi**, et `identity()` est
`null`. Un `@if` mal ordonné ferait retomber le cas 2 dans le cas 5.

L'état 1 n'est pas du zèle. Sans lui, un joueur sans réseau clique sur « Se reconnecter », part vers
un chemin volontairement exclu du cache, et **tombe sur la page d'erreur du navigateur** — le
désagrément exact rapporté pendant les tentatives précédentes. `navigator.onLine` est peu fiable
quand il vaut `true`, mais parfaitement fiable quand il vaut `false` : on ne s'en sert que pour
**retirer** l'action, jamais pour l'offrir.

Le suivi de l'état réseau se fait par `@HostListener('window:online')` / `('window:offline')`, dans
la continuité des trois `@HostListener` déjà présents dans ce composant (`public-header.ts:59, 74`).

L'adresse du lien se construit à partir de la route courante, suivie sur `NavigationEnd` — même
motif que `portal-identity-dialog.ts:23, 38-42` :

```ts
protected readonly reconnectHref = computed(() => {
  const url = this.currentUrl();
  const retour = url.startsWith('/reconnexion') ? '/' : url;   // jamais sa propre destination
  return `/reconnexion?retour=${encodeURIComponent(retour)}`;
});
```

## 2.4 Le bandeau et l'annonce

**`frontend/src/app/app.html:5-10`** — le bloc `.access-reconnect` disparaît, comme demandé.
**`frontend/src/app/app.css:22-45`** — les trois règles associées disparaissent avec lui.

Le bandeau portait `role="alert"`, documenté dans `docs/ACCESSIBILITE.md:457`. Un lien qui apparaît
en silence dans l'en-tête n'est annoncé par aucun lecteur d'écran. Il est remplacé par une région
d'annonce permanente, dont seul le **contenu** change — une région créée au moment où elle se remplit
n'est pas annoncée :

```html
<p class="sr-only" role="status">
  @if (accessSession.sessionExpired()) {
    Votre session sécurisée a expiré. Un lien « Se reconnecter » est disponible dans l'en-tête.
  }
</p>
```

`role="status"` implique déjà `aria-live="polite"` : ne pas ajouter les deux. La classe `.sr-only`
existe (`public-header.css:179`) mais les styles de composant sont encapsulés : il faut la reprendre
dans `app.css`, ou la déplacer dans les styles globaux — au choix, mais pas l'oublier.

`App` conserve donc son `inject(CloudflareAccessSessionService)` ; c'est le seul usage restant.

## 2.5 Documentation

| fichier | ligne | action |
|---|---|---|
| `docs/ARCHITECTURE.md` | 677 | ajouter `/reconnexion` à la liste des navigations exclues, avec sa raison |
| `docs/ACCESSIBILITE.md` | 457 | réécrire : plus de bandeau après double expiration ; lien dans l'en-tête + région `role="status"` |
| `docs/ACCESSIBILITE.md` | 431 | vérifier — reste vrai, le menu profil existe toujours à l'état identifié |
| `docs/DEPLOIEMENT.md` | 856-860 | compléter la liste des exclusions de l'addendum |
| `docs/DEPLOIEMENT.md` | 875 | réécrire le point de contrôle 10 : aucune navigation automatique, action explicite qui aboutit depuis n'importe quelle page |
| `docs/DEPLOIEMENT.md` | 876 | conserver, et ajouter un point 12 : « depuis une page publique servie par le cache, le lien de reconnexion redemande une authentification » |

Une affirmation fausse en documentation a déjà masqué ce défaut une fois (`38cdbe3` :
« le service worker exclut toutes les navigations »). Ce tableau n'est pas de la finition.

## 2.6 Les pièges, et le garde qui les rattrape

Chaque piège de cette liste est **invisible en test unitaire et invisible à l'écran** : il ne se
manifeste qu'en production, derrière Cloudflare. C'est pourquoi chacun reçoit un garde qui échoue
bruyamment.

| nº | piège | conséquence si on tombe dedans | garde |
|---|---|---|---|
| 1 | écrire `routerLink="/reconnexion"` au lieu de `href` | navigation **interne** Angular : le réseau n'est jamais touché, le correctif meurt en silence et tous les tests passent | test qui lit `public-header.html` comme texte et refuse `routerLink` sur l'ancre de reconnexion — le dépôt teste déjà des fichiers de configuration comme données (`ngsw-config.spec.ts`, `angular-build-config.spec.ts`) |
| 2 | oublier `"!/reconnexion"` dans `ngsw-config.json` | le chemin est servi depuis le cache : retour exact au défaut d'origine | `expect(negatives).toContain('!/reconnexion')` dans `ngsw-config.spec.ts` |
| 3 | ne pas valider `retour` | redirection ouverte : `?retour=//evil.example` sort du site | test du composant sur `//evil.example`, `https://evil.example`, `/\evil`, `javascript:` — tous doivent retomber sur `/` |
| 4 | ordonner les `@if` de l'en-tête au hasard | la session expirée retombe dans « Indisponible », sans action | tests d'en-tête sur les cinq états, celui de session expirée avec `portal.error()` **aussi** vrai |
| 5 | offrir le lien hors ligne | page d'erreur du navigateur, application perdue | test d'en-tête avec `navigator.onLine` à `false` : aucune ancre `/reconnexion` rendue |
| 6 | créer la région `role="status"` au moment de l'expiration | rien n'est annoncé | test qui vérifie que le `<p role="status">` est présent **dès le rendu initial**, vide |

## 2.7 Récapitulatif des fichiers

| fichier | nature |
|---|---|
| `frontend/ngsw-config.json` | +1 motif |
| `frontend/src/app/core/offline/ngsw-config.spec.ts` | +1 test |
| `frontend/src/app/app.routes.ts` | +1 route |
| `frontend/src/app/features/access/reconnect-page/reconnect-page.{ts,html,css,spec.ts}` | nouveaux |
| `frontend/src/app/core/api/cloudflare-access-session.service.ts` | réécrit, réduit |
| `frontend/src/app/core/api/cloudflare-access-session.service.spec.ts` | réécrit |
| `frontend/src/app/core/api/cloudflare-access.interceptor.ts` | 1 appel renommé |
| `frontend/src/app/core/api/cloudflare-access.interceptor.spec.ts` | double renommé |
| `frontend/src/app/layout/header/public-header.{ts,html,css,spec.ts}` | états d'authentification |
| `frontend/src/app/app.{ts,html,css}` | bandeau retiré, région d'annonce |
| `frontend/src/app/app.spec.ts` | absence du bandeau, présence de la région |
| `docs/{ARCHITECTURE,ACCESSIBILITE,DEPLOIEMENT}.md` | mise en cohérence |

---

# Étape 3 — Vérification

**Statut : à faire. Aucune annonce de « terminé » avant que 3.1 à 3.3 ne soient toutes passées.**

## 3.1 Local

Le Node du poste (v22.12.0) est trop ancien pour Angular 22 : la CLI refuse de démarrer et
`npm test` échoue immédiatement. Le dépôt fournit le contournement, à lancer depuis **PowerShell**
(en Git Bash, `-w /workspace` est réécrit et Docker refuse le chemin) :

```powershell
.\scripts\frontend-check.ps1 -Task all
```

qui enchaîne `npm run lint`, `npm test -- --watch=false` et `npm run build` dans
`node:24.15.0-bookworm`. Les trois doivent passer, **build de production compris** — c'est lui qui
recompile `ngsw-config.json` en `ngsw.json` et donc qui valide le nouveau motif.

Contrôle supplémentaire, à faire à la main une fois le build produit :

```
frontend/dist/.../ngsw.json  →  navigationUrls doit contenir {"positive": false, "regex": "^\\/reconnexion$"}
```

## 3.2 Prouver que le bundle change

Avant déploiement, relever le nom du nouveau `main-*.js` produit par le build. Après déploiement, et
**avant** tout test fonctionnel, vérifier sur le navigateur de test que c'est bien celui-là qui
s'exécute — onglet Réseau, ou `https://<site>/ngsw/state` comparé au relevé de l'étape 1.1.

Si le hash n'a pas changé côté navigateur, **le test qui suit ne mesure rien**. Forcer alors la mise
à jour, session Access valide : DevTools → Application → Service Workers → **Unregister**, puis
rechargement forcé. C'est le point exact où les sept tentatives précédentes ont pu se juger
elles-mêmes à tort.

## 3.3 Terrain

Rejouer intégralement le relevé de l'étape 1, dans le même ordre, et attendre :

| mesure | attendu après correctif |
|---|---|
| 1.2 — écran après déconnexion | l'en-tête ne porte **plus** d'avatar ni de menu, mais un lien « Se reconnecter » |
| 1.3 — Accueil, clic sur le lien | ligne `document` vers `/reconnexion`, **taille en octets**, `302`, requête vers `*.cloudflareaccess.com`, retour sur la page d'origine authentifié |
| 1.4 — Radar | inchangé, fonctionne comme avant |

Puis les quatre cas qui n'apparaissent pas dans le relevé :

1. depuis `/notebook/<quête>`, la reconnexion ramène **sur cette quête**, pas sur l'accueil ;
2. bouton « précédent » après reconnexion : ne repasse pas par `/reconnexion` ;
3. mode avion activé : l'en-tête affiche « Hors ligne » et **n'offre aucun lien** ;
4. lecteur d'écran (NVDA ou VoiceOver) : l'expiration est annoncée.

## 3.4 Critères d'acceptation

- [ ] `.\scripts\frontend-check.ps1 -Task all` : lint, tests, build — zéro échec
- [ ] `ngsw.json` produit contient `^\/reconnexion$` en motif négatif
- [ ] le bundle exécuté en production est bien le nouveau (hash relevé)
- [ ] reconnexion aboutie depuis `/`, `/map`, `/notebook`, `/notebook/<quête>`, `/radar`
- [ ] retour sur la page consultée, pas sur l'accueil
- [ ] aucun menu profil, aucun « Se déconnecter » hors session
- [ ] hors ligne : aucune action de reconnexion offerte, aucune page d'erreur navigateur
- [ ] expiration annoncée aux lecteurs d'écran
- [ ] les six documents et points de contrôle mis à jour disent vrai

## 3.5 Repli

Un commit unique, donc `git revert <sha>` suffit et rend un état connu — celui de `53d20ff`, dont le
défaut est documenté et supportable. **Ne jamais réécrire un historique déjà poussé.**

Règle d'arrêt, tirée de l'ancien cas : si le relevé 3.3 ne donne pas le résultat attendu,
**ne pas livrer un correctif de plus**. Revenir à l'étape 1.5, relever ce qui manque, et revenir avec
l'observation — pas avec une hypothèse.

## Risques

* **Le navigateur de test peut exécuter un ancien bundle.** Traité en 3.2 ; c'est le risque nº 1.
* **`navigator.onLine` peut valoir `true` sans connectivité réelle.** Accepté : le signal ne sert
  qu'à retirer l'action, jamais à l'offrir. Le pire cas est celui d'aujourd'hui.
* **Un `routerLink` réintroduit plus tard tuerait le correctif en silence.** Traité par le garde nº 1.
* **La suite frontend dépend de Docker.** Sans Docker, aucune vérification n'est possible sur ce
  poste : ne rien annoncer comme terminé dans ce cas.
* **Perte de la réparation automatique sur `/radar`.** Voir la décision D3 ci-dessous : c'est un
  arbitrage assumé, pas un oubli.

## Décisions prises

| id | question | décision |
|---|---|---|
| D1 | libellé du lien | « Se reconnecter » partout — le site n'a pas d'état anonyme, tout accès passe par Access |
| D2 | annonce vocale de l'expiration | conservée, région `role="status"` toujours présente et vide (§2.4) |
| D3 | reconnexion automatique sur `/radar` et `/admin` | non pour ce commit : ce serait le retour du verrou `sessionStorage` et du risque de boucle. À reconsidérer une fois le correctif vérifié sur le terrain |
| D4 | ordre des étapes | l'étape 2 a été écrite avant le relevé de l'étape 1, sur demande. Le relevé reste dû **au moment du test terrain** (étape 3.3), où il a la même valeur probante |

## Journal

* **2026-08-08** — étape 2 écrite. `!/reconnexion`, route et composant de rebond, service réduit à
  un signal sans navigation, en-tête à cinq états, bandeau remplacé par une région `role="status"`,
  six gardes, six documents alignés. Suite frontend : 148 tests, 20 fichiers, 0 échec.
* **2026-08-08** — le rebond du composant était couvert par un `Router` factice, ce qui ne prouve
  rien sur le vrai routeur : rebondir depuis le constructeur d'un composant activé par une
  navigation en cours est exactement le genre de détail qui passe en test et échoue en
  production. Deux cas pilotant le `Router` réel ont été ajoutés.
* **2026-08-08** — étape 3.1 close. `npm run lint` sans remontée ; **150 tests, 20 fichiers,
  0 échec** ; build de production réussi. Le `ngsw.json` généré porte bien
  `{"positive": false, "regex": "^\\/reconnexion$"}` — et `isNavigationRequest()` testant l'URL
  privée de sa requête, `?retour=…` ne la fait pas retomber dans le cache.
* **2026-08-08** — audit complet du diff. Trois défauts trouvés et corrigés :
  1. saut de ligne final absent de `cloudflare-access-session.service.ts`, contre `.editorconfig` ;
  2. **l'état `offline` primait sur `identified`** : un aventurier perdant le réseau sur le terrain
     voyait son nom et son menu remplacés par « Hors ligne », alors que son identité restait
     valide en mémoire, et perdait l'accès administration. L'ordre est corrigé — l'absence de
     réseau ne neutralise que la reprise, elle ne masque jamais une identité chargée ;
  3. la région `role="status"` annonçait « un lien Se reconnecter est disponible dans l'en-tête »
     y compris hors ligne, où ce lien n'existe pas. Reformulée pour rester vraie dans les deux cas.
  Après correction : **151 tests, 20 fichiers, 0 échec**, lint et build de production compris.
* **2026-08-08** — second audit. Un défaut de plus, introduit par le premier jet : l'état
  `unavailable` était la **seule impasse** de l'en-tête — un « Indisponible » sans action, là où
  le menu de profil offrait au moins une déconnexion. Or deux de ses trois causes se réparent par
  une navigation à travers Cloudflare (jeton refusé à l'origine, redirection au lieu d'un `401`),
  et la troisième n'en souffre pas. Il propose désormais « Réessayer », même ancre réseau que la
  reprise. L'en-tête n'a plus d'état sans issue hors « Hors ligne », où il n'y a rien à faire.
* **2026-08-08** — troisième audit, sur les fichiers plutôt que sur le diff. Aucun défaut trouvé.
  Il a comblé une lacune des deux précédents, qui n'avaient jamais vérifié la **couche de
  service** : les deux configurations Nginx — `frontend/nginx.conf` et
  `infra/nginx/les-routes-oubliees.conf.example` — portent bien `try_files $uri $uri/ /index.html`,
  donc `/reconnexion` reçoit la coquille et non un `404`. Sans cela, le correctif échouait en
  production pour une raison entièrement étrangère au service worker. Vérifié également :
  `PortalMe.identity` n'est pas nullable, donc l'état `unavailable` désigne bien un échec de
  chargement et jamais un instant normal ; la suite Playwright ne couvre que `/`, `/map` et
  `/notebook`, sans dépendance à l'en-tête réécrit ; Prettier diverge sur 47 fichiers du dépôt,
  qu'aucun script n'applique — ce n'est donc pas une norme, et les fichiers touchés s'alignent
  sur l'existant.
* **Bundle de référence pour l'étape 3.2** : `main-UQZBEOZH.js` (le nom change à chaque build ;
  celui-ci correspond au dernier état vérifié — lint, 151 tests, build de production). C'est ce nom qui doit apparaître
  dans l'onglet Réseau après déploiement. S'il n'apparaît pas, le navigateur exécute encore
  l'ancien code et **le relevé terrain ne mesure rien**.
* **Étape 1 (relevé) : non faite.** Reportée à l'étape 3.3, par la décision D4.
* **Étape 3.2 et 3.3 (terrain) : dues.** Le correctif est vérifié en local, pas en production.
