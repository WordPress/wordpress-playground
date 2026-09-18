---
title: Traçage et Profilage avec Xdebug
slug: /developers/xdebug/trace-and-profile
description: Enregistrez des traces de fonctions Xdebug et des profils cachegrind depuis WordPress Playground et lisez-les dans Speedscope, KCachegrind ou votre IDE.
---

<!-- # Tracing and Profiling with Xdebug -->

# Traçage et Profilage avec Xdebug

<!-- Besides the step debugger, Xdebug can record what your code did after the fact: -->

En plus du débogueur pas à pas, Xdebug peut enregistrer ce que votre code a fait après coup :

- Le mode **`trace`** écrit chaque appel de fonction, argument et durée dans un fichier `trace.*.xt`.
- Le mode **`profile`** écrit un fichier cachegrind que vous pouvez ouvrir dans [Speedscope](https://www.speedscope.app/), KCachegrind, QCachegrind ou PhpStorm.

<!-- When started with `--xdebug`, Playground enables the `debug` and `develop`
modes by default. Use `--php-ini` to enable additional modes or change any
[php.ini setting](https://www.php.net/manual/en/ini.list.php), including
[Xdebug settings](https://xdebug.org/docs/all_settings). Values passed this way
override both Playground's and Xdebug's defaults. -->

Lorsqu'il est démarré avec `--xdebug`, Playground active les modes `debug` et `develop` par défaut. Utilisez `--php-ini` pour activer des modes supplémentaires ou modifier n'importe quel [réglage php.ini](https://www.php.net/manual/en/ini.list.php), y compris les [réglages Xdebug](https://xdebug.org/docs/all_settings). Les valeurs passées de cette manière remplacent à la fois les valeurs par défaut de Playground et celles de Xdebug.

<!-- ## Recording a trace and a profile -->

## Enregistrer une trace et un profil

<!-- Trace and profile files are written to `xdebug.output_dir`, which is a path in
Playground's virtual filesystem. Mount a directory of your own there so the
files survive after the request ends: -->

Les fichiers de trace et de profil sont écrits dans `xdebug.output_dir`, qui est un chemin dans le système de fichiers virtuel de Playground. Montez-y un répertoire à vous pour que les fichiers survivent après la fin de la requête :

```bash
mkdir -p ./xdebug-output

npx @wp-playground/cli@latest server \
	--xdebug \
	--mount ./xdebug-output:/xdebug-output \
	--php-ini xdebug.mode debug,develop,trace,profile \
	--php-ini xdebug.start_with_request trigger \
	--php-ini xdebug.output_dir /xdebug-output \
	--php-ini xdebug.trace_output_name trace.%u.%p \
	--php-ini xdebug.profiler_output_name cachegrind.out.%u.%p
```

<!-- Then request the page you want to measure with the `XDEBUG_TRIGGER` parameter: -->

Ensuite, demandez la page que vous voulez mesurer avec le paramètre `XDEBUG_TRIGGER` :

```bash
curl "http://127.0.0.1:9400/wp-json/wp/v2/posts?XDEBUG_TRIGGER=1"
```

<!-- `./xdebug-output` now holds one `trace.*.xt` file and one `cachegrind.out.*`
file for that request. Drop the cachegrind file into Speedscope to see where
the time went, and open the trace file in your editor to follow the call path. -->

`./xdebug-output` contient maintenant un fichier `trace.*.xt` et un fichier `cachegrind.out.*` pour cette requête. Déposez le fichier cachegrind dans Speedscope pour voir où le temps est passé, et ouvrez le fichier de trace dans votre éditeur pour suivre le chemin des appels.

<!-- ### Record on demand, not on every request -->

### Enregistrer à la demande, pas à chaque requête

<!-- `xdebug.start_with_request=trigger` is the setting that makes recording opt-in.
Nothing is written until a request carries `XDEBUG_TRIGGER` as a `GET`
parameter, a `POST` parameter, or a cookie. -->

`xdebug.start_with_request=trigger` est le réglage qui rend l'enregistrement optionnel. Rien n'est écrit tant qu'une requête ne porte pas `XDEBUG_TRIGGER` comme paramètre `GET`, paramètre `POST` ou cookie.

<!-- This matters because the files are large. One WordPress front-page request
produces a trace of about 135 MB and a cachegrind file of about 22 MB. With
`xdebug.start_with_request=yes`, every request, including every admin-ajax
and REST call your browser makes, writes both files. -->

C'est important parce que les fichiers sont volumineux. Une requête sur la page d'accueil de WordPress produit une trace d'environ 135 Mo et un fichier cachegrind d'environ 22 Mo. Avec `xdebug.start_with_request=yes`, chaque requête, y compris chaque appel admin-ajax et REST effectué par votre navigateur, écrit les deux fichiers.

<!-- The trigger also starts the step debugger, so a Playground started this way
only connects to your IDE on triggered requests. -->

Le déclencheur démarre aussi le débogueur pas à pas, donc un Playground démarré de cette manière ne se connecte à votre IDE que sur les requêtes déclenchées.

<!-- ### Give every recording its own file name -->

### Donner à chaque enregistrement son propre nom de fichier

<!-- Xdebug names the files after the process ID by default, so a second request
from the same worker overwrites the first one. Playground CLI runs several
workers, which makes the collision easy to hit. -->

Xdebug nomme les fichiers d'après l'identifiant du processus par défaut, donc une deuxième requête du même worker écrase la première. Le Playground CLI exécute plusieurs workers, ce qui rend la collision facile à atteindre.

<!-- Adding `%u` (timestamp with microseconds) to `xdebug.trace_output_name` and
`xdebug.profiler_output_name` keeps one file per request, as in the command
above. Running with `--workers=1` also keeps the output predictable. -->

Ajouter `%u` (horodatage avec microsecondes) à `xdebug.trace_output_name` et `xdebug.profiler_output_name` conserve un fichier par requête, comme dans la commande ci-dessus. Exécuter avec `--workers=1` garde aussi la sortie prévisible.

<!-- ## Using the library API -->

## Utiliser l'API de la bibliothèque

<!-- PHP reads `php.ini` before extension-specific ini files, so settings in
`xdebug.ini` take precedence over matching settings in `php.ini`. The
Playground CLI writes `xdebug.*` entries to `xdebug.ini` and all other entries
to `php.ini`. When using `@php-wasm/node` directly, pass the Xdebug ini path to
`setPhpIniEntries()`: -->

PHP lit `php.ini` avant les fichiers ini spécifiques aux extensions, donc les réglages dans `xdebug.ini` prennent le pas sur les réglages correspondants dans `php.ini`. Le Playground CLI écrit les entrées `xdebug.*` dans `xdebug.ini` et toutes les autres entrées dans `php.ini`. Lorsque vous utilisez `@php-wasm/node` directement, passez le chemin du fichier ini de Xdebug à `setPhpIniEntries()` :

```ts
import { PHP, PHP_EXTENSIONS_DIR, setPhpIniEntries } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.5', { extensions: ['xdebug'] }));

await setPhpIniEntries(
	php,
	{
		'xdebug.mode': 'debug,develop,trace,profile',
		'xdebug.start_with_request': 'trigger',
		'xdebug.output_dir': '/xdebug-output',
		'xdebug.trace_output_name': 'trace.%u.%p',
		'xdebug.profiler_output_name': 'cachegrind.out.%u.%p',
	},
	joinPaths(PHP_EXTENSIONS_DIR, 'xdebug.ini')
);

await php.mount('/xdebug-output', createNodeFsMountHandler('./xdebug-output'));
```

<!-- Call `setPhpIniEntries()` before the first request runs. PHP parses the ini
files once, on the first run, and ignores every later write. -->

Appelez `setPhpIniEntries()` avant que la première requête s'exécute. PHP analyse les fichiers ini une seule fois, à la première exécution, et ignore toute écriture ultérieure.

<!-- Without the third argument, `setPhpIniEntries()` writes `php.ini`, and the
entries an extension ships keep winning over it. An entry you do not set
keeps its default value. -->

Sans le troisième argument, `setPhpIniEntries()` écrit `php.ini`, et les entrées fournies par une extension continuent de prendre le pas sur lui. Une entrée que vous ne définissez pas conserve sa valeur par défaut.

<!-- ## Starting a trace from PHP -->

## Démarrer une trace depuis PHP

<!-- Xdebug's own functions work too, and they need no trigger: -->

Les fonctions propres à Xdebug fonctionnent aussi, et elles n'ont pas besoin de déclencheur :

```php
xdebug_start_trace('/xdebug-output/checkout');
do_the_slow_thing();
xdebug_stop_trace();
```

<!-- This is the narrowest option. It records one block of code instead of a whole
request, which keeps the trace file small enough to read by hand. -->

C'est l'option la plus ciblée. Elle enregistre un bloc de code au lieu d'une requête entière, ce qui garde le fichier de trace assez petit pour être lu à la main.
