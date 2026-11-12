---
slug: /developers/architecture/host-your-own-playground
---

<!-- # Host your own Playground -->

# Hébergez votre propre Playground

<!-- You can host the Playground on your own domain instead of `playground.wordpress.net`. -->

Vous pouvez héberger le Playground sur votre propre domaine au lieu de `playground.wordpress.net`.

<!-- This is useful for having full control over its content and behavior, as well as removing dependency on a third-party server. It can provide a more customized user experience, for example: a playground with preinstalled plugins and themes, default site settings, or demo content. -->

C'est utile pour avoir un contrôle total sur son contenu et son comportement, ainsi que pour supprimer la dépendance à un serveur tiers. Cela peut fournir une expérience utilisateur plus personnalisée, par exemple : un playground avec des plugins et thèmes préinstallés, des paramètres de site par défaut ou du contenu de démonstration.

<!-- ## Before you start -->

## Avant de commencer

<!-- Self-hosting Playground gives you full control, but requires understanding a few key concepts: -->

L'auto-hébergement de Playground vous donne un contrôle total, mais nécessite de comprendre quelques concepts clés :

<!-- ### What to expect -->

### À quoi s'attendre

<!-- - **Initial setup complexity**: Building and deploying Playground involves multiple steps. Allow time for troubleshooting during your first deployment. -->
<!-- - **Static file hosting**: Playground is primarily static files (HTML, JS, WASM) with minimal server-side requirements. -->
<!-- - **Browser-based execution**: All WordPress processing happens in the user's browser via WebAssembly—your server only delivers files. -->

- **Complexité de configuration initiale** : La construction et le déploiement de Playground impliquent plusieurs étapes. Prévoyez du temps pour le dépannage lors de votre premier déploiement.
- **Hébergement de fichiers statiques** : Playground est principalement composé de fichiers statiques (HTML, JS, WASM) avec des exigences minimales côté serveur.
- **Exécution basée sur le navigateur** : Tout le traitement WordPress se fait dans le navigateur de l'utilisateur via WebAssembly—votre serveur ne fait que livrer les fichiers.

<!-- ### Performance considerations -->

### Considérations de performance

<!-- Loading times depend on several factors: -->

Les temps de chargement dépendent de plusieurs facteurs :

<!-- | Factor            | Impact                                                              | Optimization                                | -->
<!-- | ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | -->
<!-- | **Plugin size**   | Large plugins (e.g., WooCommerce) can take 30-60 seconds to install | Pre-install plugins in your WordPress build | -->
<!-- | **Network speed** | WASM files are ~15-30MB                                             | Use CDN with proper caching headers         | -->
<!-- | **Browser**       | Chrome/Edge perform best; Safari uses fallback mechanisms           | Test across browsers                        | -->
<!-- | **Device**        | Mobile devices load slower than desktop                             | Warn mobile users about longer load times   | -->

| Facteur               | Impact                                                                           | Optimisation                                                           |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Taille du plugin**  | Les gros plugins (ex. WooCommerce) peuvent prendre 30-60 sec à installer         | Préinstallez les plugins dans votre build WordPress                    |
| **Vitesse du réseau** | Les fichiers WASM font ~15-30 Mo                                                 | Utilisez un CDN avec des en-têtes de cache appropriés                  |
| **Navigateur**        | Chrome/Edge sont les plus performants ; Safari utilise des mécanismes de secours | Testez sur différents navigateurs                                      |
| **Appareil**          | Les appareils mobiles chargent plus lentement que les ordinateurs                | Avertissez les utilisateurs mobiles des temps de chargement plus longs |

<!-- ### Browser compatibility -->

### Compatibilité des navigateurs

<!-- Playground works across modern browsers, but with some differences: -->

Playground fonctionne sur les navigateurs modernes, mais avec quelques différences :

<!-- | Browser         | Status              | Notes                                                                              | -->
<!-- | --------------- | ------------------- | ---------------------------------------------------------------------------------- | -->
<!-- | Chrome/Edge     | ✅ Best performance | Full support for all features                                                      | -->
<!-- | Firefox         | ✅ Good             | Reliable performance                                                               | -->
<!-- | Safari          | ✅ Good             | Recent improvements significantly enhanced reliability                             | -->
<!-- | Mobile browsers | ⚠️ Limited          | Works, but with higher memory usage, and a 4G connection can impact the experience | -->

| Navigateur          | Statut                   | Notes                                                                                                     |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Chrome/Edge         | ✅ Meilleure performance | Support complet de toutes les fonctionnalités                                                             |
| Firefox             | ✅ Bon                   | Performance fiable                                                                                        |
| Safari              | ✅ Bon                   | Des améliorations récentes ont significativement amélioré la fiabilité                                    |
| Navigateurs mobiles | ⚠️ Limité                | Fonctionne, mais avec une utilisation mémoire plus élevée, et une connexion 4G peut impacter l'expérience |

<!-- **Technical note**: Safari uses MessagePorts instead of SharedArrayBuffer for streaming responses. This fallback works reliably but adds slight overhead compared to Chrome/Edge. -->

**Note technique** : Safari utilise MessagePorts au lieu de SharedArrayBuffer pour les réponses en streaming. Ce mécanisme de secours fonctionne de manière fiable mais ajoute une légère surcharge par rapport à Chrome/Edge.

<!-- ## Usage -->

## Utilisation

<!-- A self-hosted Playground can be embedded as an iframe. -->

Un Playground auto-hébergé peut être intégré comme une iframe.

```html
<iframe src="https://my-playground.com"></iframe>
```

<!-- Or dynamically loaded by passing the remote URL to the [Playground Client](/developers/apis/javascript-api/playground-api-client). -->

Ou chargé dynamiquement en passant l'URL distante au [Client Playground](/developers/apis/javascript-api/playground-api-client).

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://my-playground.com/remote.html`,
});
```

<!-- ## Static assets -->

## Ressources statiques {#static-assets}

<!-- Build the browser website from source to host it on your own domain. This does
not require a GitHub Actions artifact. The `@wp-playground/client` npm package
connects your app to an already hosted browser runtime. The
`@wp-playground/cli` npm package runs WordPress locally with Node.js. Neither
installs the browser website and its Dock. -->

Compilez le site web de Playground à partir du code source pour l’héberger sur votre propre domaine. Aucun artefact GitHub Actions n’est nécessaire. Le paquet npm `@wp-playground/client` connecte votre application à un environnement d’exécution dans le navigateur déjà hébergé. Le paquet npm `@wp-playground/cli` exécute WordPress localement avec Node.js. Aucun des deux n’installe le site web de Playground et son Dock.

<!-- The [Deploy Playground website workflow](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml)
produces a temporary artifact for the public deployment. It expires, and the
build is configured to render WordPress on `wpsandbox.wordpress.net`. Use the
source build below for another domain, even if the artifact is still available.
Running the deploy workflow in a fork without the deployment secrets skips
the build, too. -->

Le [workflow Deploy Playground website](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml) produit un artefact temporaire pour le déploiement public. Il expire, et la compilation est configurée pour afficher WordPress sur `wpsandbox.wordpress.net`. Pour un autre domaine, compilez à partir du code source en suivant les instructions ci-dessous, même si l’artefact est encore disponible. L’exécution du workflow de déploiement dans un fork sans les secrets de déploiement entraîne également l’omission de la compilation.

<!-- ### Build locally -->

### Compiler localement {#build-locally}

<!-- Create a shallow clone of the Playground repository or your own fork. The
command below uses the latest development source on `trunk`. To pin the
Playground source to a specific version, replace `trunk` with a tag from the
[releases page](https://github.com/WordPress/wordpress-playground/releases).
The tag does not make the build reproducible: the build downloads
`wp-cli.phar` from the `wp-cli/builds` repository's `gh-pages` branch, which
can change between builds. -->

Créez un clone superficiel du dépôt Playground ou de votre propre fork. La commande ci-dessous utilise le code de développement le plus récent de `trunk`. Pour fixer le code source de Playground à une version précise, remplacez `trunk` par un tag de la [page des versions](https://github.com/WordPress/wordpress-playground/releases). Le tag ne rend pas la compilation reproductible : la compilation télécharge `wp-cli.phar` depuis la branche `gh-pages` du dépôt `wp-cli/builds`, qui peut changer entre deux compilations.

```sh
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
```

<!-- Enter the `wordpress-playground` directory. -->

Placez-vous dans le répertoire `wordpress-playground`.

```sh
cd wordpress-playground
```

<!-- Use the Node.js version in `.nvmrc`. The commands below require
[nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to be installed.
`nvm install` installs and activates the required Node.js version. If you use
another version manager, install and activate the version in `.nvmrc` with it
instead. Then install the locked dependencies: -->

Utilisez la version de Node.js indiquée dans `.nvmrc`. Les commandes ci-dessous nécessitent l’installation de [nvm](https://github.com/nvm-sh/nvm#installing-and-updating). `nvm install` installe et active la version requise de Node.js. Si vous utilisez un autre gestionnaire de versions, utilisez-le pour installer et activer la version indiquée dans `.nvmrc`. Installez ensuite les dépendances aux versions fixées dans le fichier de verrouillage :

```sh
nvm install
npm ci
```

<!-- Before building, leave `PLAYGROUND_APP_ORIGIN` and `VITE_WORDPRESS_SITE_URL` unset to serve
the Playground app and its WordPress pages from the same origin. For a public
instance that runs untrusted plugins or Blueprints, use a separate WordPress
origin to reduce exposure. This does not fully protect saved files or native
directory handles. See the [split-origin deployment guide](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website-deployment/wordpress-frame/README.md). -->

Avant de compiler, laissez `PLAYGROUND_APP_ORIGIN` et `VITE_WORDPRESS_SITE_URL` non définies pour servir l’application Playground et ses pages WordPress depuis la même origine. Pour une instance publique qui exécute des extensions ou des Blueprints non fiables, utilisez une origine distincte pour WordPress afin de réduire l’exposition. Cela ne protège pas complètement les fichiers enregistrés ni les identifiants d’accès aux répertoires natifs. Consultez le [guide de déploiement avec des origines distinctes](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website-deployment/wordpress-frame/README.md).

<!-- For a same-origin build, run the following in a POSIX-compatible shell, such
as Bash or Zsh: -->

Pour compiler avec une origine unique, exécutez les commandes suivantes dans un shell compatible POSIX, comme Bash ou Zsh :

```sh
unset PLAYGROUND_APP_ORIGIN VITE_WORDPRESS_SITE_URL
npm run build:website
```

<!-- This command internally runs the `nx` task `build:wasm-wordpress-net`. It copies the built assets from packages `remote` and `website` into a new folder at the following path: -->

Cette commande exécute en interne la tâche `nx` `build:wasm-wordpress-net`. Elle copie les ressources compilées des paquets `remote` et `website` dans un nouveau dossier au chemin suivant :

```
dist/packages/playground/wasm-wordpress-net
```

<!-- Serve the contents of this folder as your site root. -->

Servez le contenu de ce dossier à la racine de votre site.

<!-- This builds the files you serve. It does not make every Playground feature
independent of external services. For example, production builds use the
project's CORS proxy for requests that the browser cannot make directly,
unless you set `CORS_PROXY_URL` at build time. -->

Ce processus compile les fichiers que vous allez servir. Il ne rend pas toutes les fonctionnalités de Playground indépendantes des services externes. Par exemple, les compilations de production utilisent le proxy CORS du projet pour les requêtes que le navigateur ne peut pas effectuer directement, sauf si vous définissez `CORS_PROXY_URL` au moment de la compilation.

<!-- ### Verify the local build -->

### Vérifier la compilation locale {#verify-the-local-build}

<!-- With Python 3 installed, run this command from the `wordpress-playground`
directory to serve the built files locally: -->

Avec Python 3 installé, exécutez cette commande depuis le répertoire `wordpress-playground` pour servir les fichiers compilés localement :

```sh
python3 -m http.server 8768 --bind 127.0.0.1 \
  --directory dist/packages/playground/wasm-wordpress-net
```

<!-- Open [http://127.0.0.1:8768/](http://127.0.0.1:8768/) in your browser. Confirm that: -->

Ouvrez [http://127.0.0.1:8768/](http://127.0.0.1:8768/) dans votre navigateur. Vérifiez les points suivants :

<!-- 1. The WordPress welcome page and Playground Dock appear.
2. Entering `/wp-admin/` in the Dock's address field opens the WordPress Dashboard.
3. The WordPress iframe URL, inspected with your browser's developer tools,
   starts with `http://127.0.0.1:8768/scope:`. The app and WordPress should use
   the same scheme, hostname, and port, rather than `wpsandbox.wordpress.net`. -->

1. La page de bienvenue de WordPress et le Dock de Playground s’affichent.
2. Saisir `/wp-admin/` dans le champ d’adresse du Dock ouvre le tableau de bord de WordPress.
3. L’URL de l’iframe WordPress, inspectée avec les outils de développement du navigateur, commence par `http://127.0.0.1:8768/scope:`. L’application et WordPress doivent utiliser le même protocole, le même nom d’hôte et le même port, plutôt que `wpsandbox.wordpress.net`.

<!-- Stop the server with `Ctrl+C`. This server is for local verification only.
Use HTTPS when deploying to a public domain; service workers can run over
HTTP on loopback addresses such as `127.0.0.1`. -->

Arrêtez le serveur avec `Ctrl+C`. Ce serveur sert uniquement à la vérification locale. Utilisez HTTPS pour un déploiement sur un domaine public ; les service workers peuvent fonctionner en HTTP sur des adresses de boucle locale comme `127.0.0.1`.

<!-- When reporting a test result, include the output of `git rev-parse HEAD`,
`node --version`, and `npm --version`, along with the browser version and
the command used to serve the files. -->

Lorsque vous communiquez le résultat d’un test, indiquez la sortie de `git rev-parse HEAD`, `node --version` et `npm --version`, ainsi que la version du navigateur et la commande utilisée pour servir les fichiers.

<!-- ## Summary of included files -->

## Résumé des fichiers inclus

<!-- The static assets include: -->

Les ressources statiques incluent :

<!-- - Data and WASM files for all available PHP and WordPress versions -->
<!-- - `remote.html` - the core of Playground -->
<!-- - `index.html` - the shell, or browser chrome -->
<!-- - Web Worker script -->

- Fichiers de données et WASM pour toutes les versions PHP et WordPress disponibles
- `remote.html` - le cœur du Playground
- `index.html` - le shell, ou chrome du navigateur
- Script Web Worker

<!-- You can deploy the content of the folder to your server using SSH, such as `scp` or `rsync`. -->

Vous pouvez déployer le contenu du dossier sur votre serveur en utilisant SSH, comme `scp` ou `rsync`.

<!-- It is a static site, except for these dynamic aspects. -->

C'est un site statique, sauf pour ces aspects dynamiques.

<!-- - Apache server directive `.htaccess` file from the package `remote` -->

- Fichier de directive serveur Apache `.htaccess` du package `remote`

<!-- For these to work, you need a server environment with Apache and PHP installed. -->

Pour que ceux-ci fonctionnent, vous avez besoin d'un environnement serveur avec Apache et PHP installés.

<!-- ## NGINX configuration -->

## Configuration NGINX

<!-- As an alternative to Apache, here is an example of using NGINX to serve the Playground. -->

Comme alternative à Apache, voici un exemple d'utilisation de NGINX pour servir le Playground.

<!-- :::info Refer to the source file -->
<!-- The example may be outdated. Please check [the source file](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) for the latest version. -->
<!-- ::: -->

<div class="callout callout-info">

**Consultez le fichier source**

L'exemple peut être obsolète. Veuillez vérifier [le fichier source](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) pour la dernière version.

</div>

<!-- The combined Apache `.htaccess` file looks like this. -->

Le fichier Apache `.htaccess` combiné ressemble à ceci.

```htaccess
AddType application/wasm .wasm
```

<!-- An equivalent in NGINX. -->

Un équivalent en NGINX.

```nginx
location ~* .wasm$ {
  types {
    application/wasm wasm;
  }
}
```

<!-- You may need to adjust the above according to server specifics, particularly how to invoke PHP for the path `/plugin-proxy`. -->

Vous devrez peut-être ajuster ce qui précède selon les spécificités du serveur, en particulier comment invoquer PHP pour le chemin `/plugin-proxy`.

<!-- [Caddy web server](https://caddyserver.com) doesn't require any special config to work. -->

[Le serveur web Caddy](https://caddyserver.com) ne nécessite aucune configuration spéciale pour fonctionner.

<!-- ## Customize bundled data -->

## Personnaliser les données empaquetées

<!-- The file `wp.zip` is a bundle of all the files for the virtual file system in Playground. There's a data file for each available WordPress version. -->

Le fichier `wp.zip` est un ensemble de tous les fichiers pour le système de fichiers virtuel dans Playground. Il y a un fichier de données pour chaque version WordPress disponible.

<!-- The package at `packages/playground/wordpress-builds` is responsible for building these data files. -->

Le package à `packages/playground/wordpress-builds` est responsable de la construction de ces fichiers de données.

<!-- Edit the build script in `Dockerfile` to create a custom bundle that includes preinstalled plugins or content. -->

Modifiez le script de construction dans `Dockerfile` pour créer un ensemble personnalisé qui inclut des plugins préinstallés ou du contenu.

<!-- To rebuild the WordPress builds after customizing the `Dockerfile`, run the following command: -->

Pour reconstruire les builds WordPress après avoir personnalisé le `Dockerfile`, exécutez la commande suivante :

```
npm run rebuild:wordpress-builds
```

<!-- To rebuild the website to include the custom WordPress builds, follow the instructions [here](#build-locally). -->

Pour reconstruire le site web afin d'inclure les builds WordPress personnalisés, suivez les instructions [ici](#build-locally).

<!-- ### Install plugins -->

### Installer des plugins

<!-- Here's an example of installing plugins for the data bundle. -->

Voici un exemple d'installation de plugins pour l'ensemble de données.

<!-- Before the section titled `Strip whitespaces from PHP files`. -->

Avant la section intitulée `Strip whitespaces from PHP files`.

```docker
# === Preinstall plugins ===

RUN cd wordpress/wp-content/mu-plugins && \
    # Install plugins
    for plugin_name in example-plugin-1 example-plugin-2; do \
      curl -L https://downloads.wordpress.org/plugin/{$plugin_name}.latest-stable.zip -o {$plugin_name}.zip && \
      unzip $plugin_file && \
      rm $plugin_file && \
      # Create entry file in mu-plugins root
      echo "<?php require_once __DIR__.'/$plugin_name/$plugin_name.php';" > $plugin_name.php; \
    done;
```

<!-- You can download plugins from URLs other than the WordPress plugin directory, or use Git to pull them from elsewhere. -->

Vous pouvez télécharger des plugins depuis des URLs autres que le répertoire de plugins WordPress, ou utiliser Git pour les récupérer ailleurs.

<!-- It's also possible to copy from a local folder. For example, before `RUN`: -->

Il est également possible de copier depuis un dossier local. Par exemple, avant `RUN` :

```
COPY ./build-assets/*.zip /root/
```

<!-- Then put the plugin zip files in `build-assets`. In this case, you may want to add their paths to `.gitignore`. -->

Ensuite, placez les fichiers zip des plugins dans `build-assets`. Dans ce cas, vous voudrez peut-être ajouter leurs chemins à `.gitignore`.

<!-- ### Import content -->

### Importer du contenu

<!-- Here's an example of importing content. -->

Voici un exemple d'importation de contenu.

```docker
# === Demo content ===

COPY ./build-assets/content.xml /root/
RUN cd wordpress ; \
     echo "Importing content.."; \
    ../wp-cli.phar --allow-root import /root/content.xml --authors=create
```

<!-- This assumes that you have put a WXR export file named `content.xml` in the folder `build-assets`. You can add its path to `.gitignore`. -->

Cela suppose que vous avez mis un fichier d'export WXR nommé `content.xml` dans le dossier `build-assets`. Vous pouvez ajouter son chemin à `.gitignore`.

<!-- ## Production deployment checklist -->

## Liste de vérification pour le déploiement en production

<!-- Before going live, verify your self-hosted Playground meets these requirements: -->

Avant la mise en production, vérifiez que votre Playground auto-hébergé répond à ces exigences :

<!-- ### Server configuration -->

### Configuration du serveur

<!-- - [ ] **MIME types**: Ensure `.wasm` files are served with `application/wasm` content type -->
<!-- - [ ] **CORS headers**: If embedding cross-origin, configure appropriate CORS headers -->
<!-- - [ ] **Caching**: Set long cache times for WASM and static assets (they're versioned) -->
<!-- - [ ] **Compression**: Enable gzip/brotli for faster file transfers -->
<!-- - [ ] **HTTPS**: Required for service workers and some browser features -->

- [ ] **Types MIME** : Assurez-vous que les fichiers `.wasm` sont servis avec le type de contenu `application/wasm`
- [ ] **En-têtes CORS** : Si vous intégrez en cross-origin, configurez les en-têtes CORS appropriés
- [ ] **Cache** : Définissez des temps de cache longs pour WASM et les ressources statiques (ils sont versionnés)
- [ ] **Compression** : Activez gzip/brotli pour des transferts de fichiers plus rapides
- [ ] **HTTPS** : Requis pour les service workers et certaines fonctionnalités du navigateur

<!-- ### Performance optimization -->

### Optimisation des performances

<!-- - [ ] **CDN**: Serve static assets from a CDN for faster global delivery -->
<!-- - [ ] **Pre-installed plugins**: Bundle frequently-used plugins in your WordPress build -->
<!-- - [ ] **Minimal blueprints**: Keep runtime plugin installations to a minimum -->

- [ ] **CDN** : Servez les ressources statiques depuis un CDN pour une livraison mondiale plus rapide
- [ ] **Plugins préinstallés** : Empaquetez les plugins fréquemment utilisés dans votre build WordPress
- [ ] **Blueprints minimaux** : Gardez les installations de plugins à l'exécution au minimum

<!-- ## Troubleshooting -->

## Dépannage

<!-- ### Common issues and solutions -->

### Problèmes courants et solutions

<!-- #### Playground fails to load or shows blank screen -->

#### Playground ne charge pas ou affiche un écran blanc

<!-- **Possible causes:** -->

**Causes possibles :**

<!-- - Server doesn't serve WASM files with correct MIME type -->
<!-- - Deployment missing required files -->
<!-- - JavaScript errors in browser console -->

- Le serveur ne sert pas les fichiers WASM avec le bon type MIME
- Le déploiement manque des fichiers requis
- Erreurs JavaScript dans la console du navigateur

<!-- **Solutions:** -->

**Solutions :**

<!-- 1. Check browser console for errors (F12 → Console tab) -->
<!-- 2. Verify `.wasm` files return `application/wasm` content type -->
<!-- 3. Verify you deployed all build files -->

1. Vérifiez la console du navigateur pour les erreurs (F12 → onglet Console)
2. Vérifiez que les fichiers `.wasm` retournent le type de contenu `application/wasm`
3. Vérifiez que vous avez déployé tous les fichiers de construction

<!-- #### Slow initial loading (30+ seconds) -->

#### Chargement initial lent (30+ secondes)

<!-- **Possible causes:** -->

**Causes possibles :**

<!-- - Installing large plugins at runtime -->
<!-- - Missing CDN or caching configuration -->
<!-- - User on slow network connection -->

- Installation de gros plugins à l'exécution
- Configuration CDN ou cache manquante
- Utilisateur sur une connexion réseau lente

<!-- **Solutions:** -->

**Solutions :**

<!-- 1. Pre-install plugins in your WordPress build instead of runtime installation -->
<!-- 2. Configure CDN with proper caching headers -->
<!-- 3. Show loading indicators to set user expectations -->

1. Préinstallez les plugins dans votre build WordPress au lieu de l'installation à l'exécution
2. Configurez le CDN avec des en-têtes de cache appropriés
3. Affichez des indicateurs de chargement pour définir les attentes des utilisateurs
