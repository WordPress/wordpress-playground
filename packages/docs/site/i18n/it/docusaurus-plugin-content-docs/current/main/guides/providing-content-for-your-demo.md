---
title: Fornire contenuti per la tua demo con Playground
slug: /guides/providing-content-for-your-demo
description: Scopri come popolare la tua demo di Playground con contenuti usando Blueprint, WP-CLI o PHP per presentare temi e plugin.
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

Per creare una buona demo con WordPress Playground, puoi caricare contenuti
predefiniti che mettano meglio in evidenza le funzionalità del tuo plugin o
tema. Questi contenuti possono includere immagini o altre risorse.

Puoi usare diversi [passaggi Blueprint](/blueprints/steps) e strategie per
importare o generare contenuti nell’istanza Playground. Questa guida presenta le
fonti disponibili. Per un confronto mirato tra importazioni XML, PHP e ZIP,
inclusi vantaggi, svantaggi e prestazioni misurate, consulta
[Importazione di contenuti in WordPress con i Blueprint](/guides/import-content-with-blueprints).

## `importWxr`

<!--
With the [`importWxr` step](/blueprints/steps), you can import content from a
WordPress eXtended RSS (WXR) `.xml` file previously
[exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/).

The step can fetch attachments, rewrite URLs, include or exclude comments, and
control how imported authors map to local users. This example assigns imported
content to the existing `admin` user and leaves attachment downloads disabled:
-->

Con il [passaggio `importWxr`](/blueprints/steps) puoi importare contenuti da un
file `.xml` WordPress eXtended RSS (WXR) precedentemente
[esportato da un’installazione WordPress](https://wordpress.org/documentation/article/tools-export-screen/).

Il passaggio può recuperare gli allegati, riscrivere gli URL, includere o
escludere i commenti e controllare l’associazione degli autori importati agli
utenti locali. Questo esempio assegna i contenuti all’utente `admin` esistente e
lascia disabilitato il download degli allegati:

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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Visualizza <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

<!--
Set `authorsMode` to `create` to create local users for imported authors, or to
`map` and provide `authorsMap` when the corresponding users already exist. You
can also provide `urlMapping` for explicit old-to-new URL replacements.

To download the media referenced by the export, set `fetchAttachments` to
`true` and enable Blueprint networking. The original media URLs must still be
available:
-->

Imposta `authorsMode` su `create` per creare utenti locali per gli autori
importati, oppure su `map` e fornisci `authorsMap` se gli utenti esistono già.
Puoi anche fornire `urlMapping` per sostituire esplicitamente i vecchi URL.

Per scaricare i media indicati nell’esportazione, imposta `fetchAttachments` su
`true` e abilita la rete del Blueprint. Gli URL originali devono essere ancora
disponibili:

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

Se gli URL originali degli allegati non sono disponibili, puoi caricare le
immagini nel repository che ospita il Blueprint e sostituirne i percorsi nel
file `.xml` esportato. Per un repository GitHub pubblico, usa un URL raw come
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

Per una demo autonoma, posiziona il file `.xml` esportato e le relative risorse
accanto a `blueprint.json` in un [bundle Blueprint](/blueprints/bundles) e usa
una [risorsa `bundled`](/blueprints/steps/resources) invece di un URL remoto.

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

Con il [passaggio `importWordPressFiles`](/blueprints/steps) puoi ripristinare i
file WordPress di primo livello da un file `.zip` nella cartella radice
dell’istanza. Se l’archivio contiene `wp-content` e `wp-includes`, queste
directory sostituiscono quelle corrispondenti in Playground.

Puoi creare il file ZIP da un’istanza Playground con l’opzione **Download as
zip** nel [menu delle opzioni di Playground](/web-instance). Le esportazioni
attuali includono un manifesto che consente di aggiornare gli URL di ambito dopo
il ripristino.

Puoi preparare una demo del tuo tema o plugin WordPress, inclusi database,
immagini, plugin, temi e impostazioni, ed esportarne uno snapshot. Puoi quindi
ripristinarlo con `importWordPressFiles`. Questo esempio prevede `site.zip`
accanto a `blueprint.json` in un [bundle Blueprint](/blueprints/bundles):

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

Il passaggio può rilevare una directory WordPress completa in una cartella
contenitore. Se l’archivio contiene più siti o richiede una directory iniziale
esplicita, imposta `pathInZip` sulla directory dei file WordPress. Mantieni
compatibili le versioni di WordPress, PHP, temi e plugin e ripristina solo file
ZIP attendibili, perché possono contenere un intero database e PHP eseguibile.

## `importThemeStarterContent`

<!--
[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
that can be published to highlight the features of a theme.

With the [`importThemeStarterContent` step](/blueprints/steps), you can publish
the starter content of any installed theme, even if that theme is not activated
in the Playground instance:
-->

[Alcuni temi includono contenuti iniziali](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
che puoi pubblicare per evidenziarne le funzionalità.

Con il [passaggio `importThemeStarterContent`](/blueprints/steps) puoi pubblicare
i contenuti iniziali di qualsiasi tema installato, anche se non è attivo:

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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

<!--
You can also publish the starter content of a theme while installing it with the
[`installTheme` step](/blueprints/steps) by setting its `importStarterContent`
option to `true`:
-->

Puoi anche pubblicare i contenuti iniziali durante l’installazione con il
[passaggio `installTheme`](/blueprints/steps), impostando
`importStarterContent` su `true`:

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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

## `wp-cli`

<!--
Another way of generating content for your theme or plugin is the
[`wp-cli` step](/blueprints/steps). It runs
[WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as
[`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):
-->

Puoi generare contenuti per il tema o il plugin anche con il
[passaggio `wp-cli`](/blueprints/steps), che esegue
[comandi WP-CLI](https://developer.wordpress.org/cli/commands/) come
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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})

<!--
You can also combine the `wp-cli` step with the
[`writeFile` step](/blueprints/steps) to create posts from existing content and
import images into the Playground instance:
-->

Puoi combinare `wp-cli` con il [passaggio `writeFile`](/blueprints/steps) per
creare articoli da contenuti esistenti e importare immagini:

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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})

<div class="callout callout-tip">

<!--
Check the
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
example from the
[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
to see the full example showing the connection between the content and the
featured image.
-->

Consulta l’esempio
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
nella [galleria dei Blueprint](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
per vedere il collegamento tra il contenuto e l’immagine in evidenza.

</div>

## `runPHP`

<!--
With the [`runPHP` step](/blueprints/steps), you can run PHP code to insert or
configure data in your WordPress installation, for example with the
[`wp_insert_post` function](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Load `/wordpress/wp-load.php` before calling WordPress APIs, and handle errors
so a failed setup does not silently produce an incomplete demo:
-->

Con il [passaggio `runPHP`](/blueprints/steps) puoi eseguire codice PHP per
inserire o configurare dati, ad esempio con la
[funzione `wp_insert_post`](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Carica `/wordpress/wp-load.php` prima di chiamare le API di WordPress e gestisci
gli errori per evitare che una configurazione non riuscita produca una demo
incompleta:

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

[<kbd> &nbsp; Esegui Blueprint &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%5Cnrequire_once%20'/wordpress/wp-load.php'%3B%5Cn%5Cn$post_id%20=%20wp_insert_post(%5Cn%5Ctarray(%5Cn%5Ct%5Ct'post_title'%20%20%20=%3E%20'Simple%20post%20from%20PHP',%5Cn%5Ct%5Ct'post_content'%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post.%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%5Cn%5Ct%5Ct'post_author'%20%20=%3E%201,%5Cn%5Ct%5Ct'post_status'%20%20=%3E%20'publish',%5Cn%5Ct),%5Cn%5Cttrue%5Cn)%3B%5Cn%5Cnif%20(%20is_wp_error(%20$post_id%20)%20)%20{%5Cn%5Ctthrow%20new%20RuntimeException(%20$post_id-%3Eget_error_message()%20)%3B%5Cn}%22}]}>)

<!--
For small, deterministic fixtures, `runPHP` keeps setup logic close to the
Blueprint. For large editorial datasets or a complete prepared site, WXR or a
ZIP snapshot is usually easier to maintain. The
[import comparison guide](/guides/import-content-with-blueprints) explains the
trade-offs in detail.
-->

Per piccoli set di dati deterministici, `runPHP` mantiene la logica di
configurazione vicina al Blueprint. Per grandi set di dati editoriali o un sito
completo già preparato, WXR o uno snapshot ZIP sono in genere più facili da
gestire. La
[guida al confronto delle importazioni](/guides/import-content-with-blueprints)
spiega in dettaglio vantaggi e svantaggi.
