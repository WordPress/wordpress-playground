---
title: Fornecer conteúdo para sua demonstração com o Playground
slug: /guides/providing-content-for-your-demo
description: Aprenda a preencher sua demonstração do Playground com conteúdo usando Blueprints, WP-CLI ou PHP para apresentar temas e plugins.
---

<!--
One of the things you may want to do to provide a good demo with WordPress
Playground is to load default content to better highlight the features of your
plugin or theme. This default content may include images or other assets.

There are several [Blueprint steps](/blueprints/steps) and strategies you can
use to import content (or generate it) in the Playground instance. This guide
walks through the available sources. For a focused comparison of XML, PHP, and
ZIP imports—including pros, cons, and measured performance—see
[Importing content into WordPress with Blueprints](/guides/import-content-with-blueprints).
-->

Uma das coisas que você pode fazer para oferecer uma boa demonstração com o
WordPress Playground é carregar conteúdo padrão que destaque melhor os recursos
do seu plugin ou tema. Esse conteúdo pode incluir imagens ou outros recursos.

Há vários [passos de Blueprint](/blueprints/steps) e estratégias para importar
conteúdo (ou gerá-lo) na instância do Playground. Este guia apresenta as fontes
disponíveis. Para uma comparação específica das importações XML, PHP e ZIP,
incluindo vantagens, desvantagens e desempenho medido, consulte
[Importando conteúdo para o WordPress com Blueprints](/guides/import-content-with-blueprints).

## `importWxr`

<!--
With the [`importWxr` step](/blueprints/steps), you can import content from a
WordPress eXtended RSS (WXR) `.xml` file previously
[exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/).

The step can fetch attachments, rewrite URLs, include or exclude comments, and
control how imported authors map to local users. This example assigns imported
content to the existing `admin` user and leaves attachment downloads disabled:
-->

Com o [passo `importWxr`](/blueprints/steps), você pode importar conteúdo de um
arquivo `.xml` WordPress eXtended RSS (WXR) previamente
[exportado de uma instalação existente do WordPress](https://wordpress.org/documentation/article/tools-export-screen/).

O passo pode obter anexos, reescrever URLs, incluir ou excluir comentários e
controlar como os autores importados são mapeados para usuários locais. Este
exemplo atribui o conteúdo importado ao usuário `admin` existente e mantém
desativado o download de anexos:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": true,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

<!--
Set `authorsMode` to `create` to create local users for imported authors, or to
`map` and provide `authorsMap` when the corresponding users already exist. You
can also provide `urlMapping` for explicit old-to-new URL replacements.

To download the media referenced by the export, set `fetchAttachments` to
`true` and enable Blueprint networking. The original media URLs must still be
available:
-->

Defina `authorsMode` como `create` para criar usuários locais para os autores
importados ou como `map` e forneça `authorsMap` quando os usuários
correspondentes já existirem. Você também pode fornecer `urlMapping` para
substituições explícitas de URLs antigas por novas.

Para baixar a mídia referenciada pela exportação, defina `fetchAttachments` como
`true` e ative a rede do Blueprint. As URLs de mídia originais ainda precisam
estar disponíveis:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://example.com/wordpress-export.xml"
			},
			"fetchAttachments": true
		}
	]
}
```

<div class="callout callout-info">

<!--
When the original attachment URLs are unavailable, one approach is to upload
the images to the repository that hosts the Blueprint and replace their paths
in the exported `.xml` file. For a public GitHub repository, use a raw URL such
as `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.
-->

Quando as URLs originais dos anexos não estiverem disponíveis, uma opção é
enviar as imagens ao repositório que hospeda o Blueprint e substituir os
caminhos no arquivo `.xml` exportado. Em um repositório público do GitHub, use
uma URL bruta como
`https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

</div>

<!--
For a self-contained demo, place the exported `.xml` file and its assets next
to `blueprint.json` in a [Blueprint bundle](/blueprints/bundles), and use a
[`bundled` resource](/blueprints/steps/resources) instead of a remote URL.
-->

Para uma demonstração autocontida, coloque o arquivo `.xml` exportado e seus
recursos ao lado de `blueprint.json` em um
[pacote de Blueprint](/blueprints/bundles) e use um
[recurso `bundled`](/blueprints/steps/resources) em vez de uma URL remota.

## `importWordPressFiles`

<!--
With the [`importWordPressFiles` step](/blueprints/steps), you can restore the
top-level WordPress files from a `.zip` file into the instance's root folder.
For example, if an archive contains `wp-content` and `wp-includes`, those
directories replace the corresponding directories in Playground.

The ZIP can be created from a Playground instance with the **Download as zip**
option in the [Playground Options Menu](/web-instance).
Current Playground exports include a manifest that lets the import step update
Playground scope URLs after restoration.

You can prepare a demo for your WordPress theme or plugin—including the
database, images, plugins, themes, and settings—in a Playground instance and
then export a snapshot of that demo. The snapshot can be restored later using
`importWordPressFiles`. This example expects `site.zip` next to `blueprint.json`
in a [Blueprint bundle](/blueprints/bundles):
-->

Com o [passo `importWordPressFiles`](/blueprints/steps), você pode restaurar os
arquivos WordPress de nível superior de um arquivo `.zip` na pasta raiz da
instância. Por exemplo, se um arquivo contiver `wp-content` e `wp-includes`,
esses diretórios substituirão os correspondentes no Playground.

O ZIP pode ser criado a partir de uma instância do Playground com a opção
**Download as zip** no [menu de opções do Playground](/web-instance). As
exportações atuais incluem um manifesto que permite atualizar as URLs de escopo
do Playground após a restauração.

Você pode preparar uma demonstração do seu tema ou plugin WordPress, incluindo
banco de dados, imagens, plugins, temas e configurações, em uma instância do
Playground e exportar um snapshot. O snapshot pode ser restaurado depois com
`importWordPressFiles`. Este exemplo espera encontrar `site.zip` ao lado de
`blueprint.json` em um [pacote de Blueprint](/blueprints/bundles):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The step can detect a complete WordPress directory inside a wrapper folder. If
an archive contains more than one site or needs an explicit starting directory,
set `pathInZip` to the directory that contains the WordPress files. Keep the
source and destination WordPress, PHP, theme, and plugin versions compatible,
and only restore ZIP files from sources you trust because they can contain an
entire database and executable PHP.
-->

O passo pode detectar um diretório WordPress completo dentro de uma pasta
externa. Se um arquivo contiver mais de um site ou precisar de um diretório
inicial explícito, defina `pathInZip` como o diretório que contém os arquivos
WordPress. Mantenha compatíveis as versões do WordPress, PHP, tema e plugin na
origem e no destino. Restaure apenas arquivos ZIP de fontes confiáveis, pois eles
podem conter um banco de dados inteiro e PHP executável.

## `importThemeStarterContent`

<!--
[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
that can be published to highlight the features of a theme.

With the [`importThemeStarterContent` step](/blueprints/steps), you can publish
the starter content of any installed theme, even if that theme is not activated
in the Playground instance:
-->

[Alguns temas têm conteúdo inicial](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
que pode ser publicado para destacar seus recursos.

Com o [passo `importThemeStarterContent`](/blueprints/steps), você pode publicar
o conteúdo inicial de qualquer tema instalado, mesmo que ele não esteja ativo
na instância do Playground:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwentyone"
			},
			"options": {
				"activate": true
			}
		},
		{
			"step": "importThemeStarterContent",
			"themeSlug": "twentytwenty"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

<!--
You can also publish the starter content of a theme while installing it with the
[`installTheme` step](/blueprints/steps) by setting its `importStarterContent`
option to `true`:
-->

Você também pode publicar o conteúdo inicial de um tema durante sua instalação
com o [passo `installTheme`](/blueprints/steps), definindo a opção
`importStarterContent` como `true`:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			},
			"options": {
				"activate": true,
				"importStarterContent": true
			}
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

## `wp-cli`

<!--
Another way of generating content for your theme or plugin is the
[`wp-cli` step](/blueprints/steps). It runs
[WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as
[`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):
-->

Outra forma de gerar conteúdo para seu tema ou plugin é o
[passo `wp-cli`](/blueprints/steps). Ele executa
[comandos WP-CLI](https://developer.wordpress.org/cli/commands/) como
[`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "wp-cli",
			"command": "wp post generate --count=20 --post_type=post --post_date=1999-01-04"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})

<!--
You can also combine the `wp-cli` step with the
[`writeFile` step](/blueprints/steps) to create posts from existing content and
import images into the Playground instance:
-->

Você também pode combinar o passo `wp-cli` com o
[passo `writeFile`](/blueprints/steps) para criar posts a partir de conteúdo
existente e importar imagens na instância do Playground:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/?p=4",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/postcontent.md",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp post create --post_title='Welcome to Playground' --post_status='published' /wordpress/wp-content/postcontent.md"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/Select-storage-method.png",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp media import wordpress/wp-content/Select-storage-method.png --post_id=4 --title='Select your storage method' --featured_image"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})

<div class="callout callout-tip">

<!--
Check the
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
example from the
[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
to see the full example showing the connection between the content and the
featured image.
-->

Confira o exemplo
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
da [galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
para ver a conexão entre o conteúdo e a imagem destacada.

</div>

## `runPHP`

<!--
With the [`runPHP` step](/blueprints/steps), you can run PHP code to insert or
configure data in your WordPress installation, for example with the
[`wp_insert_post` function](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Load `/wordpress/wp-load.php` before calling WordPress APIs, and handle errors
so a failed setup does not silently produce an incomplete demo:
-->

Com o [passo `runPHP`](/blueprints/steps), você pode executar código PHP para
inserir ou configurar dados na instalação do WordPress, por exemplo com a
[função `wp_insert_post`](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Carregue `/wordpress/wp-load.php` antes de chamar as APIs do WordPress e trate os
erros para que uma falha de configuração não gere silenciosamente uma
demonstração incompleta:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\n$post_id = wp_insert_post(\n\tarray(\n\t\t'post_title'   => 'Simple post from PHP',\n\t\t'post_content' => '<!-- wp:paragraph --><p>This is a simple post inserted with wp_insert_post.</p><!-- /wp:paragraph -->',\n\t\t'post_author'  => 1,\n\t\t'post_status'  => 'publish',\n\t),\n\ttrue\n);\n\nif ( is_wp_error( $post_id ) ) {\n\tthrow new RuntimeException( $post_id->get_error_message() );\n}"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%5Cnrequire_once%20'/wordpress/wp-load.php'%3B%5Cn%5Cn$post_id%20=%20wp_insert_post(%5Cn%5Ctarray(%5Cn%5Ct%5Ct'post_title'%20%20%20=%3E%20'Simple%20post%20from%20PHP',%5Cn%5Ct%5Ct'post_content'%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post.%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%5Cn%5Ct%5Ct'post_author'%20%20=%3E%201,%5Cn%5Ct%5Ct'post_status'%20%20=%3E%20'publish',%5Cn%5Ct),%5Cn%5Cttrue%5Cn)%3B%5Cn%5Cnif%20(%20is_wp_error(%20$post_id%20)%20)%20{%5Cn%5Ctthrow%20new%20RuntimeException(%20$post_id-%3Eget_error_message()%20)%3B%5Cn}%22}]}>)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%5Cnrequire_once%20'/wordpress/wp-load.php'%3B%5Cn%5Cn$post_id%20=%20wp_insert_post(%5Cn%5Ctarray(%5Cn%5Ct%5Ct'post_title'%20%20%20=%3E%20'Simple%20post%20from%20PHP',%5Cn%5Ct%5Ct'post_content'%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post.%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%5Cn%5Ct%5Ct'post_author'%20%20=%3E%201,%5Cn%5Ct%5Ct'post_status'%20%20=%3E%20'publish',%5Cn%5Ct),%5Cn%5Cttrue%5Cn)%3B%5Cn%5Cnif%20(%20is_wp_error(%20$post_id%20)%20)%20{%5Cn%5Ctthrow%20new%20RuntimeException(%20$post_id-%3Eget_error_message()%20)%3B%5Cn}%22}]}>)

<!--
For small, deterministic fixtures, `runPHP` keeps setup logic close to the
Blueprint. For large editorial datasets or a complete prepared site, WXR or a
ZIP snapshot is usually easier to maintain. The
[import comparison guide](/guides/import-content-with-blueprints) explains the
trade-offs in detail.
-->

Para pequenos conjuntos de dados determinísticos, `runPHP` mantém a lógica de
configuração próxima ao Blueprint. Para grandes conjuntos de dados editoriais
ou um site completo já preparado, WXR ou um snapshot ZIP geralmente é mais
fácil de manter. O
[guia de comparação de importações](/guides/import-content-with-blueprints)
explica as vantagens e desvantagens em detalhes.
