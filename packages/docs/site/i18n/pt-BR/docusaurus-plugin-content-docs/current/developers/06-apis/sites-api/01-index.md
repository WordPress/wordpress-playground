---
title: Sites API
slug: /developers/apis/sites-api
description: Gerencie os sites do Playground com JavaScript — liste, crie, salve, alterne e configure as instâncias do WordPress no playground.wordpress.net.
---

<!--
The Sites API is a JavaScript API exposed by [playground.wordpress.net](https://playground.wordpress.net). It manages the WordPress sites shown in the Dock's **Playgrounds** pane: recent autosaves, permanently stored browser Playgrounds, local-directory Playgrounds, and temporary Playgrounds.
-->

A Sites API é uma API JavaScript exposta pelo [playground.wordpress.net](https://playground.wordpress.net). Ela gerencia os sites do WordPress mostrados no painel **Playgrounds** do Dock: os salvamentos automáticos recentes, os Playgrounds guardados permanentemente no navegador, os Playgrounds em um diretório local e os Playgrounds temporários.

<!--
The API is reached through the `window.playgroundSites` global. `window.playgroundSites` is not assigned during the first moments of page load. Wait for it to appear, then call [`isReady()`](#isready) before making API calls that need the active Playground client.
-->

A API é acessada pela variável global `window.playgroundSites`. O `window.playgroundSites` não é definido nos primeiros instantes do carregamento da página. Espere até que ele apareça e chame [`isReady()`](#isready) antes de fazer chamadas à API que precisem do cliente do Playground ativo.

<div class="callout callout-info">

<!--
The Sites API ships with the Playground website application, not with the `@wp-playground/client` library. It is exposed on the top-level page (`/`), not on `/remote.html`. If you embed Playground via `startPlaygroundWeb` into your own page, your iframe won't expose `window.playgroundSites` to the parent — use the [JavaScript API](/developers/apis/javascript-api/) for direct control instead.
-->

A Sites API faz parte da aplicação do site do Playground, e não da biblioteca `@wp-playground/client`. Ela fica exposta na página principal (`/`), e não em `/remote.html`. Se você incorpora o Playground na sua própria página com o `startPlaygroundWeb`, o seu iframe não expõe o `window.playgroundSites` para a página pai. Nesse caso, use a [API JavaScript](/developers/apis/javascript-api/) para controlar o Playground diretamente.

</div>

<!-- ## Quick start -->

## Início rápido {#quick-start}

<!--
Open [playground.wordpress.net](https://playground.wordpress.net), wait for WordPress to load, then run this in DevTools:
-->

Abra o [playground.wordpress.net](https://playground.wordpress.net), espere o WordPress carregar e rode isto no DevTools:

```javascript
await playgroundSites.isReady();

playgroundSites.list();
// → [{ slug: 'calm-sunny-park', name: 'Calm Sunny Park', storage: 'opfs', persistence: 'autosave', isActive: true }]

await playgroundSites.keep(undefined, 'My demo site');
// The active autosave is now a permanently saved browser Playground.

const client = playgroundSites.getClient();
await client.listFiles('/wordpress');
```

<!--
A fresh visit normally creates an autosaved browser Playground when browser storage and saving are available. Use `?storage=temp` or [`createNewTemporarySite()`](#createnewtemporarysiteslug-settings) when you need a Playground that is discarded on page refresh or tab close.
-->

Uma visita nova normalmente cria um Playground no navegador com salvamento automático, quando o armazenamento do navegador e o salvamento estão disponíveis. Use `?storage=temp` ou [`createNewTemporarySite()`](#createnewtemporarysiteslug-settings) quando precisar de um Playground que seja descartado ao recarregar a página ou fechar a aba.

<!-- ## Storage and persistence -->

## Armazenamento e persistência {#storage-and-persistence}

<!--
Every site has a storage backend. Stored sites also have a persistence lifecycle.
-->

Todo site tem um backend de armazenamento. Os sites armazenados também têm um ciclo de vida de persistência.

<!--
| Field         | Value       | Meaning                                                                   |
| ------------- | ----------- | ------------------------------------------------------------------------- |
| `storage`     | `temporary` | In-memory only. It is discarded on browser refresh or tab close.          |
| `storage`     | `opfs`      | Stored in the browser's Origin Private File System.                       |
| `storage`     | `local-fs`  | Stored in a local directory through the File System Access API.           |
| `persistence` | `autosave`  | A stored recovery point. Playground keeps the five most recent autosaves. |
| `persistence` | `explicit`  | A stored Playground kept permanently until the user or API deletes it.    |
-->

| Campo         | Valor       | Significado                                                                                             |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `storage`     | `temporary` | Só em memória. É descartado ao recarregar o navegador ou fechar a aba.                                  |
| `storage`     | `opfs`      | Armazenado no Origin Private File System do navegador.                                                  |
| `storage`     | `local-fs`  | Armazenado em um diretório local pela File System Access API.                                           |
| `persistence` | `autosave`  | Um ponto de recuperação armazenado. O Playground mantém os cinco salvamentos automáticos mais recentes. |
| `persistence` | `explicit`  | Um Playground armazenado e mantido permanentemente até que o usuário ou a API o exclua.                 |

<!--
Temporary Playgrounds do not report `persistence` because there is no stored lifecycle to preserve.
-->

Os Playgrounds temporários não informam `persistence`, porque não há um ciclo de vida armazenado para preservar.

<!-- ## Creating and switching sites -->

## Criando e alternando sites {#creating-and-switching-sites}

### `createNewTemporarySite(slug?, settings?)`

<!--
Creates a new temporary site and switches to it. Resolves with the new site's slug once it has booted.
-->

Cria um novo site temporário e alterna para ele. Resolve com o slug do novo site assim que ele termina de inicializar.

```typescript
createNewTemporarySite(
	slug?: string,
	settings?: {
		phpVersion?: string; // e.g. '8.4'
		wpVersion?: string; // e.g. '6.8', 'latest', 'nightly', 'beta'
		networking?: boolean;
		language?: string; // e.g. 'pl_PL'
		multisite?: boolean;
	}
): Promise<string>;
```

<!--
Each setting corresponds to an equivalent [Query API](/developers/apis/query-api) parameter of the same name, with `phpVersion` mapped to `php` and `wpVersion` mapped to `wp`. Other Query API options like `plugin`, `theme`, or `blueprint-url` are not accepted here.
-->

Cada configuração corresponde ao parâmetro de mesmo nome da [Query API](/developers/apis/query-api), com `phpVersion` correspondendo a `php` e `wpVersion` correspondendo a `wp`. Outras opções da Query API, como `plugin`, `theme` ou `blueprint-url`, não são aceitas aqui.

### `createNewSavedSite(slug?, settings?, options?)`

<!--
Creates a new browser-stored site and switches to it. The site starts as an explicit save unless `options.persistence` is `autosave`.
-->

Cria um novo site armazenado no navegador e alterna para ele. O site começa como um salvamento explícito, a menos que `options.persistence` seja `autosave`.

```typescript
createNewSavedSite(
	slug?: string,
	settings?: {
		phpVersion?: string;
		wpVersion?: string;
		networking?: boolean;
		language?: string;
		multisite?: boolean;
	},
	options?: {
		persistence?: 'autosave' | 'explicit';
		updateUrl?: boolean;
		excludeFromPruning?: string[];
	}
): Promise<string>;
```

<!--
Autosaved sites created through this method participate in the same last-five autosave pruning as autosaves created by the UI.
-->

Os sites com salvamento automático criados por este método entram na mesma limpeza que mantém só os cinco salvamentos automáticos mais recentes, igual aos criados pela interface.

### `setActiveSite(slug, options?)`

<!--
Switches to a different site and boots it. Resolves when the site is ready or rejects if it fails to boot. Resolves immediately if the site is already active.
-->

Alterna para outro site e o inicializa. Resolve quando o site fica pronto ou rejeita se ele não conseguir inicializar. Resolve imediatamente se o site já estiver ativo.

```typescript
setActiveSite(
	siteSlug: string,
	options?: { updateUrl?: boolean }
): Promise<void>;
```

<!-- ## Reading site state -->

## Lendo o estado dos sites {#reading-site-state}

### `list()`

<!--
Returns every known site, including the active one.
-->

Retorna todos os sites conhecidos, incluindo o ativo.

```typescript
list(): Array<{
	slug: string;
	name: string;
	storage: 'temporary' | 'opfs' | 'local-fs';
	persistence?: 'autosave' | 'explicit';
	isActive: boolean;
}>;
```

### `getClient()`

<!--
Returns the [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) for the active site, or `undefined` if the site exists but has not finished booting yet. Throws if no site is selected at all, which only happens very early in page load.
-->

Retorna o [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) do site ativo, ou `undefined` se o site existe mas ainda não terminou de inicializar. Lança um erro se nenhum site estiver selecionado, o que só acontece bem no começo do carregamento da página.

```typescript
getClient(): PlaygroundClient | undefined;
```

### `isReady()`

<!--
Resolves once the active site is fully booted and its `PlaygroundClient` is ready for API calls. Rejects if the site fails to boot.
-->

Resolve assim que o site ativo termina de inicializar e o `PlaygroundClient` dele está pronto para chamadas à API. Rejeita se o site não conseguir inicializar.

<!--
For scripts that run before the page has finished loading, wait for `window.playgroundSites` to appear first:
-->

Em scripts que rodam antes de a página terminar de carregar, espere primeiro o `window.playgroundSites` aparecer:

```javascript
await new Promise((resolve) => {
	const id = setInterval(() => {
		if (window.playgroundSites) {
			clearInterval(id);
			resolve();
		}
	}, 50);
});
await window.playgroundSites.isReady();
```

```typescript
isReady(): Promise<void>;
```

<!-- ## Persisting and keeping sites -->

## Salvando e mantendo sites {#persisting-and-keeping-sites}

<!--
These methods are safe to call on already-stored sites unless noted otherwise.
-->

Estes métodos podem ser chamados com segurança em sites já armazenados, salvo indicação em contrário.

### `autosaveTemporarySite(slug?, options?)`

<!--
Persists a temporary Playground into browser storage as an autosave. It returns the site's slug and storage backend. If the site is already stored, it returns the current storage without copying files.
-->

Salva um Playground temporário no armazenamento do navegador como salvamento automático. Retorna o slug do site e o backend de armazenamento. Se o site já estiver armazenado, retorna o armazenamento atual sem copiar arquivos.

```typescript
autosaveTemporarySite(
	slug?: string,
	options?: {
		updateUrl?: boolean;
		excludeFromPruning?: string[];
	}
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

### `keep(slug?, name?)`

<!--
Marks an autosaved Playground as an explicit saved Playground. This changes lifecycle metadata only. It does not copy files, change storage backends, or reboot the site.
-->

Marca um Playground com salvamento automático como um Playground salvo explicitamente. Isso só altera os metadados do ciclo de vida. Não copia arquivos, não troca o backend de armazenamento e não reinicia o site.

```typescript
keep(slug?: string, name?: string): Promise<void>;
```

### `saveInBrowser(name?)`

<!--
Persists the active temporary site to OPFS. When called on an autosaved site, it keeps that site as an explicit saved Playground.
-->

Salva o site temporário ativo no OPFS. Quando chamado em um site com salvamento automático, mantém esse site como um Playground salvo explicitamente.

```typescript
saveInBrowser(
	name?: string
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

### `saveToLocalFileSystem(name?, localFsHandle?)`

<!--
Persists the active temporary or autosaved site to a local directory. Prompts the user to pick a directory when `localFsHandle` is omitted. Requires the File System Access API, so availability depends on the browser and platform.
-->

Salva o site ativo, temporário ou com salvamento automático, em um diretório local. Pede ao usuário que escolha um diretório quando `localFsHandle` é omitido. Exige a File System Access API, então a disponibilidade depende do navegador e da plataforma.

```typescript
saveToLocalFileSystem(
	name?: string,
	localFsHandle?: FileSystemDirectoryHandle
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

<!-- ## Modifying a stored site -->

## Modificando um site armazenado {#modifying-a-stored-site}

<!--
These methods throw when called on a temporary site.
-->

Estes métodos lançam um erro quando chamados em um site temporário.

### `rename(newName, slug?)`

<!--
Renames the active site, or the site identified by `slug`.
-->

Renomeia o site ativo, ou o site identificado por `slug`.

```typescript
rename(newName: string, slug?: string): Promise<void>;
```

### `setPhpVersion(version)`

<!--
Changes the PHP version of the active stored site and reboots it. To pick a PHP version for a fresh site, pass `phpVersion` to `createNewTemporarySite()` or `createNewSavedSite()` instead.
-->

Altera a versão do PHP do site armazenado ativo e o reinicia. Para escolher a versão do PHP de um site novo, passe `phpVersion` para `createNewTemporarySite()` ou `createNewSavedSite()`.

```typescript
setPhpVersion(version: string): Promise<void>;
```

<!--
`version` accepts any value from the [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) union. The supported list evolves as PHP releases come and go — see the linked source for the current set.
-->

O `version` aceita qualquer valor da união [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts). A lista de versões suportadas muda conforme novas versões do PHP saem e antigas deixam de ser suportadas. Consulte o código-fonte do link para ver a lista atual.

### `setNetworking(enabled)`

<!--
Enables or disables outbound network access for the active stored site and reboots it.
-->

Ativa ou desativa o acesso de saída à rede no site armazenado ativo e o reinicia.

```typescript
setNetworking(enabled: boolean): Promise<void>;
```

### `updateRuntimeSettings(settings)`

<!--
Applies the runtime settings that can change on an existing stored Playground: PHP version and networking. If the settings already match, Playground reloads the current WordPress page.
-->

Aplica as configurações de runtime que podem mudar em um Playground armazenado existente: a versão do PHP e o acesso à rede. Se as configurações já forem iguais, o Playground recarrega a página atual do WordPress.

```typescript
updateRuntimeSettings(settings: {
	phpVersion: string;
	networking: boolean;
}): Promise<void>;
```

<!--
WordPress version, language, and multisite are installation settings. Create a fresh Playground when those need to change.
-->

A versão do WordPress, o idioma e o multisite são configurações de instalação. Crie um Playground novo quando precisar mudá-las.

### `delete(slug)`

<!--
Deletes a stored site and its persisted data. Throws if the site does not exist or is temporary.
-->

Exclui um site armazenado e os dados salvos dele. Lança um erro se o site não existir ou for temporário.

```typescript
delete(siteSlug: string): Promise<void>;
```

<!-- ## Next steps -->

## Próximos passos {#next-steps}

<!--
- [JavaScript API](/developers/apis/javascript-api/playground-api-client) — full reference for the `PlaygroundClient` returned by `getClient()`
- [Query API](/developers/apis/query-api) — the URL parameters that mirror new-site settings
- [Blueprints](/blueprints) — declarative site setup that runs when a site is created
-->

- [API JavaScript](/developers/apis/javascript-api/playground-api-client): referência completa do `PlaygroundClient` retornado por `getClient()`
- [Query API](/developers/apis/query-api): os parâmetros de URL que correspondem às configurações de um site novo
- [Blueprints](/blueprints): configuração declarativa do site, executada quando ele é criado
