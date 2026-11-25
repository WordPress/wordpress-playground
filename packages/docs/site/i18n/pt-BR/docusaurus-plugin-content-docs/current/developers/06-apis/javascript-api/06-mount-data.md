---
title: Montar dados
slug: /developers/apis/javascript-api/mount-data
description: Monte uma pasta local no WordPress Playground e salve seu site no armazenamento OPFS do navegador para restaurá-lo ao recarregar a página.
---

<!-- # Mount data -->

# Montar dados

<!-- The examples on this page use a [self-hosted Playground](/developers/architecture/host-your-own-playground). Save each example as an HTML file next to `remote.html` and serve it from the same origin over HTTPS or on localhost. Both examples load the client bundled with that Playground build. -->

Os exemplos desta página usam um [Playground hospedado no seu próprio servidor](/developers/architecture/host-your-own-playground). Salve cada exemplo como um arquivo HTML ao lado de `remote.html` e sirva os arquivos na mesma origem, por HTTPS ou em localhost. Os dois exemplos carregam o cliente incluído nessa versão do Playground.

<!-- ## Mount a directory from the browser -->

## Montar um diretório a partir do navegador {#mount-a-directory-from-the-browser}

<!-- Call `window.showDirectoryPicker()` from a user action, such as a button click. Pass the returned handle to `client.mountOpfs()` with a `local-fs` device. The `opfs-to-memfs` direction copies the selected folder's existing files into Playground on mount. Playground then syncs its changes back to the folder, so request read and write access when opening the picker. -->

Chame `window.showDirectoryPicker()` em resposta a uma ação da pessoa usuária, como um clique em um botão. Passe a referência retornada ao método `client.mountOpfs()` com um dispositivo `local-fs`. A direção `opfs-to-memfs` copia os arquivos existentes da pasta selecionada para o Playground durante a montagem. Em seguida, o Playground sincroniza suas alterações com a pasta. Por isso, solicite acesso de leitura e gravação ao abrir o seletor.

<!-- Open the example directly in a browser that [supports the directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Browsers restrict directory handles to the origin that obtained them. A handle picked on your own domain cannot be sent to an iframe at `https://playground.wordpress.net/remote.html`. The client handles communication with the iframe when you call `mountOpfs()`. -->

Abra o exemplo diretamente em um navegador [compatível com o seletor de diretórios](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Os navegadores limitam o uso das referências a diretórios à origem que as obteve. Uma referência a um diretório selecionado no seu domínio não pode ser enviada a um iframe em `https://playground.wordpress.net/remote.html`. O cliente cuida da comunicação com o iframe quando você chama `mountOpfs()`.

```html
<!doctype html>
<button id="mount-folder" type="button" disabled>Montar uma pasta</button>
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
		output.textContent = files.join('\n') || 'Esta pasta está vazia.';
	});
</script>
```

<!-- ## Mount browser's OPFS storage -->

## Montar o armazenamento OPFS do navegador {#mount-browsers-opfs-storage}

<!-- The Origin Private File System (OPFS) is browser-managed file storage scoped to an origin. Playground can use it to keep WordPress files, plugins, and the SQLite database across page reloads. The browser manages this storage without a folder picker. Clearing the site's browser data also clears its OPFS files. See the browser's [storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). -->

O sistema de arquivos privado da origem (Origin Private File System, OPFS) é um armazenamento de arquivos gerenciado pelo navegador e restrito a uma origem. O Playground pode usá-lo para manter os arquivos do WordPress, os plugins e o banco de dados SQLite ao recarregar a página. O navegador gerencia esse armazenamento sem usar um seletor de pastas. Limpar os dados do site no navegador também apaga seus arquivos no OPFS. Consulte as [cotas de armazenamento e os critérios de remoção de dados](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) do navegador.

<!-- On the first visit, let Playground install WordPress in memory, then mount OPFS with `memfs-to-opfs` to copy the site into browser storage. The example creates a marker in the OPFS directory after `flushOpfs()` completes. On later visits, it checks for that marker and passes the same directory in `mounts` with `opfs-to-memfs`, so Playground loads the existing site during startup. -->

Na primeira visita, deixe o Playground instalar o WordPress na memória. Depois, monte o OPFS com `memfs-to-opfs` para copiar o site para o armazenamento do navegador. O exemplo cria um arquivo de sinalização no diretório do OPFS quando `flushOpfs()` termina. Nas próximas visitas, o exemplo verifica se esse arquivo existe e passa o mesmo diretório em `mounts` com `opfs-to-memfs`. Assim, o Playground carrega o site existente durante a inicialização.

```html
<!doctype html>
<p id="storage-status" role="status">Iniciando o WordPress…</p>
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
		'O WordPress está usando o armazenamento do navegador.';
</script>
```

<!-- Once the page says **WordPress is using browser storage**, publish a post in WordPress and reload the embedding page. Open **Posts** to see the saved post. Playground syncs changes as it serves PHP requests. Call `await client.flushOpfs('/wordpress')` when your application needs to wait for pending writes to reach OPFS before continuing. -->

Quando a página exibir **O WordPress está usando o armazenamento do navegador**, publique um post no WordPress e recarregue a página que incorpora o Playground. Abra **Posts** para encontrar o post salvo. O Playground sincroniza as alterações ao atender a requisições PHP. Chame `await client.flushOpfs('/wordpress')` quando seu aplicativo precisar esperar que as gravações pendentes cheguem ao OPFS antes de continuar.

<!-- In a cross-origin embed, Playground opens the OPFS path from the runtime iframe's browser storage. The marker check above uses the embedding page's storage, so it requires both pages to share an origin. -->

Em uma incorporação entre origens diferentes, o Playground abre o caminho do OPFS no armazenamento do navegador associado ao iframe que o executa. A verificação do arquivo de sinalização usa o armazenamento da página que incorpora o Playground e, por isso, só funciona se as duas páginas tiverem a mesma origem.
