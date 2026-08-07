# Déploiement et exploitation

## 1. Cible

L’application doit être hébergée dans un conteneur Proxmox LXC.

Elle est rendue accessible publiquement par Cloudflare Tunnel.

Le conteneur héberge :

* le reverse proxy ;
* le frontend compilé ;
* le backend Spring Boot ;
* PostgreSQL ;
* le stockage des médias ;
* le client Cloudflare Tunnel.

Cette architecture convient au MVP et évite une orchestration de conteneurs supplémentaire dans le LXC.

La conteneurisation est néanmoins utilisée pour le développement local avec Docker Compose ou un équivalent compatible. En production LXC, le chemin recommandé reste l’exécution native des services avec systemd. Une variante Compose complète dans le LXC est possible uniquement si le LXC autorise explicitement les conteneurs imbriqués et si cette contrainte d’exploitation est acceptée.

## 2. Système

Utiliser une distribution Linux stable et maintenue.

Ne pas utiliser une version en fin de support.

Créer un utilisateur système non privilégié dédié :

```text
routesoubliees
```

Le backend ne doit pas fonctionner en tant que `root`.

## 3. Ressources initiales

Point de départ à valider par mesure réelle :

```text
CPU      : 2 vCPU
Mémoire  : 2 Gio
Disque   : 20 Gio minimum
```

Prévoir davantage de stockage si les médias deviennent nombreux.

Surveiller :

* mémoire PostgreSQL ;
* mémoire Java ;
* taille des médias ;
* taille des sauvegardes ;
* espace des logs.

Ne pas augmenter les ressources sans observer les métriques.

## 4. Arborescence cible

```text
/opt/les-routes-oubliees/
├── backend/
│   ├── current/
│   └── releases/
└── frontend/
    ├── current/
    └── releases/

/var/lib/les-routes-oubliees/
└── media/

/etc/les-routes-oubliees/
└── application.env

/var/backups/les-routes-oubliees/
├── database/
└── media/
```

Permissions :

* code lisible par le service ;
* médias modifiables par le service ;
* secrets lisibles uniquement par le compte nécessaire ;
* fichier d’environnement en mode restrictif.

## 5. Services

Services système :

```text
nginx
postgresql
les-routes-oubliees-backend
cloudflared
```

Le nom du reverse proxy peut évoluer, mais une seule technologie doit être retenue en production.

## 6. Réseau

Exposition locale indicative :

```text
Reverse proxy : 127.0.0.1:8088 ou socket local
Spring Boot   : 127.0.0.1:8080
PostgreSQL    : 127.0.0.1:5432
```

Cloudflare Tunnel pointe vers le reverse proxy local.

### 6.1 Adresse d’écoute Spring

L’adresse d’écoute est pilotée par `server.address`, alimentée par défaut par la variable `SERVER_ADDRESS`. Les deux topologies du dépôt sont différentes et ne doivent pas être confondues.

**Déploiement systemd sur l’hôte (production LXC)**

* le profil et l’adresse sont passés en **arguments de programme** dans `ExecStart`, et non par `Environment=` :
  `--spring.profiles.active=prod --server.address=127.0.0.1` ;
* raison : systemd donne la priorité au contenu de `EnvironmentFile=` sur les directives `Environment=`. Une ligne oubliée dans `/etc/les-routes-oubliees/application.env` pourrait donc réactiver le profil `dev` — donc l’identité locale factice — ou une écoute sur toutes les interfaces. Les arguments de programme sont la source de propriétés la plus prioritaire de Spring Boot et ne peuvent pas être écrasés par un fichier d’environnement ;
* le fichier d’environnement ne porte donc que les secrets et la connexion à la base ;
* Spring n’est joignable que depuis l’hôte ;
* Nginx, sur la même machine, est le seul point d’entrée ;
* aucun port Spring n’est ouvert sur les autres interfaces ;
* garde-fou complémentaire : le démarrage du profil `prod` échoue si le profil `dev` est actif simultanément.

**Déploiement en conteneurs (profil Compose `app`)**

* `SERVER_ADDRESS=0.0.0.0` dans le conteneur backend : Nginx s’exécute dans un conteneur distinct et doit pouvoir joindre le service par le réseau Compose ;
* la publication du port reste limitée au loopback de l’hôte : `127.0.0.1:${BACKEND_PORT:-8080}:8080` ;
* l’écoute large est donc confinée au réseau interne du conteneur, jamais exposée sur les interfaces de l’hôte.

Ne jamais figer `server.address=127.0.0.1` dans un profil également utilisé par un conteneur séparé de Nginx : le proxy ne pourrait plus joindre le backend.

Ne pas exposer directement :

* Spring Boot ;
* PostgreSQL ;
* les endpoints Actuator sensibles ;
* les fichiers de configuration.

## 7. Reverse proxy

Le reverse proxy :

* sert les fichiers Angular ;
* redirige les routes frontend vers `index.html`;
* transmet `/api/` au backend ;
* transmet le JWT Cloudflare Access et les routes API nécessaires ;
* transmet `/media/` sans imposer de `Cache-Control`, l'en-tête venant du backend ;
* plafonne le débit de la publication Home Assistant ;
* ajoute ou préserve les en-têtes de proxy ;
* limite la taille des uploads ;
* interdit le listing de répertoires ;
* applique des en-têtes de sécurité ;
* sert correctement `manifest.webmanifest`, `ngsw-worker.js` et les fichiers `ngsw*.json` générés par Angular.

En-têtes de sécurité cibles :

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
X-Frame-Options ou frame-ancestors dans la CSP
```

Nginx n’hérite les `add_header` du niveau supérieur que si l’emplacement courant n’en déclare aucun. Chaque emplacement qui pose son propre `Cache-Control` doit donc répéter les en-têtes de sécurité, sans quoi la réponse part sans politique. Le cas critique est `location = /index.html` : `try_files` y redirige en interne toutes les routes de la SPA, donc le document HTML de chaque page perdrait sa CSP. Les exemples `infra/nginx/les-routes-oubliees.conf.example` et `frontend/nginx.conf` appliquent cette répétition ; vérifier après toute modification que `/`, `/radar` et `/carnet` renvoient bien la CSP et `Permissions-Policy`.

Deux pièges lient la CSP au build du frontend, tous deux silencieux à la compilation :

* `optimization.styles.inlineCritical` est **désactivé** dans `frontend/angular.json`. Activée — c'est le défaut d'Angular — cette option n'insère plus la feuille globale que par `<link media="print" onload="this.media='all'">`. `script-src 'self'` interdit les gestionnaires d'évènements en ligne : le `onload` ne s'exécute jamais, la feuille reste destinée à l'impression et **aucun style global ne s'applique**, `leaflet.css` compris. Les styles de composants, eux, sont intégrés au JavaScript et continuent de s'appliquer : la page paraît presque normale, ce qui rend la panne difficile à lire. Symptôme côté Radar : les tuiles quittent le positionnement absolu, retombent dans le flux et la carte s'étire sans fin.
* `connect-src` doit lister le domaine des tuiles au même titre qu'`img-src`. Le service worker intercepte les requêtes d'images et les rejoue par `fetch()`, soumis à `connect-src` ; refusé, ngsw répond par sa 504 de synthèse et la carte reste vide.

Les réponses admin et API sensibles ne doivent pas être mises en cache par un proxy partagé. Les médias publics peuvent avoir une politique de cache séparée lorsqu’ils sont publiés.

Pour la PWA :

* HTTPS est obligatoire en production ;
* les fichiers du service worker Angular doivent être servis depuis la racine du frontend ;
* les routes admin, Radar, portail, intégration et écriture ne doivent pas être servies depuis un cache applicatif hors ligne ;
* après déploiement, vérifier l'installation PWA et la mise à jour du snapshot de contenu après modification d'un contenu publié.

Routage indicatif :

```text
/                 -> Angular
/api/             -> Spring Boot, JWT Cloudflare exigé
/api/portal/      -> Spring Boot, JWT Cloudflare exigé
/api/radar/       -> Spring Boot, JWT Cloudflare exigé
/radar, /admin    -> Angular, après validation Cloudflare Access globale
/media/           -> Spring Boot, JWT Cloudflare exigé
/actuator/health  -> accès local uniquement
```

Côté Spring, seules `/`, `/error` et `/actuator/health` restent accessibles sans identité : la racine et les fichiers Angular sont servis par le reverse proxy, `/error` est le dispatch interne du conteneur servlet, et `/actuator/health` est restreint au loopback par Nginx. Toute autre requête, y compris `/api/public/**` et `/media/**`, exige un JWT Cloudflare Access valide. Le seul `POST /api/integrations/home-assistant/radar/treasure-position` fait exception et utilise son Bearer applicatif.

## 8. Domaine et Cloudflare Access

Configurer Cloudflare Access avec deux applications manuelles sur le même hôte.

| Application | Destination | Politique |
| --- | --- | --- |
| Application humaine | `lesroutesoubliees.nicolas-bourneuf.fr`, champ `Path` vide | `Allow` via Google ou One-time PIN |
| Exception Home Assistant | chemin exact `api/integrations/home-assistant/radar/treasure-position` | `Bypass` / `Contourner` avec `Everyone` / `Tout le monde` |

L'application humaine protège la totalité de l'hôte. Aucune page du site n'est accessible anonymement. Cloudflare authentifie l'utilisateur, mais l'application conserve l'autorisation : les routes `/api/admin/**` exigent toujours un email présent dans l'allowlist administrateur active.

L'exception Home Assistant doit être strictement limitée au chemin exact de publication de position. Ne pas utiliser de joker, ne pas étendre à `/api/integrations/*`, `/api/integrations/home-assistant/*` ou `/api/*`, ne pas créer de second sous-domaine, de second tunnel, de Service Token Cloudflare ni d'application Service Auth.

### 8.1 Secret Home Assistant

Le secret Bearer applicatif est obligatoire en production :

* générer au moins 32 octets aléatoires, encodés en base64url, soit 43 caractères :
  `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='` ;
* le fournir par `RADAR_HOME_ASSISTANT_TOKEN` dans le fichier d'environnement du service ;
* aucune valeur de secours n'existe dans le dépôt : sans variable, le démarrage du profil `prod` échoue immédiatement ;
* le démarrage échoue également si la valeur est vide, reconnaissable comme factice, ou plus courte que l'encodage documenté ;
* la longueur ne prouve pas l'entropie : elle est vérifiée pour détecter une erreur de configuration, pas pour valider le caractère aléatoire du secret ;
* le secret n'est écrit ni dans les journaux ni dans les messages d'erreur ;
* le profil `dev`, qui injecte une identité locale factice à la place de Cloudflare Access, ne doit jamais être actif sur le serveur : le contrôle de démarrage `prod` refuse cette combinaison.

### 8.2 Limite de taille du chemin Home Assistant

Le corps accepté sur `POST /api/integrations/home-assistant/radar/treasure-position` est limité à 4096 octets à deux niveaux :

* Nginx applique `client_max_body_size 4k` sur cet emplacement exact uniquement ;
* le backend lit le corps de manière bornée, y compris lorsque `Content-Length` est absent ou que la requête utilise un transfert fragmenté, et répond `413 Payload Too Large` au-delà.

Cette limite n'est pas généralisée aux autres routes, dont les besoins diffèrent (téléversement de médias notamment).

Configurer correctement la gestion des en-têtes transférés afin que Spring reconstruise l'URL publique HTTPS derrière le proxy.

Tester obligatoirement :

* connexion ;
* accès direct à `/`, `/radar` et `/admin` sans session, qui doit déclencher Cloudflare Access ;
* validation du JWT `Cf-Access-Jwt-Assertion` ;
* deconnexion via `/cdn-cgi/access/logout` ;
* refus d’un email non autorisé ;
* expiration de session ;
* `POST` sans Bearer sur l'endpoint Home Assistant exact, qui doit atteindre le backend et répondre `401` sans redirection Cloudflare ;
* chemin voisin de l'intégration Home Assistant, qui doit rester intercepté par Cloudflare Access.

### 8.1 Recuperation allowlist admin

L'amorcage `ADMIN_BOOTSTRAP_EMAILS` n'est applique que lorsque la table des administrateurs est vide. Il ne reactive pas automatiquement un compte desactive, afin d'eviter qu'un ancien email retire redevienne administrateur au redemarrage.

Si tous les administrateurs actifs ont ete retires par erreur, restaurer l'acces uniquement apres verification hors application, depuis une session PostgreSQL d'exploitation :

```sql
update admin_allowed_emails
set active = true, updated_at = now()
where email = 'admin@example.invalid';
```

Utiliser une adresse reelle deja controlee et presente dans la table. Ajouter une nouvelle adresse par SQL ne doit etre fait qu'en dernier recours, apres sauvegarde de la base et validation de l'identite du demandeur.

## 9. Variables d’environnement

Fichier :

```text
/etc/les-routes-oubliees/application.env
```

Le profil actif et l’adresse d’écoute ne sont **pas** définis ici : ils sont épinglés en arguments de programme dans l’unité systemd (voir §6.1), car le contenu de `EnvironmentFile=` prime sur les directives `Environment=`.

Variables minimales :

```text
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/routes_oubliees
DATABASE_USERNAME=routes_oubliees
DATABASE_PASSWORD=CHANGE_ME

CF_ACCESS_ISSUER=https://TEAM.cloudflareaccess.com
CF_ACCESS_AUDIENCE=CHANGE_ME
CF_ACCESS_CERTS_URL=https://TEAM.cloudflareaccess.com/cdn-cgi/access/certs
RADAR_HOME_ASSISTANT_TOKEN=32_OCTETS_ALEATOIRES_EN_BASE64URL
ADMIN_BOOTSTRAP_EMAILS=admin@example.invalid

MEDIA_STORAGE_PATH=/var/lib/les-routes-oubliees/media
MEDIA_MAX_UPLOAD_BYTES=5242880
SITE_PUBLIC_URL=https://example.invalid
SITE_TIMEZONE=Europe/Paris
```

Le fichier `.env.example` du dépôt contient uniquement des valeurs factices.

### Plafond de téléversement des médias

`MEDIA_MAX_UPLOAD_BYTES` est le seul réglage à modifier : `MediaUploadConfiguration` en dérive la limite du conteneur servlet, avec une marge de 16 Kio pour le champ `altText` et les délimiteurs multipart. Ne pas poser de `spring.servlet.multipart.max-file-size` en parallèle, ce serait rouvrir l'écart que ce calcul referme — laissée à son défaut, cette propriété valait 1 Mio et rejetait toute photo de téléphone bien avant le plafond applicatif annoncé.

Seule contrainte externe : `client_max_body_size` côté Nginx doit rester **au moins aussi permissif**, sinon c'est Nginx qui refuse en premier, avec son propre `413` et sans passer par l'application. La valeur versionnée est `10m`, ce qui couvre les 5 Mio par défaut ; en cas d'augmentation, remonter les deux.

Ne jamais placer le fichier de production dans Git.

## 10. PostgreSQL

### 10.1 Base

Créer :

* une base dédiée ;
* un utilisateur dédié ;
* des droits limités à cette base ;
* un mot de passe fort ;
* une authentification locale sécurisée.

### 10.2 Migrations

Flyway exécute les migrations au démarrage ou dans une étape contrôlée du déploiement.

Avant une migration importante :

* sauvegarder la base ;
* vérifier l’espace disque ;
* lire la migration ;
* tester sur une copie ou un environnement de préproduction ;
* prévoir le retour arrière applicatif.

Éviter les migrations destructives immédiates.

Approche recommandée :

1. ajouter le nouveau schéma ;
2. rendre le code compatible ;
3. migrer les données ;
4. supprimer l’ancien schéma dans une version ultérieure.

## 11. Build

### Frontend

```bash
cd frontend
npm ci
npm run lint
npm test -- --watch=false
npm run build
```

### Backend

```bash
cd backend
./mvnw verify
./mvnw package
```

Ne pas déployer un build dont les tests nécessaires ont échoué.

## 12. Déploiement

Procédure cible :

1. récupérer le commit ou tag validé ;
2. exécuter les tests ;
3. construire le frontend ;
4. construire le backend ;
5. sauvegarder la base ;
6. sauvegarder les médias ;
7. copier les artefacts dans un nouveau répertoire de release ;
8. mettre à jour les liens `current`;
9. redémarrer le backend ;
10. recharger le reverse proxy si nécessaire ;
11. exécuter les smoke tests ;
12. surveiller les logs.

Ne pas remplacer directement les fichiers de la release active pendant leur utilisation.

## 13. Service systemd backend

Le service doit :

* utiliser l’utilisateur non privilégié ;
* lire le fichier d’environnement ;
* démarrer après le réseau et PostgreSQL ;
* redémarrer en cas d’échec raisonnable ;
* limiter les privilèges ;
* écrire dans journald ;
* disposer uniquement des accès nécessaires.

Le fichier de service final sera placé dans :

```text
infra/systemd/
```

Un exemple non secret est fourni dans `infra/systemd/les-routes-oubliees-backend.service.example`.

## 14. Sauvegardes

### 14.1 Base

Utiliser un dump PostgreSQL au format personnalisé :

```bash
pg_dump -Fc
```

### 14.2 Médias

Sauvegarder :

```text
/var/lib/les-routes-oubliees/media/
```

### 14.3 Cohérence

Une sauvegarde complète comprend :

* dump PostgreSQL ;
* médias ;
* version applicative ou tag Git ;
* date ;
* informations nécessaires à la restauration.

### 14.4 Rétention initiale

Politique initiale suggérée :

* 7 sauvegardes quotidiennes ;
* 4 sauvegardes hebdomadaires ;
* 3 sauvegardes mensuelles.

Adapter cette politique à l’espace disponible.

### 14.5 Destination

Ne pas conserver l’unique copie de sauvegarde dans le même conteneur.

Prévoir une copie :

* sur stockage Proxmox ;
* ou sur un espace externe sécurisé.

## 15. Restauration

Documenter et tester :

1. création d’une base vide ;
2. restauration du dump ;
3. restauration des médias ;
4. vérification des permissions ;
5. démarrage de l’application ;
6. vérification des migrations ;
7. test de connexion admin ;
8. vérification du contenu public.

Une sauvegarde non testée ne constitue pas une garantie de restauration.

## 16. Retour arrière

Conserver au moins la release précédente.

Un rollback applicatif doit permettre :

* de repointer `current` vers la release précédente ;
* de redémarrer le backend ;
* de restaurer le frontend précédent.

Le rollback de base est plus délicat.

Les migrations doivent donc être compatibles avec la release précédente autant que possible.

Avant une migration irréversible, créer et vérifier une sauvegarde.

## 17. Logs

Utiliser journald pour le backend.

Les logs doivent contenir :

* instant ;
* niveau ;
* logger ;
* identifiant de requête ;
* message ;
* contexte non sensible.

Ne pas enregistrer :

* secrets ;
* tokens ;
* cookies ;
* contenu complet des sessions ;
* mots de passe ;
* en-têtes d’autorisation ;
* contenu narratif complet sans nécessité.

Configurer une rétention afin d’éviter le remplissage du disque.

## 18. Supervision

Surveiller au minimum :

* disponibilité HTTP ;
* santé backend ;
* espace disque ;
* mémoire ;
* charge CPU ;
* état PostgreSQL ;
* date de la dernière sauvegarde ;
* erreurs applicatives ;
* validité du tunnel Cloudflare.

Les endpoints de santé détaillés ne doivent pas être publics.

## 19. Sécurité système

* mises à jour régulières ;
* services inutiles désactivés ;
* SSH par clé ;
* connexion root distante désactivée lorsque possible ;
* pare-feu local ;
* PostgreSQL limité à localhost ;
* backend limité à localhost ;
* permissions minimales ;
* rotation des secrets ;
* sauvegardes protégées ;
* aucun secret dans l’historique Git.

## 20. Cloudflare Tunnel

Le tunnel :

* pointe vers le reverse proxy local ;
* est exécuté comme service ;
* utilise un secret conservé hors Git ;
* redémarre automatiquement ;
* ne remplace pas l’authentification applicative ;
* ne doit pas donner accès à PostgreSQL ou SSH.

## 21. CI

Le dépôt public doit disposer à terme d’une CI exécutant :

* build frontend ;
* lint frontend ;
* tests frontend ;
* build backend ;
* tests backend ;
* analyse des migrations ;
* détection de secrets ;
* analyse des dépendances ;
* tests d’accessibilité automatisés pertinents.

La CI ne doit pas contenir les secrets de production.

Le déploiement automatique en production n’est pas obligatoire pour le MVP.

Avant la mise en place de la CI, les mêmes commandes doivent être exécutées localement et mentionnées dans le compte rendu final de chaque lot. Un lot ne doit pas être déclaré terminé si les validations applicables échouent.

## 22. Checklist avant mise en production

### Application

* builds réussis ;
* tests réussis ;
* migrations testées ;
* compte admin d’amorçage configuré ;
* données de démonstration supprimées ;
* page d’accessibilité préparée ;
* erreurs publiques vérifiées.

### Sécurité

* secrets absents de Git ;
* cookies sécurisés ;
* CSRF actif ;
* CORS restrictif ;
* uploads limités ;
* Markdown nettoyé ;
* endpoints admin protégés ;
* Actuator non exposé.

### Infrastructure

* tunnel actif ;
* proxy configuré ;
* PostgreSQL non public ;
* services systemd actifs ;
* sauvegarde réussie ;
* restauration testée ;
* surveillance de l’espace disque ;
* journalisation fonctionnelle.

### Fonctionnel

* accueil ;
* timer ;
* aventuriers ;
* carte ;
* quêtes ;
* prévisualisation ;
* connexion Cloudflare Access ;
* refus d’un non-administrateur ;
* responsive ;
* navigation clavier.

## 23. Packaging et deploiement manuel

Cette procedure decrit le flux manuel depuis PowerShell vers le conteneur LXC.

### 23.1 Format de release

Le script local cree une archive :

```text
dist/les-routes-oubliees-release.tar.gz
```

L'archive contient au minimum :

```text
backend/app.jar
frontend/index.html
release-info.txt
```

Cote serveur, les releases sont deployeees sous la forme :

```text
/opt/les-routes-oubliees/
├── current -> /opt/les-routes-oubliees/releases/YYYYMMDDHHMMSS
└── releases/
    └── YYYYMMDDHHMMSS/
        ├── backend/
        │   └── app.jar
        ├── frontend/
        │   └── index.html
        └── release-info.txt
```

Les anciennes releases ne sont jamais modifiees directement.

### 23.2 Packaging depuis PowerShell

```powershell
.\scripts\package-release.ps1 -SkipTests
```

`-SkipTests` est tolere tant que les tests du socle restent instables dans l'environnement Docker local. Pour une release de production mature, executer les tests applicables avant packaging et retirer ce contournement.

### 23.3 Copie vers le serveur

Serveur actuel :

```text
192.168.31.73
```

```powershell
C:\Windows\System32\OpenSSH\scp.exe `
  -i "$env:USERPROFILE\.ssh\id_ed25519_routes_oubliees" `
  .\dist\les-routes-oubliees-release.tar.gz `
  deploy@192.168.31.73:/tmp/
```

### 23.4 Deploiement serveur

```powershell
C:\Windows\System32\OpenSSH\ssh.exe `
  -i "$env:USERPROFILE\.ssh\id_ed25519_routes_oubliees" `
  deploy@192.168.31.73 `
  "sudo /usr/local/sbin/lro-deploy /tmp/les-routes-oubliees-release.tar.gz"
```

Le script serveur de reference est fourni dans :

```text
infra/deploy/lro-deploy
```

Installation indicative sur le serveur :

```bash
sudo install -o root -g root -m 0750 infra/deploy/lro-deploy /usr/local/sbin/lro-deploy
```

Le service backend de production porte le nom :

```text
les-routes-oubliees.service
```

L'exemple d'unité systemd correspondant est :

```text
infra/systemd/les-routes-oubliees.service.example
```

Le script serveur :

* verifie l'archive ;
* verifie la presence de `backend/app.jar` ;
* verifie la presence de `frontend/index.html` ;
* lit `/etc/les-routes-oubliees/application.env` ;
* cree un dump PostgreSQL ;
* extrait la nouvelle release dans un dossier horodate ;
* arrete l'application ;
* bascule le lien symbolique `current` ;
* redemarre l'application ;
* attend que le health check reponde ;
* revient a la release precedente si le demarrage echoue ;
* conserve les cinq dernieres releases ;
* supprime l'archive temporaire ;
* ne modifie jamais directement une ancienne release.
## Addendum 2026-08-05 - Cloudflare Access, Radar et Nginx

Variables de production à renseigner :

```text
CF_ACCESS_ISSUER=https://TEAM.cloudflareaccess.com
CF_ACCESS_AUDIENCE=AUD_TAG_APPLICATION_HUMAINE
CF_ACCESS_CERTS_URL=https://TEAM.cloudflareaccess.com/cdn-cgi/access/certs
RADAR_HOME_ASSISTANT_TOKEN=32_OCTETS_ALEATOIRES_EN_BASE64URL
```

Le profil `prod` et l'adresse `127.0.0.1` ne figurent volontairement pas dans ce fichier : ils sont épinglés en arguments de programme dans l'unité systemd, hors de portée d'une ligne oubliée dans le fichier d'environnement (voir §6.1).

Cloudflare Zero Trust :

* protéger tout l'hôte `lesroutesoubliees.nicolas-bourneuf.fr` avec une application humaine dont le champ `Path` est vide ;
* utiliser une politique `Allow` avec les méthodes de connexion Google et One-time PIN ;
* ne pas limiter les emails dans Cloudflare : l'autorisation administrateur reste gérée par `ADMIN_BOOTSTRAP_EMAILS` puis l'allowlist applicative ;
* créer une seconde application plus spécifique sur le chemin exact `api/integrations/home-assistant/radar/treasure-position` ;
* configurer cette application spécifique en `Bypass` / `Contourner` avec `Everyone` / `Tout le monde` ;
* ne pas créer de Service Token Cloudflare, de second tunnel, de second sous-domaine ni de joker sur l'exception.

Home Assistant doit envoyer :

```text
Authorization: Bearer <RADAR_HOME_ASSISTANT_TOKEN>
```

Nginx :

* autoriser `Permissions-Policy: geolocation=(self)` ;
* transmettre `Cf-Access-Jwt-Assertion` au backend ;
* désactiver le buffering et le cache sur `/api/radar/events` ;
* autoriser le domaine des tuiles Leaflet dans la CSP ;
* ne plus router les anciens chemins OAuth2/login Spring internes si le backend ne les expose plus.

Après modification du fichier de production, valider puis recharger :

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Le fichier versionné de référence est `infra/nginx/les-routes-oubliees.conf.example`. Le fichier de production à adapter est généralement `/etc/nginx/sites-available/les-routes-oubliees`, sauf installation différente.

Un second fichier est nécessaire : `infra/nginx/lro-rate-limit.conf.example`, à installer dans `/etc/nginx/conf.d/lro-rate-limit.conf`. Il déclare la zone `limit_req_zone` qui plafonne la publication Home Assistant. `limit_req_zone` étant une directive de contexte `http`, elle ne peut pas figurer dans le bloc `server` de `sites-available`, et son absence fait échouer `nginx -t` avec `unknown limit_req zone "lro_home_assistant"`.

### Cache des médias

`/media/` possède son propre emplacement, exempté du `Cache-Control: no-store` appliqué aux autres routes applicatives. Une URL de média désigne toujours le même octet — un UUID par fichier, jamais réécrit — et le service worker Angular refuse de conserver une réponse marquée `no-store` : sans cette exemption, la carte révélée, les avatars et l'emblème disparaissent dès que le réseau tombe.

Cet emplacement ne doit poser aucun `Cache-Control` : `add_header` ajoute sans remplacer l'en-tête amont, et le client recevrait deux directives contradictoires. La politique est décidée par `PublicMediaController`, qui renvoie `private, max-age=31536000, immutable`. Il doit en revanche répéter les quatre en-têtes de sécurité, comme tout emplacement qui en déclare au moins un.

## Addendum 2026-08-05 - Ordre de deploiement Radar definitif

L'ordre de mise en production du module Radar est le suivant :

1. creer dans Cloudflare Zero Trust une application Access humaine couvrant tout l'hote `lesroutesoubliees.nicolas-bourneuf.fr`, avec le champ `Path` vide ;
2. recuperer l'Audience Tag de cette application humaine ;
3. renseigner sur le serveur `CF_ACCESS_ISSUER`, `CF_ACCESS_AUDIENCE`, `CF_ACCESS_CERTS_URL`, `ADMIN_BOOTSTRAP_EMAILS` et `RADAR_HOME_ASSISTANT_TOKEN` ;
4. comparer le fichier Nginx actif avec `infra/nginx/les-routes-oubliees.conf.example` avant modification ;
5. valider Nginx avec `sudo nginx -t` ;
6. verifier Nginx avec `sudo systemctl is-active nginx`, puis recharger avec `sudo systemctl reload nginx` ;
7. transferer `dist/les-routes-oubliees-release.tar.gz` vers le serveur ;
8. verifier son SHA-256 localement et sur le serveur ;
9. deployer avec `/usr/local/sbin/lro-deploy` ;
10. tester que `/`, `/radar` et `/admin` sont derrière Cloudflare Access ;
11. tester les liens Angular internes vers `/radar` et `/admin` une fois l'application chargee ;
12. tester Home Assistant avec le Bearer applicatif ;
13. surveiller les logs sans afficher le secret ;
14. nettoyer l'ancien OAuth Google interne uniquement apres validation et expiration de la periode de retour arriere.

Generation du Bearer Home Assistant avec une source cryptographiquement sure :

```bash
openssl rand -base64 32
```

Test de l'endpoint sans inscrire le secret en clair dans l'historique du terminal :

```bash
read -r -s RADAR_AUTHORIZATION
curl -fsS -X POST \
  -H "Authorization: ${RADAR_AUTHORIZATION}" \
  -H "Content-Type: application/json" \
  --data '{"schemaVersion":1,"beacon":"tresor-aurelune","latitude":46.495854,"longitude":-1.775551,"accuracyM":6.414,"observedAt":"2026-08-04T21:51:57Z"}' \
  https://DOMAINE/api/integrations/home-assistant/radar/treasure-position
unset RADAR_AUTHORIZATION
```

Variables serveur Radar et Access :

```text
CF_ACCESS_ISSUER
CF_ACCESS_AUDIENCE
CF_ACCESS_CERTS_URL
ADMIN_BOOTSTRAP_EMAILS
RADAR_HOME_ASSISTANT_TOKEN
```

Ces variables s'ajoutent aux variables applicatives existantes pour PostgreSQL, le stockage des medias, l'URL publique et le fuseau horaire.

Home Assistant utilise le Bearer applicatif comme authentification effective, car l'application Access la plus spécifique contourne Cloudflare sur ce chemin exact. Exemple `secrets.yaml` :

```yaml
aurelune_position_endpoint: "https://<DOMAINE>/api/integrations/home-assistant/radar/treasure-position"
aurelune_radar_authorization: "Bearer <RADAR_HOME_ASSISTANT_TOKEN>"
```

Exemple `configuration.yaml` :

```yaml
rest_command:
  publier_position_aurelune:
    url: !secret aurelune_position_endpoint
    method: post
    headers:
      Authorization: !secret aurelune_radar_authorization
      Accept: "application/json"
    content_type: "application/json"
    verify_ssl: true
    timeout: 10
    payload: >-
      {{
        {
          "schemaVersion": 1,
          "beacon": "tresor-aurelune",
          "latitude": latitude | float,
          "longitude": longitude | float,
          "accuracyM": accuracy_m | float,
          "observedAt": observed_at | string
        } | to_json
      }}
```

L'automatisation Home Assistant doit fournir les valeurs issues de `device_tracker.tresor_d_aurelune` : `latitude`, `longitude`, `accuracy_m` et `last_seen` mappe vers `observedAt`.

Créer manuellement l'application Access d'exception Home Assistant uniquement parce que l'application humaine couvre tout l'hôte. Elle doit cibler le chemin exact `api/integrations/home-assistant/radar/treasure-position` avec la politique `Bypass` / `Contourner` et `Everyone` / `Tout le monde`. Ne pas étendre cette exception à `/api/integrations/*` ou `/api/*`.

Le fichier Nginx de production a identifier et modifier est generalement `/etc/nginx/sites-available/les-routes-oubliees`, sauf installation differente. Les differences obligatoires avec le fichier versionne sont : `Permissions-Policy` avec `geolocation=(self)`, `img-src` **et** `connect-src` autorisant `https://tile.openstreetmap.org`, transmission de `Cf-Access-Jwt-Assertion`, preservation de `Authorization`, bloc SSE sans buffering/cache, `Cache-Control: no-store` sur les API d'identite, Radar, admin et integration Home Assistant, emplacement `/media/` distinct qui laisse passer le `Cache-Control` du backend, et plafond `limit_req` sur la publication Home Assistant.

Installer aussi `infra/nginx/lro-rate-limit.conf.example` dans `/etc/nginx/conf.d/` avant de recharger : sans la zone qu'il declare, `nginx -t` echoue.

> **Addendum périmé, conservé pour l'historique.** L'exclusion totale des navigations décrite ci-dessous a été remplacée depuis : le service worker sert le shell Angular pour les navigations, **sauf** `/radar`, `/admin`, `/admin/**` et les URL de fichiers. L'exclusion totale rendait le mode hors ligne annoncé dans `PLAN_FINAL` entièrement inopérant, la coquille applicative ne se chargeant jamais. Voir `docs/ARCHITECTURE.md`, section « Navigations et service worker », et les motifs figés par `frontend/src/app/core/offline/ngsw-config.spec.ts`.

`frontend/ngsw-config.json` conserve les assets PWA et exclut de `navigationUrls` les navigations qui doivent atteindre Cloudflare Access : **`/radar`, `/admin`, `/admin/**` et `/cdn-cgi/**`**, en plus des requêtes de fichiers. Cette exclusion réduit le comportement hors ligne de ces routes ; elle est volontaire pour éviter une page servie depuis le cache après expiration ou déconnexion Access.

**Les autres navigations — l'accueil, `/carnet`, la carte — restent servies depuis le cache**, ce qui est le comportement hors ligne recherché. Conséquence à connaître : sur ces pages, une navigation ne quitte pas le navigateur, donc Cloudflare ne peut y redemander aucune authentification. Les trajets d'authentification portent pour cette raison le marqueur `ngsw-bypass`, qui les fait traverser le service worker (`CloudflareAccessSessionService`) ; il est retiré de l'adresse dès la page servie. Sans lui, la reconnexion n'aboutissait que depuis `/radar` et `/admin`.

Un shell statique deja present dans un cache navigateur ou un ancien service worker peut rester affichable localement jusqu'a son eviction. Cloudflare Access ne peut pas intercepter une reponse servie entierement depuis le cache local ; les API Radar, admin, portail et integration restent donc exclues du cache et revalidees par le reseau.

Les variables `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` ne sont plus utilisees par l'application : l'authentification humaine repose entierement sur Cloudflare Access. Leur suppression du fichier d'environnement du serveur et la suppression du client OAuth correspondant dans Google Cloud Console sont des operations manuelles restantes.

Vérifications manuelles Cloudflare après déploiement :

1. Sans session Access, `GET /` déclenche l'authentification Cloudflare.
2. Sans session Access, l'accès direct à `/radar` et `/admin` déclenche aussi Cloudflare.
3. Une fois l'application chargée, les liens Angular vers `/radar` et `/admin` fonctionnent sans rechargement complet.
4. Sans session Access, un `POST` sur `/api/integrations/home-assistant/radar/treasure-position` sans Bearer atteint le backend et répond `401`, sans redirection Cloudflare.
5. Le même endpoint avec un Bearer valide répond `204` pour une mesure strictement plus récente, et `200` avec `{"status":"ignored"}` pour une mesure non plus récente.
6. Un corps supérieur à 4096 octets sur ce même chemin répond `413`.
7. Un chemin voisin, par exemple `/api/integrations/home-assistant/radar`, reste intercepté par Cloudflare Access.
8. Aucune autre route `/api/integrations/**` n'est ouverte.
9. Toute route `/api/**` humaine et `/media/**` atteinte sans JWT Cloudflare valide répond `401` avec l'en-tête `X-LRO-Auth-Error: application`.
10. Une session Access expirée pendant l'utilisation de la SPA provoque une reconnexion compréhensible, sans boucle : un seul rechargement, puis une action « Se reconnecter » stable. Ce bouton ne recharge pas la page — le bandeau ne s'affiche qu'après un rechargement déjà resté sans effet, le refaire referait ce qui vient d'échouer. Il appelle `/cdn-cgi/access/logout` en arrière-plan, le temps que Cloudflare retire son cookie, puis renvoie sur l'adresse consultée, qui repart alors sans session et déclenche l'authentification. **À vérifier depuis l'accueil ou `/carnet`, pas seulement depuis `/radar` :** ces pages sont servies depuis le cache du service worker, et c'est précisément là que la reconnexion échouait avant le marqueur `ngsw-bypass`. Vérifier aussi que le retour se fait sur la page d'origine et non sur la page de déconnexion. Le repli sur cette page visible est normal si l'appel échoue ; il signale que l'appel de fond n'aboutit pas. Cloudflare ne documente aucun paramètre de retour sur cet endpoint, d'où le trajet en deux temps.
11. Après navigation vers `https://lesroutesoubliees.nicolas-bourneuf.fr/cdn-cgi/access/logout`, une nouvelle navigation vers le site redemande une authentification.
12. Aucune donnée Radar, administrative ou Home Assistant n'est récupérée depuis un cache après expiration ou déconnexion.
13. En quittant `/radar` par une navigation Angular normale, le repère disparaît immédiatement chez les autres participants ; après une interruption brutale, il disparaît au plus tard au terme du TTL serveur d'environ 45 secondes suivi du balayage périodique.
