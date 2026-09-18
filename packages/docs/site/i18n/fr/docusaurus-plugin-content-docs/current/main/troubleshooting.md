---
title: Dépannage
slug: /troubleshooting
description: Diagnostiquer les erreurs courantes du site WordPress Playground, notamment les échecs de démarrage, les problèmes SQLite, le stockage du navigateur et la récupération des Playgrounds enregistrés.
---

<!-- title: Troubleshooting -->

<!-- description: Diagnose common WordPress Playground website errors, including boot failures, SQLite issues, browser storage, and saved Playground recovery. -->

<!-- # Troubleshooting WordPress Playground -->

# Dépannage de WordPress Playground

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

Cette page couvre les erreurs du site Playground lui-même, des Playgrounds
enregistrés, du stockage du navigateur et du démarrage de WordPress. Pour les
erreurs propres aux Blueprints, consultez
[Dépanner et déboguer les Blueprints](/blueprints/troubleshoot-and-debug).

<!-- ## Playground looks broken -->

## Playground semble cassé

<!-- Try these first: -->

Essayez d’abord ceci :

<!--
- Use the reload button inside the Playground toolbar instead of refreshing the browser tab. Browser refresh starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a fresh unsaved Playground.
-->

- Utilisez le bouton de rechargement dans la barre d’outils de Playground au lieu d’actualiser l’onglet du navigateur. L’actualisation du navigateur redémarre toute l’application Playground.
- Ouvrez la même URL dans une fenêtre privée pour écarter un état de site enregistré ou de stockage du navigateur.
- Désactivez les extensions du navigateur qui bloquent JavaScript, WebAssembly, le stockage, les workers ou les requêtes réseau.
- Consultez les erreurs de Console et de Network dans les outils de développement du navigateur.
- Si l’URL inclut `?site-slug=...`, essayez de supprimer ce paramètre de requête pour démarrer un nouveau Playground non enregistré.

<!-- ## A clean site says the MySQL extension is missing -->

## Un site propre indique que l’extension MySQL est manquante

<!-- You may see a WordPress error page like this: -->

Vous pouvez voir une page d’erreur WordPress comme celle-ci :

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

Dans Playground, cela signifie généralement que WordPress n’a pas chargé
l’intégration SQLite qui permet à WordPress de fonctionner sans MySQL.
Playground exécute WordPress dans WebAssembly et utilise SQLite au lieu d’un
serveur MySQL.

<!-- Try these steps: -->

Essayez ces étapes :

<!--
- Start a fresh unsaved Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new temporary site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- Démarrez un nouveau Playground non enregistré sur https://playground.wordpress.net/ pour confirmer que le site public peut démarrer.
- Si l’URL inclut un site enregistré, supprimez `?site-slug=...` et chargez un nouveau site temporaire.
- Si cela s’est produit après l’importation d’un ZIP, confirmez que l’importation n’incluait pas de `wp-content/db.php` personnalisé qui remplace la configuration SQLite de Playground.
- Si cela s’est produit dans la CLI, n’utilisez pas `--skip-sqlite-setup` sauf si vous fournissez votre propre intégration de base de données.
- Si cela s’est produit avec un Blueprint, consultez la [page de dépannage des Blueprints](/blueprints/troubleshoot-and-debug).

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

Si vous écrivez un Blueprint et devez ajouter l’extension d’intégration SQLite,
`plugins` se place au premier niveau :

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!-- ## Error connecting to the SQLite database -->

## Error connecting to the SQLite database

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

Cela signifie que Playground a chargé l’intégration SQLite, mais que WordPress
n’a toujours pas pu se connecter à la base de données.

<!-- Common causes: -->

Causes courantes :

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- Le stockage navigateur d’un Playground enregistré est périmé ou incomplet.
- Un ZIP de site importé contient un fichier de base de données ou un drop-in de base de données incompatible.
- Il manque à un répertoire local monté des fichiers dont WordPress a besoin.
- Le stockage du navigateur a été effacé, évincé ou bloqué.

<!-- Recommended recovery: -->

Récupération recommandée :

<!--
1. Start a fresh unsaved Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export any accessible files from the broken saved site using the File Browser or local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. Démarrez un nouveau Playground non enregistré sans `site-slug`.
2. Si le nouveau site fonctionne, le problème est lié au site enregistré ou à l’archive importée.
3. Exportez tous les fichiers accessibles du site enregistré cassé avec le File Browser ou une copie de répertoire local, si disponible.
4. Réimportez le site dans un nouveau Playground, ou reconstruisez-le à partir de son Blueprint.

<!-- ## NotAllowedError -->

## NotAllowedError

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` signifie généralement que le navigateur a bloqué une opération
qui nécessite une autorisation de l’utilisateur ou un contexte de navigateur
pris en charge. Dans Playground, cela concerne souvent les sites enregistrés ou
l’accès à un répertoire local.

<!-- You may see this exact message: -->

Vous pouvez voir ce message exact :

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!-- Try: -->

Essayez :

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from the Playground **Saved Playgrounds** panel.
- If the site was saved to a local directory, import or save the directory again.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- Ouvrez Playground dans un onglet de navigateur normal de premier niveau, pas dans une iframe restreinte.
- Rouvrez le site depuis le panneau **Saved Playgrounds** de Playground.
- Si le site a été enregistré dans un répertoire local, importez ou enregistrez de nouveau le répertoire.
- Confirmez que le navigateur prend en charge l’API de fichier ou de stockage utilisée. Chrome et Edge offrent généralement la prise en charge la plus large des répertoires locaux.
- Vérifiez si le mode de navigation privée, une politique d’entreprise ou les réglages du navigateur bloquent l’accès au stockage.

<!-- ## NoModificationAllowedError -->

## NoModificationAllowedError

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` signifie que le navigateur ou le système de
fichiers a refusé une écriture. Cela peut arriver lorsqu’un répertoire local
enregistré est devenu en lecture seule, que l’autorisation a été perdue ou que
le stockage du navigateur est indisponible.

<!-- You may see this exact message: -->

Vous pouvez voir ce message exact :

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!-- Try: -->

Essayez :

<!--
- Save a copy to a different local directory.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh unsaved Playground if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- Enregistrez une copie dans un autre répertoire local.
- Vérifiez que le dossier cible existe encore et qu’il est accessible en écriture.
- Évitez les dossiers protégés par le système ou les dossiers synchronisés qui verrouillent temporairement les fichiers.
- Démarrez un nouveau Playground non enregistré si vous avez seulement besoin d’un site de test temporaire.
- Utilisez [Playground CLI](/developers/local-development/wp-playground-cli) pour un développement local qui nécessite une persistance fiable du système de fichiers.

<!-- ## Saved Playground cannot reload -->

## Le Playground enregistré ne peut pas se recharger

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

Les Playgrounds enregistrés sont stockés dans le stockage du navigateur ou dans
un répertoire local que vous avez sélectionné. Ils ne sont pas hébergés sur un
serveur distant.

<!-- If a saved Playground cannot reload: -->

Si un Playground enregistré ne peut pas se recharger :

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh unsaved site.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- Confirmez que vous utilisez le même navigateur et le même profil de navigateur que lors de son enregistrement.
- Vérifiez si les données du navigateur ont été effacées ou si le stockage a été désactivé.
- Si le site a été enregistré dans un répertoire local, confirmez que le répertoire existe toujours et n’a pas été déplacé.
- Si l’URL inclut `?site-slug=...`, supprimez-le pour démarrer un nouveau site non enregistré.
- Recréez le site enregistré depuis son Blueprint d’origine ou son ZIP d’importation si le stockage a été perdu.

<!-- ## Browser storage and persistence -->

## Stockage du navigateur et persistance

<!--
An unsaved Playground is temporary. A browser refresh, tab close, storage
cleanup, or browser profile change can remove its state.
-->

Un Playground non enregistré est temporaire. Une actualisation du navigateur, la
fermeture d’un onglet, le nettoyage du stockage ou un changement de profil de
navigateur peut supprimer son état.

<!--
Use the **Save** button before doing meaningful work. For longer-running local
development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli),
which persists site files on disk.
-->

Utilisez le bouton **Save** avant d’effectuer un travail important. Pour un
développement local plus long, préférez
[Playground CLI](/developers/local-development/wp-playground-cli), qui conserve
les fichiers du site sur le disque.

<!--
<div class="callout callout-tip">

The refresh button inside the Playground toolbar reloads WordPress while keeping
the current Playground runtime. The browser refresh button reloads the full app
and can discard unsaved changes.
</div>
-->

<div class="callout callout-tip">

Le bouton de rechargement dans la barre d’outils de Playground recharge
WordPress tout en conservant l’environnement d’exécution actuel de Playground.
Le bouton d’actualisation du navigateur recharge toute l’application et peut
perdre les modifications non enregistrées.

</div>

<!-- ## When to start fresh -->

## Quand repartir de zéro

<!-- Start a fresh unsaved Playground when: -->

Démarrez un nouveau Playground non enregistré lorsque :

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- Vous voulez seulement tester si le site public Playground fonctionne.
- L’URL pointe vers un `site-slug` enregistré qui ne se charge plus.
- Vous cherchez à savoir si une erreur vient de Playground lui-même ou d’une extension, d’un thème, d’un Blueprint ou d’un site importé.
- Le stockage du navigateur ou l’accès au répertoire local semble cassé.

<!-- Use this URL for a clean site: -->

Utilisez cette URL pour un site propre :

```text
https://playground.wordpress.net/
```

<!-- ## Report a Playground issue -->

## Signaler un problème Playground

<!--
If the problem reproduces on a fresh unsaved Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

Si le problème se reproduit sur un nouveau Playground non enregistré, veuillez
[ouvrir une issue](https://github.com/WordPress/wordpress-playground/issues) et
inclure :

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- L’URL complète de Playground.
- Le navigateur et le système d’exploitation.
- Si vous avez utilisé un site enregistré, un ZIP importé, un Blueprint, un répertoire local ou la CLI.
- Le nom et le message d’erreur exacts.
- Les détails de Console et de Network des outils de développement du navigateur.
