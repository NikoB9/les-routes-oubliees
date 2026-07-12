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
* transmet les routes OAuth2 nécessaires ;
* transmet `/media/` selon la stratégie retenue ;
* ajoute ou préserve les en-têtes de proxy ;
* limite la taille des uploads ;
* interdit le listing de répertoires ;
* applique des en-têtes de sécurité.

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

Routage indicatif :

```text
/                 -> Angular
/api/             -> Spring Boot
/oauth2/          -> Spring Boot
/login/           -> Spring Boot
/media/           -> Spring Boot ou répertoire contrôlé
/actuator/health  -> accès local uniquement
```

## 8. Domaine et Google OIDC

Configurer dans Google l’URI de redirection exacte de production.

Format Spring Security habituel :

```text
https://DOMAINE/login/oauth2/code/google
```

Ne pas utiliser une URI HTTP en production.

Configurer correctement la gestion des en-têtes transférés afin que Spring reconstruise l’URL publique HTTPS derrière le proxy.

Tester obligatoirement :

* connexion ;
* retour Google ;
* création de session ;
* logout ;
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

GOOGLE_CLIENT_ID=CHANGE_ME
GOOGLE_CLIENT_SECRET=CHANGE_ME
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
* connexion Google ;
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
