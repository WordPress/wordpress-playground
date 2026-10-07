---
title: Primeiros passos
slug: /quick-start-guide
description: Um guia de 5 minutos para começar a usar o Playground. Aprenda a testar plugins, temas e usar diferentes versões de WP/PHP.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# Comece a usar o WordPress Playground em 5 minutos

<!--
WordPress Playground can help you with any of the following:
-->

O WordPress Playground pode ajudar você com qualquer um dos seguintes pontos:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Esta página irá guiá-lo por cada um deles. Ah, e se você aprende visualmente, aqui está um vídeo. Alguns detalhes da interface no vídeo são anteriores ao Dock; siga os passos escritos abaixo para a interface atual.

<iframe width="752" height="423.2" title="Primeiros passos com o WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Inicie um novo site WordPress

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Abra a [demonstração oficial em playground.wordpress.net](https://playground.wordpress.net/) para iniciar o WordPress no seu navegador.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Você pode criar páginas, enviar plugins, instalar temas, importar conteúdo e fazer a maioria das coisas que faria em um site WordPress comum.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Quando o armazenamento do navegador está disponível, novos Playgrounds são
salvos automaticamente. Você encontra até cinco salvamentos automáticos recentes
em **Your Playgrounds** no Dock. Se precisar de um site que seja descartado ao
atualizar a página, abra o Playground com `?storage=temp`.

<!--
<div class="callout callout-info">

**WordPress Playground is private**

The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.

</div>
-->

<div class="callout callout-info">

**O WordPress Playground é privado**

O Playground roda localmente no seu navegador. Ele não envia o seu site para
lugar nenhum, a menos que você escolha uma ação como **Export to GitHub**.
Quando terminar, você pode armazenar o Playground permanentemente, exportá-lo
como um ZIP ou recomeçar em **New Playground**.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Teste um bloco, um tema ou um plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

É possível enviar qualquer plugin ou tema em [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para economizar alguns cliques, você pode pré-instalar plugins ou temas do diretório de plugins do WordPress adicionando o parâmetro `plugin` ou `theme` ao URL. Por exemplo, para instalar o plugin coblocks, use este URL:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

Ou este URL para pré-instalar o tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Caso você queira instalar vários temas e plugins, é possível repetir os parâmetros `theme` ou `plugin`:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Você também pode misturar e combinar esses parâmetros e até mesmo adicionar vários plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Isso se chama [Query API](/developers/apis/query-api/) e você pode saber mais sobre ela [aqui](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## Armazene um Playground no navegador

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.

![The Store permanently pane with browser storage selected](/img/dock/store-permanently-browser.webp)
-->

Clique no status **Autosaved** ou **Unsaved** no Dock para abrir **Store
permanently** e escolha **Save in browser storage**.

![O painel Store permanently com o armazenamento do navegador selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-browser.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Um Playground salvo no navegador aparece em **Your Playgrounds**. Os salvamentos
automáticos também aparecem lá, mas o Playground mantém apenas até cinco
salvamentos automáticos recentes. Armazene um Playground permanentemente quando
quiser mantê-lo além do ciclo de vida dos salvamentos automáticos.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

O armazenamento do navegador continua pertencendo ao navegador. Exporte um ZIP quando precisar de um arquivo que você possa mover, arquivar ou restaurar depois.

<!--
## Export a portable ZIP
-->

## Exporte um ZIP portátil

<!--
Open **Export** from the Dock and use **Download as .zip**.

![The Export pane with ZIP, setup link, and GitHub options](/img/dock/dock-export-playground.webp)
-->

Abra **Export** no Dock e use **Download as .zip**.

![O painel Export com as opções de ZIP, link de configuração e GitHub](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

O arquivo exportado contém os arquivos atuais, o banco de dados, plugins, temas, uploads e edições. Você pode restaurá-lo no Playground ou hospedá-lo em um servidor com suporte a PHP e SQLite.

<!--
The SQLite database is included in `wp-content/database/`. When this directory contains `db-path.php`, that file returns the database path inside a randomized subdirectory. Older sites use `wp-content/database/.ht.sqlite`. Keep the whole `database` directory together when copying a site. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

O banco de dados SQLite está incluído em `wp-content/database/`. Quando esse diretório contém `db-path.php`, esse arquivo retorna o caminho do banco de dados dentro de um subdiretório com nome aleatório. Sites mais antigos usam `wp-content/database/.ht.sqlite`. Mantenha todo o diretório `database` junto ao copiar um site. Arquivos que começam com um ponto ficam ocultos por padrão na maioria dos sistemas operacionais, então pode ser necessário habilitar a exibição de arquivos ocultos no seu gerenciador de arquivos.

<!--
## Restore a ZIP
-->

## Restaure um ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.

![The New Playground pane with Import zip selected](/img/dock/dock-new-playground-import-zip.webp)
-->

Abra **New Playground** no Dock, escolha **Import zip** e selecione o arquivo ZIP.

![O painel New Playground com Import zip selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

Isso restaura os arquivos e o banco de dados do ZIP em um novo Playground.

<!--
## Use a specific WordPress or PHP version
-->

## Use uma versão específica do WordPress ou PHP

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.

![The Site Settings pane](/img/dock/dock-site-settings.webp)
-->

Abra **Site Settings** no Dock para escolher as opções de WordPress, PHP, idioma, multisite e rede.

![O painel Site Settings](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
<div class="callout callout-info">

**Test your plugin or theme**

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

</div>
-->

<div class="callout callout-info">

**Teste seu plugin ou tema**

Testes de compatibilidade com tantas versões do WordPress e do PHP sempre foram um desafio. O WordPress Playground torna esse processo fácil – use-o a seu favor!

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Você também pode usar os [parâmetros de consulta](/developers/apis/query-api) `wp` e `php` para abrir o Playground com as versões certas já carregadas:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Isso se chama [Query API](/developers/apis/query-api/) e você pode saber mais sobre ela [aqui](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Use `php=next` para experimentar a próxima versão do PHP, compilada a partir do branch de desenvolvimento do php-src. Por exemplo, veja a [prévia dos recursos do PHP 8.6](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para saber mais sobre como preparar conteúdo para demonstrações, consulte o [guia de fornecimento de conteúdo para sua demonstração](/guides/providing-content-for-your-demo).

<!--
<div class="callout callout-info">

**Major versions only**

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.

</div>
-->

<div class="callout callout-info">

**Somente versões principais**

Você pode especificar versões principais, como `wp=6.2` ou `php=8.1`, e esperar a versão mais recente nessa linha. No entanto, você não pode solicitar versões secundárias mais antigas, portanto, nem `wp=6.1.2` nem `php=7.4.9` funcionarão. Apelidos genéricos como `latest` e `next` são exceções.

</div>

<!--
## Import a WXR file
-->

## Importar um arquivo WXR

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

Você pode importar um arquivo de exportação do WordPress enviando um arquivo WXR em [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

Você também pode usar [JSON Blueprints](/blueprints). Consulte [Introdução ao Blueprints](/blueprints/getting-started) para saber mais.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

Isso é diferente de restaurar um ZIP do Playground. Um arquivo WXR importa conteúdo do WordPress para um site existente. Um ZIP do Playground restaura os arquivos e o banco de dados em um novo Playground.

<!--
## Build apps with WordPress Playground
-->

## Crie aplicativos com o WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

O WordPress Playground é programável, o que significa que você pode [criar aplicativos WordPress](/developers/build-your-first-app), configurar demonstrações de plugins e até mesmo usá-lo como um [ambiente de desenvolvimento local](/developers/local-development/) sem necessidade de configuração.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para saber mais sobre desenvolvimento com o WordPress Playground, confira a seção [início rápido de desenvolvimento](/developers/build-your-first-app).
