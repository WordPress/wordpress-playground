---
title: Compiler PHP
slug: /developers/architecture/wasm-php-compiling
---

<!--
# Compiling PHP
-->

# Compiler PHP

<!--
The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)
-->

Le processus de compilation se trouve dans un [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). Il est issu à l’origine d’un fork de [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm).

<!--
In broad strokes, that `Dockerfile`:
-->

Dans les grandes lignes, ce `Dockerfile` :

<!--
- Installs all the necessary linux packages (like `build-essential`)
- Downloads PHP and the required libraries, e.g. `sqlite3`.
- Applies a few patches.
- Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
- Compiles `php_wasm.c` – a convenient API for JavaScript.
- Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
- Transforms the Emscripten's default `php.js` output into an ESM module with additional features.
-->

- Installe tous les paquets Linux nécessaires (comme `build-essential`).
- Télécharge PHP et les bibliothèques nécessaires, par exemple `sqlite3`.
- Applique quelques correctifs.
- Compile le tout avec [Emscripten](https://emscripten.org/), un remplacement direct du compilateur C.
- Compile `php_wasm.c`, une API pratique pour JavaScript.
- Génère un fichier `php.wasm` et un ou plusieurs chargeurs JavaScript, selon la configuration.
- Transforme la sortie par défaut `php.js` d’Emscripten en un module ESM doté de fonctionnalités supplémentaires.

<!--
To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

Pour en savoir plus sur chaque étape, consultez directement le [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
## Building
-->

## Compilation

<!--
With Docker running and the repository dependencies installed, run these commands from the repository root:
-->

Une fois Docker lancé et les dépendances du dépôt installées, exécutez ces commandes à la racine du dépôt :

<!--
```sh
# Build all supported PHP versions for the web, in both JSPI and Asyncify modes.
npx nx recompile-php:all php-wasm-web

# Build only PHP 8.4 for the web, in JSPI mode.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```
-->

```sh
# Compile toutes les versions PHP prises en charge pour le web, aux modes JSPI et Asyncify.
npx nx recompile-php:all php-wasm-web

# Compile uniquement PHP 8.4 pour le web, au mode JSPI.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```

<!--
Replace `php-wasm-web` with `php-wasm-node` to build for Node.js, or `recompile-php:jspi` with `recompile-php:asyncify` to build the Asyncify variant. The output goes to `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` or `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.
-->

Remplacez `php-wasm-web` par `php-wasm-node` pour compiler pour Node.js, ou `recompile-php:jspi` par `recompile-php:asyncify` pour compiler la variante Asyncify. Les fichiers sont générés dans `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` ou `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.

<!--
## Debug builds
-->

## Compilations de débogage {#debug-builds}

<!--
Use `--WITH_DEBUG=yes` to build PHP.wasm with readable JavaScript output and DWARF debug information for stepping through C code in a WebAssembly debugger:
-->

Utilisez `--WITH_DEBUG=yes` pour compiler PHP.wasm avec une sortie JavaScript lisible et des informations de débogage DWARF permettant de parcourir le code C pas à pas dans un débogueur WebAssembly :

<!--
```sh
# Build PHP 8.4 for debugging in the browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Build PHP 8.4 for debugging in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```
-->

```sh
# Compile PHP 8.4 pour le débogage dans le navigateur.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Compile PHP 8.4 pour le débogage dans Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```

<!--
The same option works with `recompile-php:asyncify`. Debug builds produce larger files and run more slowly than optimized builds. They replace the selected version's artifacts in the output directory described above. Rebuild with `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` to restore an optimized build.
-->

La même option fonctionne avec `recompile-php:asyncify`. Les compilations de débogage génèrent des fichiers plus volumineux et s’exécutent plus lentement que les compilations optimisées. Elles remplacent les artefacts de la version sélectionnée dans le répertoire de sortie décrit ci-dessus. Recompilez avec `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` pour rétablir une compilation optimisée.

<!--
For WebAssembly source maps, use `--WITH_SOURCEMAPS=yes`:
-->

Pour générer des cartes de sources WebAssembly, utilisez `--WITH_SOURCEMAPS=yes` :

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```

<!--
This generates a `php.wasm.map` file and copies the source files needed for debugging into the build output. For web builds, the source map URL points to the local development server at `http://127.0.0.1:5400`; run `npm run dev` to serve it.
-->

Cette option génère un fichier `php.wasm.map` et copie les fichiers sources nécessaires au débogage dans le répertoire de sortie de la compilation. Pour les compilations web, l’URL de la carte de sources pointe vers le serveur de développement local à l’adresse `http://127.0.0.1:5400` ; exécutez `npm run dev` pour la rendre accessible.

<!--
### Emscripten options
-->

### Options d’Emscripten

<!--
The build script translates these options into compiler flags in the [PHP Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):
-->

Le script de compilation traduit ces options en paramètres du compilateur dans le [Dockerfile de PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile) :

<!--
| Flag           | Purpose                                                                                                | When Playground uses it                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `-O0`          | Disables optimization of the final WebAssembly and JavaScript output.                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`, replacing the default `-O3`. |
| `-g2`          | Keeps function names and readable JavaScript, without retaining DWARF information in the final module. | Node.js builds when neither debug option is enabled.                    |
| `-g3`          | Retains DWARF information for source-level debugging.                                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`.                              |
| `-gsource-map` | Generates a WebAssembly source map from compiler debug information.                                    | `WITH_SOURCEMAPS=yes`.                                                  |
-->

| Paramètre      | Rôle                                                                                                                  | Quand Playground l’utilise                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `-O0`          | Désactive l’optimisation de la sortie finale WebAssembly et JavaScript.                                               | `WITH_DEBUG=yes` ou `WITH_SOURCEMAPS=yes`, à la place de la valeur par défaut `-O3`.         |
| `-g2`          | Conserve les noms des fonctions et un JavaScript lisible, sans conserver les informations DWARF dans le module final. | Compilations pour Node.js lorsque ni l’une ni l’autre des options de débogage n’est activée. |
| `-g3`          | Conserve les informations DWARF pour le débogage au niveau du code source.                                            | `WITH_DEBUG=yes` ou `WITH_SOURCEMAPS=yes`.                                                   |
| `-gsource-map` | Génère une carte de sources WebAssembly à partir des informations de débogage du compilateur.                         | `WITH_SOURCEMAPS=yes`.                                                                       |

<!--
See the [Emscripten compiler reference](https://emscripten.org/docs/tools_reference/emcc.html) for details on these flags.
-->

Consultez la [référence du compilateur Emscripten](https://emscripten.org/docs/tools_reference/emcc.html) pour en savoir plus sur ces paramètres.

<!--
### Runtime assertions
-->

### Assertions à l’exécution

<!--
Debug information and runtime assertions are separate settings. Playground explicitly passes `-s ASSERTIONS=0`, including in debug builds, so `--WITH_DEBUG=yes` does not enable extra runtime checks.
-->

Les informations de débogage et les assertions à l’exécution sont des réglages distincts. Playground passe explicitement `-s ASSERTIONS=0`, y compris dans les compilations de débogage. L’option `--WITH_DEBUG=yes` n’active donc pas de vérifications supplémentaires à l’exécution.

<!--
To investigate a runtime failure with assertions, change that setting in the PHP Dockerfile's final `emcc` command and rebuild. Emscripten documents `-s ASSERTIONS=1` for runtime checks and `-s ASSERTIONS=2` for additional, slower checks. There is no `WITH_ASSERTIONS` build option. See the [Emscripten assertions reference](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).
-->

Pour analyser une erreur à l’exécution avec des assertions, modifiez ce réglage dans la commande `emcc` finale du Dockerfile de PHP et recompilez. Emscripten documente `-s ASSERTIONS=1` pour les vérifications à l’exécution et `-s ASSERTIONS=2` pour des vérifications supplémentaires, plus lentes. Il n’existe pas d’option de compilation `WITH_ASSERTIONS`. Consultez la [référence des assertions d’Emscripten](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).

<!--
## PHP next builds
-->

## Compilations de PHP next

<!--
Playground can also run the next PHP version from the php-src development branch in the web runtime. These builds are published separately from the main repository because the generated WebAssembly files are large and change often.
-->

Playground peut aussi exécuter la prochaine version de PHP depuis la branche de développement de php-src dans l’environnement web. Ces compilations sont publiées séparément du dépôt principal, car les fichiers WebAssembly générés sont volumineux et changent souvent.

<!--
The nightly refresh workflow builds the php-src development branch, writes the web artifacts to the gitignored `packages/playground/website/public/php-next/` directory, and publishes the result to the `php-next-builds` branch. Website deploys and the local dev server sync that branch before serving `?php=next`.
-->

Le workflow de mise à jour nocturne compile la branche de développement de php-src, écrit les artefacts web dans le répertoire `packages/playground/website/public/php-next/`, ignoré par Git, et publie le résultat dans la branche `php-next-builds`. Les déploiements du site et le serveur de développement local synchronisent cette branche avant de servir `?php=next`.

<!--
To refresh the local copy manually, run:
-->

Pour actualiser manuellement la copie locale, exécutez :

<!--
```sh
npm run sync:php-next
```
-->

```sh
npm run sync:php-next
```

<!--
To rebuild the web artifacts locally from the php-src development branch, run:
-->

Pour recompiler localement les artefacts web depuis la branche de développement de php-src, exécutez :

<!--
```sh
npm run recompile:php:web:next
```
-->

```sh
npm run recompile:php:web:next
```

<!--
`php=next` currently ships web main modules only. Matching extension side modules and Playground CLI support are separate follow-up work.
-->

Actuellement, `php=next` ne distribue que des modules principaux pour le web. Les modules secondaires des extensions correspondantes et la prise en charge de la CLI de Playground feront l’objet de travaux ultérieurs distincts.

<!--
## PHP extensions
-->

## Extensions PHP

<!--
PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

PHP est compilé avec plusieurs extensions répertoriées dans le [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.
-->

Certaines extensions, comme `zip`, peuvent être activées ou désactivées lors de la compilation. D’autres, comme `sqlite3`, sont définies directement dans le code.

<!--
If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.
-->

Si vous devez désactiver une extension définie directement dans le code, vous pouvez ouvrir un ticket dans ce dépôt. Mieux encore : ce projet a besoin de contributions. Vous pouvez ouvrir une PR et implémenter la modification dont vous avez besoin.

<!--
PHP.wasm can also load dynamic `.so` extensions before PHP starts. Built-in
dynamic extensions such as `intl`, `xdebug`, `redis`, and `memcached` are
distributed with the Node package, and external extensions can be supplied with
a manifest that selects the artifact matching the active PHP version and async
mode. See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for the runtime API.
-->

PHP.wasm peut aussi charger des extensions dynamiques `.so` avant le démarrage de PHP. Les extensions dynamiques intégrées, comme `intl`, `xdebug`, `redis` et `memcached`, sont distribuées avec le paquet Node. Les extensions externes peuvent être fournies avec un manifeste qui sélectionne l’artefact correspondant à la version de PHP et au mode asynchrone actifs. Consultez [Charger des extensions PHP](/developers/apis/javascript-api/php-extensions) pour découvrir l’API d’exécution.

<!--
## C API exposed to JavaScript
-->

## API C exposée à JavaScript

<!--
The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:
-->

L’API C exposée à JavaScript se trouve dans le fichier [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c). Les fonctions les plus importantes sont :

<!--
- `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
- `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
- `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.
-->

- `void phpwasm_init()` – Crée un nouveau contexte PHP et doit être appelée avant d’exécuter du code PHP.
- `int phpwasm_run(char *code)` – Exécute un script PHP et écrit la sortie dans /tmp/stdout et /tmp/stderr. Renvoie le code de sortie.
- `void phpwasm_refresh()` – Détruit le contexte PHP actuel et en démarre un nouveau. Appelez-la après l’exécution d’un script PHP et avant d’en exécuter un autre.

<!--
Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.
-->

Consultez la documentation dans le code de [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) pour en savoir plus.

<!--
## Build configuration
-->

## Configuration de la compilation

<!--
The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:
-->

La compilation est configurable avec la [fonctionnalité `--build-arg` de Docker](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). Vous pouvez définir les options avec le script `build.js` ; exécutez cette commande pour afficher les instructions d’utilisation :

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```

<!--
**Selected build options:**

This list highlights debug and basic build settings. For the full set of options, run the help command above; see [the build script](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/build.js) for platform-specific defaults.
-->

**Sélection d’options de compilation :**

Cette liste présente les réglages de débogage et de compilation de base. Pour consulter toutes les options, exécutez la commande d’aide ci-dessus ; consultez [le script de compilation](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/build.js) pour les valeurs par défaut propres à chaque plateforme.

<!--
- `WITH_DEBUG` – `yes` or `no`. Build with DWARF debug information and disable final optimization. See [Debug builds](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` or `no`. Generate WebAssembly source maps and disable final optimization. See [Debug builds](#debug-builds).
- `PHP_VERSION` – The PHP version to build. Use a major/minor version such as `8.4` to select its latest release from [the supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/supported-php-versions.mjs), or an exact release such as `8.4.25`. The build clones the corresponding `php-<version>` tag from php-src.
- `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
- `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
- `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
- `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
-->

- `WITH_DEBUG` – `yes` ou `no`. Compile avec les informations de débogage DWARF et désactive l’optimisation finale. Consultez [Compilations de débogage](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` ou `no`. Génère des cartes de sources WebAssembly et désactive l’optimisation finale. Consultez [Compilations de débogage](#debug-builds).
- `PHP_VERSION` – La version de PHP à compiler. Utilisez une version majeure/mineure comme `8.4` pour sélectionner sa dernière version dans [les versions de PHP prises en charge](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/supported-php-versions.mjs), ou une version exacte comme `8.4.25`. La compilation clone le tag `php-<version>` correspondant de php-src.
- `EMSCRIPTEN_ENVIRONMENT` – `web` ou `node`, par défaut : `web`. La plateforme cible de la compilation. Pour `web`, deux chargeurs JavaScript sont créés : `php-web.js` et `php-webworker.js`. Pour Node.js, un seul chargeur, nommé `php-node.js`, est créé.
- `WITH_LIBXML` – `yes` ou `no`, par défaut : `no`. Indique s’il faut compiler avec `libxml2` et les extensions PHP `dom`, `xml` et `simplexml` (`DOMDocument`, `SimpleXML`, ...).
- `WITH_LIBZIP` – `yes` ou `no`, par défaut : `yes`. Indique s’il faut compiler avec `zlib`, `libzip` et l’extension PHP `zip` (`ZipArchive`).
- `WITH_NODEFS` – `yes` ou `no`, par défaut : `no`. Indique s’il faut inclure [la bibliothèque JavaScript NODEFS d’Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). Elle permet de charger des fichiers et de monter des répertoires du système de fichiers local lors de l’exécution de php.wasm depuis Node.js.
