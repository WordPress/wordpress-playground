---
title: Solução de problemas e depuração
slug: /blueprints/troubleshoot-and-debug
description: Um guia pesquisável para erros comuns de Blueprint, incluindo falhas de busca, erros de validação, falhas de PHP e problemas de ativação de plugins.
---

<!-- title: Troubleshoot and debug -->

<!-- description: A searchable guide to common Blueprint errors, including fetch failures, validation errors, PHP failures, and plugin activation issues. -->

<!-- # Troubleshoot and debug Blueprints -->

# Solução de problemas e depuração de Blueprints

<!-- Blueprint errors usually point to one of three places: -->

Erros de Blueprint geralmente apontam para um destes três lugares:

<!--
- The Blueprint JSON is invalid.
- Playground could not fetch the Blueprint or one of its resources.
- A Blueprint step ran, but WordPress, PHP, WP-CLI, or a plugin failed.
-->

- O JSON do Blueprint é inválido.
- O Playground não conseguiu buscar o Blueprint ou um dos recursos dele.
- Uma etapa do Blueprint foi executada, mas o WordPress, PHP, WP-CLI ou um plugin falhou.

<!--
Start with the exact error name shown by Playground, then use the matching
section below.
-->

Comece pelo nome exato do erro mostrado pelo Playground e use a seção
correspondente abaixo.

<!-- ## Quick checklist -->

## Lista de verificação rápida

<!--
- Paste the Blueprint into the [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to validate the JSON schema.
- If the Blueprint is loaded from a URL, open that URL directly in a private browser window and confirm it downloads valid JSON or a Blueprint ZIP bundle.
- If a step fails, note the step number in `BlueprintStepExecutionError`. The failed step is usually the item at that position after Blueprint shorthands have been expanded.
- Open browser developer tools and check the Console and Network tabs for download, CORS, PHP, or plugin activation details.
- For plugin/theme activation failures, check the Playground **Logs** panel or the browser console for PHP warnings and fatal errors.
-->

- Cole o Blueprint no [editor de Blueprints](https://playground.wordpress.net/builder/builder.html) para validar o esquema JSON.
- Se o Blueprint for carregado de uma URL, abra essa URL diretamente em uma janela privativa do navegador e confirme que ela baixa um JSON válido ou um pacote ZIP de Blueprint.
- Se uma etapa falhar, anote o número da etapa em `BlueprintStepExecutionError`. A etapa com falha normalmente é o item nessa posição depois que os atalhos de Blueprint são expandidos.
- Abra as ferramentas de desenvolvedor do navegador e verifique as abas Console e Network para detalhes de download, CORS, PHP ou ativação de plugins.
- Para falhas de ativação de plugin/tema, confira o painel **Logs** do Playground ou o console do navegador para avisos e erros fatais de PHP.

<!-- ## InvalidBlueprintError -->

## InvalidBlueprintError

<!--
`InvalidBlueprintError` means the Blueprint does not match the
[Blueprint data format](/blueprints/data-format). The error output usually
contains paths such as `/steps/2/pluginData` or `/preferredVersions`.
-->

`InvalidBlueprintError` significa que o Blueprint não corresponde ao
[formato de dados do Blueprint](/blueprints/data-format). A saída do erro
normalmente contém caminhos como `/steps/2/pluginData` ou `/preferredVersions`.

<!-- ### Unexpected property `activate` -->

### Propriedade inesperada `activate`

<!--
`activate` belongs inside `options`, not directly on the step or inside
`pluginData`.
-->

`activate` deve ficar dentro de `options`, não diretamente na etapa nem dentro
de `pluginData`.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Unexpected property `plugins` in `preferredVersions` -->

### Propriedade inesperada `plugins` em `preferredVersions`

<!--
`preferredVersions` only accepts `php` and `wp`. Install plugins with the
top-level `plugins` shorthand or with an explicit `installPlugin` step.
-->

`preferredVersions` aceita somente `php` e `wp`. Instale plugins com o atalho
`plugins` no nível superior ou com uma etapa explícita `installPlugin`.

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"]
}
```

<!-- ### Missing `slug`, `url`, `path`, or `files` -->

### `slug`, `url`, `path` ou `files` ausente

<!-- The resource object is incomplete or uses the wrong shape. Common fixes: -->

O objeto de recurso está incompleto ou usa o formato errado. Correções comuns:

<!--
- WordPress.org plugin: `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- ZIP URL: `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Git directory: `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`
-->

- Plugin do WordPress.org: `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- URL de ZIP: `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Diretório Git: `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`

<!--
See [Resources References](/blueprints/steps/resources) for all supported
resource shapes.
-->

Consulte [Referências de recursos](/blueprints/steps/resources) para ver todos
os formatos de recurso compatíveis.

<!-- ### Mixed plugin install properties -->

### Propriedades mistas de instalação de plugin

<!--
Use `pluginData` for `installPlugin`. Do not provide both `pluginData` and
older examples or custom objects such as `pluginZipFile`.
-->

Use `pluginData` para `installPlugin`. Não forneça `pluginData` junto com
exemplos antigos ou objetos personalizados como `pluginZipFile`.

<!-- The WordPress.org plugin resource also needs a separate `slug`: -->

O recurso de plugin do WordPress.org também precisa de um `slug` separado:

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	}
}
```

<!-- Do not write `"resource": "wordpress.org/plugins/woocommerce"`. -->

Não escreva `"resource": "wordpress.org/plugins/woocommerce"`.

<!-- ## BlueprintFetchError -->

## BlueprintFetchError

<!--
`BlueprintFetchError` means Playground could not load the file passed to
`?blueprint-url=`.
-->

`BlueprintFetchError` significa que o Playground não conseguiu carregar o arquivo
passado para `?blueprint-url=`.

<!-- Check that the URL: -->

Verifique se a URL:

<!--
- Is public and does not require cookies, login, a temporary session, or a VPN.
- Returns HTTP 200 when opened directly.
- Serves valid JSON or a ZIP bundle with `blueprint.json` inside it.
- Sends `Access-Control-Allow-Origin: *` or another header that allows
  `https://playground.wordpress.net`.
- Uses a raw file URL, not a repository HTML page.
-->

- É pública e não exige cookies, login, sessão temporária ou VPN.
- Retorna HTTP 200 quando aberta diretamente.
- Serve JSON válido ou um pacote ZIP com `blueprint.json` dentro.
- Envia `Access-Control-Allow-Origin: *` ou outro cabeçalho que permita
  `https://playground.wordpress.net`.
- Usa uma URL de arquivo bruto, não uma página HTML de repositório.

<!--
For GitHub, use `raw.githubusercontent.com` URLs instead of `github.com/.../blob/...`.
For GitLab, use the raw file URL instead of a `/-/blob/` page.
-->

Para GitHub, use URLs `raw.githubusercontent.com` em vez de `github.com/.../blob/...`.
Para GitLab, use a URL de arquivo bruto em vez de uma página `/-/blob/`.

```text
# Good
https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/welcome/blueprint.json

# Not a raw JSON response
https://github.com/WordPress/blueprints/blob/trunk/blueprints/welcome/blueprint.json
```

<!--
Temporary tunnel URLs, local development URLs, and draft release assets often
fail because the browser cannot reach them or because they do not allow
cross-origin requests. Move the Blueprint to a public host with CORS enabled.
-->

URLs temporárias de túnel, URLs de desenvolvimento local e assets de lançamento
em rascunho costumam falhar porque o navegador não consegue acessá-los ou
porque eles não permitem requisições de origem cruzada. Mova o Blueprint para
um host público com CORS ativado.

<!-- ### Blueprint file is neither a valid JSON nor a ZIP file -->

### O arquivo de Blueprint não é JSON válido nem arquivo ZIP

<!--
This means Playground received a response, but the response was not a Blueprint.
The URL may have returned an HTML page, 404 page, repository file viewer, proxy
warning, login page, or corrupted ZIP.
-->

Isso significa que o Playground recebeu uma resposta, mas ela não era um
Blueprint. A URL pode ter retornado uma página HTML, página 404, visualizador
de arquivo de repositório, aviso de proxy, página de login ou ZIP corrompido.

<!-- Open the URL directly and check that: -->

Abra a URL diretamente e verifique se:

<!--
- JSON URLs return valid Blueprint JSON.
- ZIP bundle URLs download a real ZIP archive.
- Blueprint bundles contain `blueprint.json` at the root of the ZIP.
- The response is not a small HTML or text error page.
-->

- URLs JSON retornam JSON de Blueprint válido.
- URLs de pacote ZIP baixam um arquivo ZIP real.
- Pacotes de Blueprint contêm `blueprint.json` na raiz do ZIP.
- A resposta não é uma pequena página HTML ou texto de erro.

<!-- ### URIError: URI malformed -->

### URIError: URI malformed

<!--
`URIError: URI malformed` usually points to a broken encoded Blueprint fragment
in the URL, not to a failed Blueprint step. Check for invalid `%` escapes,
double-encoded fragments, or raw JSON pasted after `#`. Rebuild the link from
the original Blueprint and encode it once, or use Base64. See
[Encoded Blueprint fragments](/blueprints/using-blueprints).
-->

`URIError: URI malformed` normalmente aponta para um fragmento de Blueprint
codificado incorretamente na URL, não para uma etapa de Blueprint com falha.
Verifique escapes `%` inválidos, fragmentos codificados duas vezes ou JSON bruto
colado depois de `#`. Reconstrua o link a partir do Blueprint original e
codifique-o uma vez, ou use Base64. Consulte
[Fragmentos de Blueprint codificados](/blueprints/using-blueprints).

<!-- ## ResourceDownloadError -->

## ResourceDownloadError

<!--
`ResourceDownloadError` means the Blueprint loaded, but a step could not download
a resource such as a plugin ZIP, theme ZIP, WXR file, or imported site archive.
-->

`ResourceDownloadError` significa que o Blueprint carregou, mas uma etapa não
conseguiu baixar um recurso, como um ZIP de plugin, ZIP de tema, arquivo WXR ou
arquivo de site importado.

<!-- Confirm the resource URL: -->

Confirme se a URL do recurso:

<!--
- Downloads the actual file, not an HTML page, redirect warning, or expired artifact.
- Is public and does not require authentication.
- Allows cross-origin requests.
- Is the direct file URL. Some release pages and CI artifact pages are human pages, not direct downloads.
- Still exists. Temporary links and CI artifacts can expire.
-->

- Baixa o arquivo real, não uma página HTML, aviso de redirecionamento ou artefato expirado.
- É pública e não exige autenticação.
- Permite requisições de origem cruzada.
- É a URL direta do arquivo. Algumas páginas de release e de artefatos de CI são páginas para pessoas, não downloads diretos.
- Ainda existe. Links temporários e artefatos de CI podem expirar.

<!--
For source code in a Git repository, prefer a
[`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference).
Use a `url` resource for built ZIP artifacts that are already publicly
downloadable.
-->

Para código-fonte em um repositório Git, prefira um
[recurso `git:directory`](/blueprints/steps/resources#gitdirectoryreference).
Use um recurso `url` para artefatos ZIP criados e já disponíveis publicamente
para download.

<!-- ## BlueprintStepExecutionError -->

## BlueprintStepExecutionError

<!--
`BlueprintStepExecutionError` means a specific step failed after the Blueprint
started running. The message includes a step number:
-->

`BlueprintStepExecutionError` significa que uma etapa específica falhou depois
que o Blueprint começou a ser executado. A mensagem inclui um número de etapa:

```text
BlueprintStepExecutionError: Error when executing the blueprint step #4
```

<!--
Use that number to inspect the matching step. If your Blueprint uses shorthands
such as `plugins`, `login`, `siteOptions`, or `constants`, Playground expands
them into steps before running the Blueprint. Use explicit `steps` when the
order matters.
-->

Use esse número para inspecionar a etapa correspondente. Se o Blueprint usa
atalhos como `plugins`, `login`, `siteOptions` ou `constants`, o Playground os
expande em etapas antes de executar o Blueprint. Use `steps` explícitas quando
a ordem for importante.

<!--
URL query parameters such as `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...`, and `?networking=yes` also create an implicit Blueprint. Errors from
those URLs are still Blueprint execution errors, and the generated steps affect
the reported step number.
-->

Parâmetros de consulta de URL como `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...` e `?networking=yes` também criam um Blueprint implícito. Erros dessas
URLs ainda são erros de execução de Blueprint, e as etapas geradas afetam o
número de etapa informado.

<!-- ## PHP.run() failed with exit code 255 -->

## PHP.run() failed with exit code 255

<!--
Exit code `255` usually means PHP hit a fatal error. Look for the first
`Fatal error`, `Uncaught`, or `TypeError` line in the output. The large HTML
error page around it is usually WordPress's generic critical error screen.
-->

O código de saída `255` normalmente significa que o PHP encontrou um erro fatal.
Procure a primeira linha `Fatal error`, `Uncaught` ou `TypeError` na saída. A
grande página HTML de erro ao redor dela costuma ser a tela genérica de erro
crítico do WordPress.

<!--
To make the output more useful while debugging, enable WordPress debug constants
near the beginning of the Blueprint:
-->

Para tornar a saída mais útil durante a depuração, ative as constantes de
depuração do WordPress perto do início do Blueprint:

```json
{
	"step": "defineWpConfigConsts",
	"consts": {
		"WP_DEBUG": true,
		"WP_DEBUG_LOG": true,
		"WP_DEBUG_DISPLAY": true,
		"WP_DISABLE_FATAL_ERROR_HANDLER": true
	}
}
```

<!--
Then rerun the Blueprint and check the Playground **Logs** panel or browser
console.
-->

Depois execute o Blueprint novamente e confira o painel **Logs** do Playground
ou o console do navegador.

<!-- ## PHP.run() failed with exit code 1 -->

## PHP.run() failed with exit code 1

<!--
Exit code `1` often appears when WP-CLI or WordPress returns an application
error. Read the `Stderr` section first. It usually names the unsupported
argument, missing resource, or command-specific failure.
-->

O código de saída `1` costuma aparecer quando o WP-CLI ou o WordPress retorna
um erro da aplicação. Leia primeiro a seção `Stderr`. Ela normalmente informa o
argumento sem suporte, o recurso ausente ou a falha específica do comando.

<!--
Some WP-CLI commands behave differently in Playground because WordPress runs in
WebAssembly with SQLite. Keep commands small and test them individually before
adding a long chain to a Blueprint.
-->

Alguns comandos WP-CLI se comportam de forma diferente no Playground porque o
WordPress é executado em WebAssembly com SQLite. Mantenha os comandos pequenos
e teste-os individualmente antes de adicionar uma cadeia longa a um Blueprint.

<!-- ## Undefined constant `ABSPATH` -->

## Undefined constant `ABSPATH`

<!--
This usually happens in a `runPHP` step that calls WordPress APIs without first
loading WordPress.
-->

Isso normalmente acontece em uma etapa `runPHP` que chama APIs do WordPress sem
antes carregar o WordPress.

<!-- Add `wp-load.php` before any WordPress function, constant, option, or plugin API: -->

Adicione `wp-load.php` antes de qualquer função, constante, opção ou API de
plugin do WordPress:

```json
{
	"step": "runPHP",
	"code": "<?php require '/wordpress/wp-load.php'; update_option('blogname', 'Demo site');"
}
```

<!-- ## Plugin could not be activated -->

## Plugin could not be activated

<!--
Plugin activation errors usually come from the plugin itself, not from the
Blueprint runner. Common causes:
-->

Erros de ativação de plugin geralmente vêm do próprio plugin, não do executor
de Blueprints. Causas comuns:

<!--
- The plugin requires a newer PHP version or WordPress version.
- The plugin has a fatal error on activation.
- The plugin depends on another plugin that is not installed or activated.
- The plugin performs a redirect or prints unexpected output during activation.
- The plugin ZIP extracts to a folder or main file name different from the path the step is activating.
-->

- O plugin exige uma versão mais recente do PHP ou do WordPress.
- O plugin tem um erro fatal na ativação.
- O plugin depende de outro plugin que não está instalado ou ativado.
- O plugin faz um redirecionamento ou imprime uma saída inesperada durante a ativação.
- O ZIP do plugin é extraído para uma pasta ou arquivo principal com nome diferente do caminho que a etapa está ativando.

<!--
If the error says the current PHP or WordPress version does not meet minimum
requirements, set `preferredVersions`:
-->

Se o erro disser que a versão atual do PHP ou do WordPress não atende aos
requisitos mínimos, defina `preferredVersions`:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

<!-- ### WordPress exited with exit code 0 -->

### WordPress exited with exit code 0

<!--
Activation can fail even when WordPress exits with code `0`. This usually means
WordPress returned an activation error response rather than a PHP process crash.
When the message says `Inspect the "debug" logs`, check the Playground **Logs**
panel, browser console, or CLI output.
-->

A ativação pode falhar mesmo quando o WordPress sai com código `0`. Isso
normalmente significa que o WordPress retornou uma resposta de erro de ativação,
em vez de uma falha do processo PHP. Quando a mensagem disser
`Inspect the "debug" logs`, verifique o painel **Logs** do Playground, o console
do navegador ou a saída da CLI.

<!--
Look for PHP warnings, redirects or output printed during activation, missing
dependency plugins, or plugin minimum PHP/WordPress requirements.
-->

Procure avisos de PHP, redirecionamentos ou saída impressa durante a ativação,
plugins de dependência ausentes ou requisitos mínimos de PHP/WordPress do plugin.

<!-- ### Current PHP or WordPress version does not meet minimum requirements -->

### Current PHP or WordPress version does not meet minimum requirements

<!-- Version mismatch errors often include text like: -->

Erros de incompatibilidade de versão costumam incluir textos como:

```text
Current PHP version (7.4.33) does not meet minimum requirements. The plugin requires PHP 8.0.
```

<!-- or: -->

ou:

```text
Current WordPress version (6.9.4) does not meet minimum requirements. The plugin requires WordPress 7.0.
```

<!--
Set `preferredVersions` to a compatible PHP and WordPress version, or use a
plugin/theme release that supports the versions available in Playground.
-->

Defina `preferredVersions` para uma versão compatível de PHP e WordPress, ou
use uma versão do plugin/tema compatível com as versões disponíveis no Playground.

<!-- If the error is: -->

Se o erro for:

```text
Failed to download WordPress 6.9.0 (HTTP 404)
```

<!--
the requested WordPress build is not available. Use `latest`, a supported
released version, or a supported beta/nightly value.
-->

a compilação solicitada do WordPress não está disponível. Use `latest`, uma versão
lançada compatível ou um valor beta/nightly compatível.

<!--
If the error says `Plugin file does not exist`, inspect the installed folder
name. For ZIP URLs with unusual folder names, set `targetFolderName`:
-->

Se o erro disser `Plugin file does not exist`, inspecione o nome da pasta
instalada. Para URLs ZIP com nomes de pasta incomuns, defina `targetFolderName`:

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "url",
		"url": "https://example.com/my-plugin.zip"
	},
	"options": {
		"activate": true,
		"targetFolderName": "my-plugin"
	}
}
```

<!--
If the plugin has dependencies, install and activate those dependencies first
with explicit steps.
-->

Se o plugin tiver dependências, instale e ative essas dependências primeiro com
etapas explícitas.

<!-- ## Theme could not be activated -->

## Theme could not be activated

<!--
Theme activation failures usually mean the theme folder name is wrong, the
theme ZIP extracted to an unexpected directory, or the theme code caused a
WordPress/PHP error.
-->

Falhas de ativação de tema geralmente significam que o nome da pasta do tema
está errado, que o ZIP do tema foi extraído para um diretório inesperado ou que
o código do tema causou um erro do WordPress/PHP.

<!-- Use `installTheme` with `options.activate` when installing a theme: -->

Use `installTheme` com `options.activate` ao instalar um tema:

```json
{
	"step": "installTheme",
	"themeData": {
		"resource": "wordpress.org/themes",
		"slug": "twentytwentyfour"
	},
	"options": {
		"activate": true
	}
}
```

<!--
If you use a standalone `activateTheme` step, pass the folder name inside
`wp-content/themes`, not a full URL or ZIP filename.
-->

Se você usar uma etapa independente `activateTheme`, passe o nome da pasta
dentro de `wp-content/themes`, não uma URL completa ou o nome do arquivo ZIP.

<!-- ## Could not write to a file -->

## Could not write to a file

<!-- Errors like this mean the parent directory does not exist: -->

Erros como este significam que o diretório pai não existe:

```text
Could not write to "/wordpress/wp-content/plugins/example/index.php":
There is no such file or directory OR the parent directory does not exist.
```

<!--
Create the directory first with `mkdir`, or use `writeFiles` with a
`literal:directory` resource.
-->

Crie o diretório primeiro com `mkdir` ou use `writeFiles` com um recurso
`literal:directory`.

```json
[
	{
		"step": "mkdir",
		"path": "/wordpress/wp-content/plugins/example"
	},
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/plugins/example/index.php",
		"data": "<?php /* Plugin Name: Example */"
	}
]
```

<!-- ## Could not unzip file -->

## Could not unzip file

<!--
This usually means the file is not a valid ZIP archive. The URL may have
returned an HTML page, an error response, a login page, or a truncated file.
-->

Isso normalmente significa que o arquivo não é um ZIP válido. A URL pode ter
retornado uma página HTML, uma resposta de erro, uma página de login ou um
arquivo truncado.

<!--
If the output says `Could not unzip file. Error code: 19`, verify the download
is a ZIP archive. A small file size often means the server returned an HTML
error page instead of the archive.
-->

Se a saída disser `Could not unzip file. Error code: 19`, verifique se o
download é um arquivo ZIP. Um tamanho de arquivo pequeno costuma significar que
o servidor retornou uma página HTML de erro em vez do arquivo.

<!--
Open the URL directly and confirm the browser downloads a ZIP. If you are using
a GitHub or CI artifact, use a direct-download URL and make sure the release or
artifact is public.
-->

Abra a URL diretamente e confirme que o navegador baixa um ZIP. Se você estiver
usando um artefato do GitHub ou de CI, use uma URL de download direto e garanta
que a release ou o artefato seja público.

<!-- ## WP-CLI command pitfalls -->

## Armadilhas de comandos WP-CLI

<!--
The `wp-cli` step runs WP-CLI inside Playground. It is useful for setup tasks,
but not every command or shell feature behaves like a local terminal.
-->

A etapa `wp-cli` executa o WP-CLI dentro do Playground. Ela é útil para tarefas
de configuração, mas nem todo comando ou recurso de shell se comporta como em
um terminal local.

<!-- Common fixes: -->

Correções comuns:

<!--
- Use the step name `"wp-cli"`, not `"wpcli"` or `"cli"`.
- Keep commands focused. Prefer multiple `wp-cli` steps over one complex shell command.
- Avoid shell substitutions such as `$(...)` in shared Blueprints. Use `runPHP` for logic that needs WordPress APIs.
- Check parameter names against the WP-CLI command you are using. For example, command-specific parameters may differ between `wp post list`, `wp post delete`, and plugin-provided commands.
- If a plugin-provided WP-CLI command fails with a plugin stack trace, the fix usually belongs in that plugin or in the input data passed to the command.
- If a command fails with `unknown --post_type parameter` or `unknown --format parameter`, check whether the flags belong to a different command in the pipeline.
- If a plugin command fails with `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirm the plugin is active, the imported data exists, and the command input points to a valid resource.
-->

- Use o nome de etapa `"wp-cli"`, não `"wpcli"` nem `"cli"`.
- Mantenha os comandos focados. Prefira várias etapas `wp-cli` em vez de um comando de shell complexo.
- Evite substituições de shell como `$(...)` em Blueprints compartilhados. Use `runPHP` para lógica que precisa das APIs do WordPress.
- Confira os nomes dos parâmetros no comando WP-CLI que você está usando. Por exemplo, parâmetros específicos podem diferir entre `wp post list`, `wp post delete` e comandos fornecidos por plugins.
- Se um comando WP-CLI fornecido por plugin falhar com um stack trace do plugin, a correção normalmente pertence a esse plugin ou aos dados de entrada passados ao comando.
- Se um comando falhar com `unknown --post_type parameter` ou `unknown --format parameter`, verifique se as flags pertencem a outro comando no pipeline.
- Se um comando de plugin falhar com `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirme que o plugin está ativo, os dados importados existem e a entrada do comando aponta para um recurso válido.

<!-- ## WP-CLI: Error establishing a database connection on mounted sites -->

## WP-CLI: Error establishing a database connection on mounted sites

<!--
When using `wp-cli` with a mounted Playground site, for example via
`--mount-before-install`, you might encounter an "Error establishing a database
connection." This happens because WordPress Playground loads the SQLite database
integration plugin from its internal files by default, not from the mounted
directory.
-->

Ao usar `wp-cli` com um site Playground montado, por exemplo via
`--mount-before-install`, você pode encontrar "Error establishing a database
connection." Isso acontece porque o WordPress Playground carrega o plugin de
integração de banco de dados SQLite a partir de seus arquivos internos por
padrão, não do diretório montado.

<!-- Add the SQLite integration plugin to the mounted WordPress site explicitly: -->

Adicione explicitamente o plugin de integração SQLite ao site WordPress montado:

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

<!-- Then run the Blueprint with the mounted site: -->

Depois execute o Blueprint com o site montado:

```bash
mkdir wordpress
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
```

<!-- ## Debugging tools -->

## Ferramentas de depuração

<!-- ### Blueprints editor -->

### Editor de Blueprints

<!--
Use the in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html)
to build, validate, and preview Blueprints.
-->

Use o [editor de Blueprints](https://playground.wordpress.net/builder/builder.html)
no navegador para criar, validar e pré-visualizar Blueprints.

<!-- :::danger Caution -->

:::danger Atenção

<!--
The editor is under development and the embedded Playground sometimes fails to
load. To get around it, refresh the page.
-->

O editor está em desenvolvimento e o Playground incorporado às vezes falha ao
carregar. Para contornar isso, atualize a página.

:::

<!-- ### Filesystem and database inspection -->

### Inspeção do sistema de arquivos e do banco de dados

<!--
Some Blueprint steps, such as [`writeFile`](/blueprints/steps),
alter the internal filesystem. Others, such as
[`runSql`](/blueprints/steps), alter the database.
-->

Algumas etapas de Blueprint, como [`writeFile`](/blueprints/steps),
alteram o sistema de arquivos interno. Outras, como
[`runSql`](/blueprints/steps), alteram o banco de dados.

<!--
To inspect the final state, install plugins such as
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and
[`WPide`](https://wordpress.org/plugins/wpide/). You can see them in action at
https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.
-->

Para inspecionar o estado final, instale plugins como
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) e
[`WPide`](https://wordpress.org/plugins/wpide/). Você pode vê-los em ação em
https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.

<!--
You can also inspect a Playground instance from the browser console through
`window.playground`:
-->

Você também pode inspecionar uma instância do Playground pelo console do
navegador usando `window.playground`:

```js
await playground.isDir('/wordpress/wp-content/plugins');
await playground.listFiles('/wordpress/wp-content/plugins');
```

<!-- See the full [PlaygroundClient API](/api/client/interface/PlaygroundClient). -->

Consulte a [API PlaygroundClient](/api/client/interface/PlaygroundClient) completa.

<!-- ### Browser console and network requests -->

### Console do navegador e requisições de rede

<!--
Open browser developer tools to check JavaScript errors, PHP debug logs, and
failed network requests. In Chrome, Firefox, and Edge, press
`Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

Abra as ferramentas de desenvolvedor do navegador para verificar erros de
JavaScript, logs de depuração de PHP e requisições de rede com falha. No Chrome,
Firefox e Edge, pressione `Ctrl + Shift + I` no Windows/Linux ou
`Cmd + Option + I` no macOS.

<!-- :::caution Safari -->

:::caution Safari

<!--
If you have not enabled the Develop menu, go to **Safari > Settings... >
Advanced** and check **Show features for web developers**.
-->

Se você ainda não ativou o menu Develop, acesse **Safari > Settings... >
Advanced** e marque **Show features for web developers**.

:::

<!-- ### Custom error logging -->

### Registro de erros personalizado

<!--
You can write your own messages with `error_log()` in a
[`runPHP` step](/blueprints/steps), then check the Playground
**Logs** panel or the browser console.
-->

Você pode gravar suas próprias mensagens com `error_log()` em uma etapa
[`runPHP`](/blueprints/steps) e depois conferir o painel **Logs** do Playground
ou o console do navegador.

<!-- ![Log errors snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp) -->

![Captura de logs de erro](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

<!--
:::info
When you download your Playground instance as a ZIP through the
["Download as zip"](/web-instance) option, the archive
also includes `debug.log`.
:::
-->

:::info
Ao baixar sua instância do Playground como ZIP pela opção
["Download as zip"](/web-instance), o arquivo também inclui `debug.log`.
:::

<!-- ## Ask for help -->

## Peça ajuda

<!--
If you need help, [open an issue](https://github.com/WordPress/wordpress-playground/issues)
and include:
-->

Se você precisar de ajuda, [abra uma issue](https://github.com/WordPress/wordpress-playground/issues)
e inclua:

<!--
- The Blueprint JSON or the public Blueprint URL.
- The exact error message.
- The failing step number, if shown.
- Browser, operating system, and whether you used the website, JavaScript API, or CLI.
- Relevant console, network, or CLI output.
-->

- O JSON do Blueprint ou a URL pública do Blueprint.
- A mensagem de erro exata.
- O número da etapa com falha, se mostrado.
- Navegador, sistema operacional e se você usou o site, a API JavaScript ou a CLI.
- Saída relevante do console, da rede ou da CLI.
