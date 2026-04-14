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

## Ressources statiques

<!-- There are several ways to get the static assets necessary to host the Playground. -->

Il existe plusieurs façons d'obtenir les ressources statiques nécessaires pour héberger le Playground.

<!-- In order of convenience and ease: -->

Par ordre de commodité et de facilité :

<!-- - Download pre-built package -->
<!-- - Fork the repository and build with GitHub Action -->
<!-- - Build locally -->

- Télécharger le package pré-construit
- Forker le dépôt et construire avec GitHub Action
- Construire localement

<!-- ### Download pre-built package -->

### Télécharger le package pré-construit

<!-- To host the Playground as is, without making changes, you can download the built artifact from [the latest successful GitHub Action](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml?query=is%3Asuccess). -->

Pour héberger le Playground tel quel, sans modification, vous pouvez télécharger l'artefact construit depuis [la dernière GitHub Action réussie](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml?query=is%3Asuccess).

<!-- - Click on **Deploy Playground website**. -->
<!-- - In the section **Artifacts** at the bottom of the page, click `playground-website`. -->
<!-- - It's a zip package with the same files deployed to the public site. -->

- Cliquez sur **Deploy Playground website**.
- Dans la section **Artifacts** en bas de la page, cliquez sur `playground-website`.
- C'est un package zip avec les mêmes fichiers déployés sur le site public.

<!-- ### Fork the repository and build with GitHub Action -->

### Forker le dépôt et construire avec GitHub Action

<!-- To customize the Playground, you can [fork the Git repository](https://github.com/WordPress/wordpress-playground/fork). -->

Pour personnaliser le Playground, vous pouvez [forker le dépôt Git](https://github.com/WordPress/wordpress-playground/fork).

<!-- Build it from the fork's GitHub page by going to: **Actions -> Deploy Playground website -> Run workflow**. -->

Construisez-le depuis la page GitHub de votre fork en allant à : **Actions -> Deploy Playground website -> Run workflow**.

<!-- ### Build locally -->

### Construire localement

<!-- The most flexible and customizable method is to build the site locally. -->

La méthode la plus flexible et personnalisable est de construire le site localement.

<!-- Create a shallow clone of the Playground repository, or your own fork. -->

Créez un clone superficiel du dépôt Playground, ou de votre propre fork.

```sh
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
```

<!-- Enter the `wordpress-playground` directory. -->

Entrez dans le répertoire `wordpress-playground`.

```sh
cd wordpress-playground
```

<!-- Install dependencies, and build the website. -->

Installez les dépendances et construisez le site web.

```sh
npm install
npm run build:website
```

<!-- This command internally runs the `nx` task `build:wasm-wordpress-net`. It copies the built assets from packages `remote` and `website` into a new folder at the following path: -->

Cette commande exécute en interne la tâche `nx` `build:wasm-wordpress-net`. Elle copie les ressources construites des packages `remote` et `website` dans un nouveau dossier au chemin suivant :

```
dist/packages/playground/wasm-wordpress-net
```

<!-- The entire service of the Playground consists of the content of this folder. -->

L'ensemble du service du Playground consiste en le contenu de ce dossier.

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

:::info Consultez le fichier source
L'exemple peut être obsolète. Veuillez vérifier [le fichier source](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) pour la dernière version.
:::

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
