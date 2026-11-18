---
slug: /developers/apis/javascript-api/mount-data
---

<!-- # Mount data -->

# Montar datos

<!-- The examples on this page use a [self-hosted Playground](/developers/architecture/host-your-own-playground). Save each example as an HTML file next to `remote.html` and serve it from the same origin over HTTPS or on localhost. Both examples load the client bundled with that Playground build. -->

Los ejemplos de esta página usan un [Playground alojado en tu propio servidor](/developers/architecture/host-your-own-playground). Guarda cada ejemplo como un archivo HTML junto a `remote.html` y sirve los archivos desde el mismo origen por HTTPS o en localhost. Ambos ejemplos cargan el cliente incluido en esa versión de Playground.

<!-- ## Mount a directory from the browser -->

## Montar un directorio desde el navegador {#mount-a-directory-from-the-browser}

<!-- Call `window.showDirectoryPicker()` from a user action, such as a button click. Pass the returned handle to `client.mountOpfs()` with a `local-fs` device. The `opfs-to-memfs` direction copies the selected folder's existing files into Playground on mount. Playground then syncs its changes back to the folder, so request read and write access when opening the picker. -->

Llama a `window.showDirectoryPicker()` en respuesta a una acción del usuario, como hacer clic en un botón. Pasa la referencia devuelta a `client.mountOpfs()` con un dispositivo `local-fs`. La dirección de sincronización `opfs-to-memfs` copia los archivos existentes de la carpeta seleccionada a Playground al montarla. Después, Playground sincroniza sus cambios con la carpeta. Por eso debes solicitar acceso de lectura y escritura al abrir el selector.

<!-- Open the example directly in a browser that [supports the directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Browsers restrict directory handles to the origin that obtained them. A handle picked on your own domain cannot be sent to an iframe at `https://playground.wordpress.net/remote.html`. The client handles communication with the iframe when you call `mountOpfs()`. -->

Abre el ejemplo directamente en un navegador que [admita el selector de directorios](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Los navegadores restringen el uso de las referencias a directorios al origen que las obtuvo. No puedes enviar la referencia a un directorio seleccionado en tu dominio a un iframe en `https://playground.wordpress.net/remote.html`. El cliente se encarga de comunicarse con el iframe cuando llamas a `mountOpfs()`.

```html
<!doctype html>
<button id="mount-folder" type="button" disabled>Montar una carpeta</button>
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
		output.textContent = files.join('\n') || 'Esta carpeta está vacía.';
	});
</script>
```

<!-- ## Mount browser's OPFS storage -->

## Montar el almacenamiento OPFS del navegador {#mount-browsers-opfs-storage}

<!-- The Origin Private File System (OPFS) is browser-managed file storage scoped to an origin. Playground can use it to keep WordPress files, plugins, and the SQLite database across page reloads. The browser manages this storage without a folder picker. Clearing the site's browser data also clears its OPFS files. See the browser's [storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). -->

El sistema de archivos privado del origen (Origin Private File System, OPFS) es un espacio de almacenamiento de archivos que el navegador gestiona y limita a un origen. Playground puede usarlo para conservar los archivos de WordPress, los plugins y la base de datos SQLite al recargar la página. El navegador gestiona este almacenamiento sin un selector de carpetas. Si borras los datos del sitio en el navegador, también se borran sus archivos en el OPFS. Consulta las [cuotas de almacenamiento y los criterios de eliminación](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) del navegador.

<!-- On the first visit, let Playground install WordPress in memory, then mount OPFS with `memfs-to-opfs` to copy the site into browser storage. The example creates a marker in the OPFS directory after `flushOpfs()` completes. On later visits, it checks for that marker and passes the same directory in `mounts` with `opfs-to-memfs`, so Playground loads the existing site during startup. -->

En la primera visita, deja que Playground instale WordPress en memoria y luego monta el OPFS con `memfs-to-opfs` para copiar el sitio al almacenamiento del navegador. El ejemplo crea un archivo marcador en el directorio del OPFS una vez que termina `flushOpfs()`. En las visitas siguientes, el ejemplo comprueba si ese archivo existe y pasa el mismo directorio en `mounts` con `opfs-to-memfs`. Así, Playground carga el sitio existente al iniciarse.

```html
<!doctype html>
<p id="storage-status" role="status">Iniciando WordPress…</p>
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
		'WordPress está usando el almacenamiento del navegador.';
</script>
```

<!-- Once the page says **WordPress is using browser storage**, publish a post in WordPress and reload the embedding page. Open **Posts** to see the saved post. Playground syncs changes as it serves PHP requests. Call `await client.flushOpfs('/wordpress')` when your application needs to wait for pending writes to reach OPFS before continuing. -->

Cuando la página muestre **WordPress está usando el almacenamiento del navegador**, publica una entrada en WordPress y recarga la página que incrusta Playground. Abre **Posts** (Entradas) para ver la entrada guardada. Playground sincroniza los cambios al atender las solicitudes PHP. Llama a `await client.flushOpfs('/wordpress')` si tu aplicación debe esperar a que los cambios pendientes se escriban en el OPFS antes de continuar.

<!-- In a cross-origin embed, Playground opens the OPFS path from the runtime iframe's browser storage. The marker check above uses the embedding page's storage, so it requires both pages to share an origin. -->

Cuando la página y el iframe tienen orígenes diferentes, Playground abre la ruta del OPFS desde el almacenamiento del navegador asociado al iframe que lo ejecuta. La comprobación del archivo marcador usa el almacenamiento de la página que incrusta Playground, por lo que ambas páginas deben compartir el mismo origen.
