---
slug: /developers/apis/javascript-api/mount-data
---

<!-- # Mount data -->

# Monter des données

<!-- The examples on this page use a [self-hosted Playground](/developers/architecture/host-your-own-playground). Save each example as an HTML file next to `remote.html` and serve it from the same origin over HTTPS or on localhost. Both examples load the client bundled with that Playground build. -->

Les exemples de cette page utilisent un [Playground auto-hébergé](/developers/architecture/host-your-own-playground). Enregistrez chaque exemple dans un fichier HTML à côté de `remote.html` et servez les fichiers depuis la même origine, en HTTPS ou sur localhost. Les deux exemples chargent le client fourni avec cette version de Playground.

<!-- ## Mount a directory from the browser -->

## Monter un dossier depuis le navigateur {#mount-a-directory-from-the-browser}

<!-- Call `window.showDirectoryPicker()` from a user action, such as a button click. Pass the returned handle to `client.mountOpfs()` with a `local-fs` device. The `opfs-to-memfs` direction copies the selected folder's existing files into Playground on mount. Playground then syncs its changes back to the folder, so request read and write access when opening the picker. -->

Appelez `window.showDirectoryPicker()` en réponse à une action de la personne qui utilise la page, par exemple un clic sur un bouton. Transmettez la référence renvoyée à `client.mountOpfs()` en indiquant un périphérique `local-fs`. Le sens de synchronisation `opfs-to-memfs` copie les fichiers existants du dossier sélectionné dans Playground au moment du montage. Playground répercute ensuite ses modifications dans le dossier. Demandez l’accès en lecture et en écriture à l’ouverture du sélecteur.

<!-- Open the example directly in a browser that [supports the directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Browsers restrict directory handles to the origin that obtained them. A handle picked on your own domain cannot be sent to an iframe at `https://playground.wordpress.net/remote.html`. The client handles communication with the iframe when you call `mountOpfs()`. -->

Ouvrez l’exemple directement dans un navigateur qui [prend en charge le sélecteur de dossiers](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Les navigateurs limitent l’utilisation des références aux dossiers à l’origine qui les a obtenues. Une référence à un dossier sélectionné sur votre propre domaine ne peut pas être transmise à un iframe situé à l’adresse `https://playground.wordpress.net/remote.html`. Le client se charge de communiquer avec l’iframe lorsque vous appelez `mountOpfs()`.

```html
<!doctype html>
<button id="mount-folder" type="button" disabled>Monter un dossier</button>
<pre id="mounted-files"></pre>
<iframe id="wp" title="WordPress Playground" width="100%" height="500"></iframe>

<script type="module">
	import { startPlaygroundWeb } from './client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: new URL('./remote.html', location.href).href,
	});
	const button = document.getElementById('mount-folder');
	const output = document.getElementById('mounted-files');
	const mountpoint = '/wordpress/wp-content/uploads/markdown';

	button.disabled = false;
	button.addEventListener('click', async () => {
		button.disabled = true;
		try {
			const handle = await window.showDirectoryPicker({
				mode: 'readwrite',
			});
			await client.mountOpfs({
				device: { type: 'local-fs', handle },
				mountpoint,
				initialSyncDirection: 'opfs-to-memfs',
			});
		} catch (error) {
			button.disabled = false;
			if (error.name !== 'AbortError') {
				output.textContent = error.message;
			}
			return;
		}
		const files = await client.listFiles(mountpoint);
		output.textContent = files.join('\n') || 'Ce dossier est vide.';
	});
</script>
```

<!-- ## Mount browser's OPFS storage -->

## Monter le stockage OPFS du navigateur {#mount-browsers-opfs-storage}

<!-- The Origin Private File System (OPFS) is browser-managed file storage scoped to an origin. Playground can use it to keep WordPress files, plugins, and the SQLite database across page reloads. The browser manages this storage without a folder picker. Clearing the site's browser data also clears its OPFS files. See the browser's [storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). -->

Le système de fichiers privé de l’origine (Origin Private File System, OPFS) est un espace de stockage de fichiers géré par le navigateur et propre à une origine. Playground peut s’en servir pour conserver les fichiers de WordPress, les extensions et la base de données SQLite d’un rechargement de page à l’autre. Le navigateur gère ce stockage sans sélecteur de dossiers. Effacer les données du site dans le navigateur supprime aussi les fichiers de ce site dans l’OPFS. Consultez les [quotas de stockage et les critères d’éviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) du navigateur.

<!-- On the first visit, let Playground install WordPress in memory, then mount OPFS with `memfs-to-opfs` to copy the site into browser storage. The example creates a marker in the OPFS directory after `flushOpfs()` completes. On later visits, it checks for that marker and passes the same directory in `mounts` with `opfs-to-memfs`, so Playground loads the existing site during startup. -->

Lors de la première visite, laissez Playground installer WordPress en mémoire, puis montez l’OPFS avec `memfs-to-opfs` pour copier le site dans le stockage du navigateur. Une fois l’appel à `flushOpfs()` terminé, l’exemple crée un fichier témoin dans le dossier de l’OPFS. Lors des visites suivantes, l’exemple vérifie si ce fichier existe et transmet le même dossier dans `mounts` avec `opfs-to-memfs`. Playground charge alors le site existant au démarrage.

```html
<!doctype html>
<p id="storage-status" role="status">Démarrage de WordPress…</p>
<iframe id="wp" title="WordPress Playground" width="100%" height="500"></iframe>

<script type="module">
	import { startPlaygroundWeb } from './client/index.js';

	const siteName = 'mount-data-example-site';
	const opfsRoot = await navigator.storage.getDirectory();
	const savedDirectory = await opfsRoot.getDirectoryHandle(siteName, {
		create: true,
	});
	const readyFile = '.initial-save-complete';
	let hasSavedSite;

	try {
		await savedDirectory.getFileHandle(readyFile);
		hasSavedSite = true;
	} catch (error) {
		if (error.name !== 'NotFoundError') {
			throw error;
		}
		hasSavedSite = false;
	}

	const mount = {
		device: { type: 'opfs', path: siteName },
		mountpoint: '/wordpress',
		initialSyncDirection: hasSavedSite ? 'opfs-to-memfs' : 'memfs-to-opfs',
	};
	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: new URL('./remote.html', location.href).href,
		scope: siteName,
		blueprint: { login: true, landingPage: '/wp-admin/' },
		mounts: hasSavedSite ? [mount] : [],
		wordpressInstallMode: hasSavedSite
			? 'install-from-existing-files-if-needed'
			: 'download-and-install',
	});

	if (!hasSavedSite) {
		await client.mountOpfs(mount);
		await client.flushOpfs(mount.mountpoint);
		await savedDirectory.getFileHandle(readyFile, { create: true });
	}

	document.getElementById('storage-status').textContent =
		'WordPress utilise le stockage du navigateur.';
</script>
```

<!-- Once the page says **WordPress is using browser storage**, publish a post in WordPress and reload the embedding page. Open **Posts** to see the saved post. Playground syncs changes as it serves PHP requests. Call `await client.flushOpfs('/wordpress')` when your application needs to wait for pending writes to reach OPFS before continuing. -->

Une fois que la page affiche **WordPress utilise le stockage du navigateur**, publiez un article dans WordPress et rechargez la page qui intègre Playground. Ouvrez **Posts** (Articles) pour retrouver l’article enregistré. Playground synchronise les modifications lors du traitement des requêtes PHP. Appelez `await client.flushOpfs('/wordpress')` si votre application doit attendre que les écritures en attente soient enregistrées dans l’OPFS avant de continuer.

<!-- In a cross-origin embed, Playground opens the OPFS path from the runtime iframe's browser storage. The marker check above uses the embedding page's storage, so it requires both pages to share an origin. -->

Si les origines diffèrent, Playground ouvre le chemin de l’OPFS dans le stockage du navigateur associé à l’iframe qui l’exécute. La vérification du fichier témoin utilise le stockage de la page qui intègre Playground. Pour que cette vérification fonctionne, les deux pages doivent donc partager la même origine.
