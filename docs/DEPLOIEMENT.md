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
* transmet `/media/` selon la stratégie retenue ;
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

Les réponses admin et API sensibles ne doivent pas être mises en cache par un proxy partagé. Les médias publics peuvent avoir une politique de cache séparée lorsqu’ils sont publiés.

Pour la PWA :

* HTTPS est obligatoire en production ;
* les fichiers du service worker Angular doivent être servis depuis la racine du frontend ;
* les routes admin, Radar, portail, intégration et écriture ne doivent pas être servies depuis un cache applicatif hors ligne ;
* après déploiement, vérifier l'installation PWA, le chargement hors ligne des pages publiques et la mise à jour du snapshot public après modification d'un contenu publié.

Routage indicatif :

```text
/                 -> Angular
/api/             -> Spring Boot
/api/portal/      -> Spring Boot
/api/radar/       -> Spring Boot
/radar, /admin    -> Cloudflare Access puis frontend
/media/           -> Spring Boot ou répertoire contrôlé
/actuator/health  -> accès local uniquement
```

## 8. Domaine et Cloudflare Access

Configurer Cloudflare Access pour les routes humaines protegees et recuperer l'Audience Tag de l'application.

Ne pas proteger tout le domaine : les pages publiques et l'endpoint Home Assistant doivent rester joignables sans session Access.

Configurer correctement la gestion des en-têtes transférés afin que Spring reconstruise l'URL publique HTTPS derrière le proxy.

Tester obligatoirement :

* connexion ;
* retour Cloudflare Access ;
* validation du JWT `Cf-Access-Jwt-Assertion` ;
* deconnexion via `/cdn-cgi/access/logout` ;
* refus d’un email non autorisé ;
* expiration de session.

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

Variables minimales :

```text
SPRING_PROFILES_ACTIVE=prod

DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/routes_oubliees
DATABASE_USERNAME=routes_oubliees
DATABASE_PASSWORD=CHANGE_ME

CF_ACCESS_ISSUER=https://TEAM.cloudflareaccess.com
CF_ACCESS_AUDIENCE=CHANGE_ME
CF_ACCESS_CERTS_URL=https://TEAM.cloudflareaccess.com/cdn-cgi/access/certs
RADAR_HOME_ASSISTANT_TOKEN=CHANGE_ME_RANDOM_256_BITS_MINIMUM
ADMIN_BOOTSTRAP_EMAILS=admin@example.invalid

MEDIA_STORAGE_PATH=/var/lib/les-routes-oubliees/media
SITE_PUBLIC_URL=https://example.invalid
SITE_TIMEZONE=Europe/Paris
```

Le fichier `.env.example` du dépôt contient uniquement des valeurs factices.

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
RADAR_HOME_ASSISTANT_TOKEN=SECRET_ALEATOIRE_256_BITS_MINIMUM
```

Cloudflare Zero Trust :

* protéger `/radar`, `/radar/*`, `/admin`, `/admin/*`, `/api/portal/*`, `/api/radar/*` et `/api/admin/*` avec une politique humaine limitée aux emails autorisés ;
* activer Google et le code email à usage unique si souhaité ;
* ne pas créer de règle qui autorise toute adresse email ;
* ne pas creer d'application Access Home Assistant ;
* si une application Access globale existe deja, creer uniquement une exception `Bypass` sur `/api/integrations/home-assistant/radar/treasure-position`.

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

## Addendum 2026-08-05 - Ordre de deploiement Radar definitif

L'ordre de mise en production du module Radar est le suivant :

1. creer dans Cloudflare Zero Trust une application Access humaine couvrant uniquement `/radar`, `/radar/*`, `/admin`, `/admin/*`, `/api/portal/*`, `/api/radar/*` et `/api/admin/*` ;
2. recuperer l'Audience Tag de cette application humaine ;
3. renseigner sur le serveur `CF_ACCESS_ISSUER`, `CF_ACCESS_AUDIENCE`, `CF_ACCESS_CERTS_URL`, `ADMIN_BOOTSTRAP_EMAILS` et `RADAR_HOME_ASSISTANT_TOKEN` ;
4. comparer le fichier Nginx actif avec `infra/nginx/les-routes-oubliees.conf.example` avant modification ;
5. valider Nginx avec `sudo nginx -t` ;
6. verifier Nginx avec `sudo systemctl is-active nginx`, puis recharger avec `sudo systemctl reload nginx` ;
7. transferer `dist/les-routes-oubliees-release.tar.gz` vers le serveur ;
8. verifier son SHA-256 localement et sur le serveur ;
9. deployer avec `/usr/local/sbin/lro-deploy` ;
10. tester les pages publiques ;
11. tester `/radar` et `/admin` derriere Cloudflare Access ;
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
  -H "Authorization: Bearer ${RADAR_AUTHORIZATION}" \
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

Home Assistant utilise un Bearer applicatif, pas un Bearer applicatif. Exemple `secrets.yaml` :

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

Ne pas creer d'application Access Home Assistant. Si une application Access globale couvre deja tout le domaine, creer uniquement une exception plus specifique sur `/api/integrations/home-assistant/radar/treasure-position` avec une politique `Bypass`. Ne pas etendre cette exception a `/api/integrations/*` ou `/api/*`.

Le fichier Nginx de production a identifier et modifier est generalement `/etc/nginx/sites-available/les-routes-oubliees`, sauf installation differente. Les differences obligatoires avec le fichier versionne sont : `Permissions-Policy` avec `geolocation=(self)`, `img-src` autorisant `https://tile.openstreetmap.org`, transmission de `Cf-Access-Jwt-Assertion`, preservation de `Authorization`, bloc SSE sans buffering/cache et `Cache-Control: no-store` sur les API d'identite, Radar, admin et integration Home Assistant.

Les variables `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` peuvent rester temporairement sur le serveur pendant la periode de retour arriere, mais elles ne sont plus utilisees par l'application. Leur suppression serveur et la suppression du client OAuth correspondant dans Google Cloud Console sont des operations manuelles a realiser seulement apres validation de la nouvelle authentification.
