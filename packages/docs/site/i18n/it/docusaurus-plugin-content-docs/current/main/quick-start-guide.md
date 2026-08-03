---
title: Guida rapida
slug: /quick-start-guide
description: Una guida di 5 minuti per iniziare a usare Playground. Scopri come testare plugin, provare temi e usare versioni diverse di WP/PHP.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# Inizia a usare WordPress Playground in 5 minuti

<!--
WordPress Playground can help you with any of the following:
-->

WordPress Playground può aiutarti in tutte queste attività:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Questa pagina ti guiderà attraverso ognuna di esse. Se preferisci imparare in modo visivo, ecco un video. Alcuni dettagli dell'interfaccia mostrati nel video sono precedenti al Dock: segui i passaggi scritti qui sotto per l'interfaccia attuale.

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Avvia un nuovo sito WordPress

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Apri la [demo ufficiale su playground.wordpress.net](https://playground.wordpress.net/) per avviare WordPress nel tuo browser.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Puoi creare pagine, caricare plugin, installare temi, importare contenuti e fare quasi tutto ciò che faresti in un normale sito WordPress.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Quando l'archiviazione del browser è disponibile, i nuovi Playground vengono salvati automaticamente. Puoi trovare fino a cinque salvataggi automatici recenti in **I tuoi Playground**, dal Dock. Se ti serve un sito che venga eliminato all'aggiornamento della pagina, apri Playground con `?storage=temp`.

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**WordPress Playground è privato**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground viene eseguito in locale nel tuo browser. Non carica il tuo sito da nessuna parte, a meno che tu non scelga un'azione come **Esporta su GitHub**. Quando hai finito, puoi archiviare il Playground in modo permanente, esportarlo come ZIP oppure ricominciare da **Nuovo Playground**.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Prova un blocco, un tema o un plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

Puoi caricare qualsiasi plugin o tema in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Per risparmiare qualche clic, puoi preinstallare plugin o temi dalla directory dei plugin di WordPress aggiungendo un parametro `plugin` o `theme` all'URL. Per esempio, per installare il plugin coblocks puoi usare questo URL:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

Oppure questo URL per preinstallare il tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Se vuoi installare più temi e plugin, puoi ripetere i parametri `theme` o `plugin`:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Puoi anche combinare questi parametri e aggiungere più plugin:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Questa funzionalità si chiama [Query API](/developers/apis/query-api/) e puoi approfondirla [qui](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## Archivia un Playground nell'archiviazione del browser

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

Fai clic sullo stato **Salvato automaticamente** o **Non salvato** nel Dock per aprire **Archivia in modo permanente**, quindi scegli **Salva nell'archiviazione del browser**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Il pannello Archivia in modo permanente con il nome del Playground e il pulsante Salva](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Un Playground salvato nel browser compare in **I tuoi Playground**. Anche i salvataggi automatici compaiono lì, ma Playground ne conserva al massimo cinque recenti. Archivia un Playground in modo permanente quando vuoi conservarlo oltre il ciclo di vita dei salvataggi automatici.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

L'archiviazione del browser resta comunque nelle mani del browser. Esporta uno ZIP quando ti serve un file che puoi spostare, archiviare o ripristinare in seguito.

<!--
## Export a portable ZIP
-->

## Esporta uno ZIP portabile

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Apri **Esporta** dal Dock e usa **Scarica come .zip**.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Il pannello Esporta con Scarica come .zip evidenziato](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

Il file esportato contiene i file, il database, i plugin, i temi, i caricamenti e le modifiche correnti. Puoi ripristinarlo in Playground oppure ospitarlo su un server che supporta PHP e SQLite.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

Il file del database SQLite è incluso in `wp-content/database/.ht.sqlite`. I file che iniziano con un punto sono nascosti per impostazione predefinita nella maggior parte dei sistemi operativi, quindi potresti dover attivare la visualizzazione dei file nascosti nel gestore file.

<!--
## Restore a ZIP
-->

## Ripristina uno ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Apri **Nuovo Playground** dal Dock, scegli **Importa zip** e seleziona il file ZIP.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Il pannello Nuovo Playground con Importa zip selezionato](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

In questo modo i file e il database contenuti nello ZIP vengono ripristinati in un nuovo Playground.

<!--
## Use a specific WordPress or PHP version
-->

## Usa una versione specifica di WordPress o PHP

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Apri **Impostazioni del sito** dal Dock per scegliere le opzioni di WordPress, PHP, lingua, multisito e rete.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Il pannello Impostazioni del sito](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**Testa il tuo plugin o tema**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

Testare la compatibilità con così tante versioni di WordPress e PHP è sempre stato faticoso. WordPress Playground rende questo processo immediato: approfittane!

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Puoi anche usare i [parametri di query](/developers/apis/query-api) `wp` e `php` per aprire Playground con le versioni corrette già caricate:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Questa funzionalità si chiama [Query API](/developers/apis/query-api/) e puoi approfondirla [qui](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Usa `php=next` per provare in anteprima la prossima versione di PHP compilata dal branch di sviluppo di php-src. Per esempio, guarda l'[anteprima delle funzionalità di PHP 8.6](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Per saperne di più su come preparare i contenuti per le demo, consulta la guida [Fornire contenuti per la tua demo](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

<!--
**Major versions only**
-->

**Solo versioni major**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

Puoi indicare versioni major come `wp=6.2` o `php=8.1` e ottenere la release più recente di quella linea. Non puoi però richiedere versioni minor precedenti: né `wp=6.1.2` né `php=7.4.9` funzioneranno. Gli alias generici come `latest` e `next` sono un'eccezione.

</div>

<!--
## Import a WXR file
-->

## Importa un file WXR

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

Puoi importare un file di esportazione di WordPress caricando un file WXR in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

Puoi anche usare i [Blueprint JSON](/blueprints). Consulta [Iniziare con i Blueprint](/blueprints/getting-started) per saperne di più.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

Questa operazione è diversa dal ripristino di uno ZIP di Playground. Un file WXR importa contenuti di WordPress in un sito esistente, mentre uno ZIP di Playground ripristina i file e il database in un nuovo Playground.

<!--
## Build apps with WordPress Playground
-->

## Crea applicazioni con WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

WordPress Playground è programmabile: puoi [creare applicazioni WordPress](/developers/build-your-first-app), preparare demo di plugin e persino usarlo come [ambiente di sviluppo locale](/developers/local-development/) senza alcuna configurazione.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Per saperne di più sullo sviluppo con WordPress Playground, consulta la sezione [guida rapida per lo sviluppo](/developers/build-your-first-app).
