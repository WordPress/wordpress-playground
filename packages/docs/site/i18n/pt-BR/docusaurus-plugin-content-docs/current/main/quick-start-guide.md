---
title: Guia de início rápido
slug: /quick-start-guide
description: Um guia de 5 minutos para começar a usar o Playground. Aprenda a testar plugins e temas e a usar diferentes versões do WordPress e do PHP.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# Comece a usar o WordPress Playground em 5 minutos

<!--
WordPress Playground can help you with any of the following:
-->

O WordPress Playground pode ajudar você com qualquer uma destas tarefas:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Esta página orienta você em cada uma delas. Se você prefere aprender com recursos visuais, assista ao vídeo abaixo. Alguns detalhes da interface no vídeo são anteriores ao Dock. Siga as etapas escritas abaixo para usar a interface atual.

<!--
<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>
-->

<iframe width="752" height="423.2" title="Primeiros passos com o WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Iniciar um novo site WordPress

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Abra a [demonstração oficial em playground.wordpress.net](https://playground.wordpress.net/) para iniciar o WordPress no navegador.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Você pode criar páginas, enviar plugins, instalar temas, importar conteúdo e fazer quase tudo o que faria em um site WordPress comum.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Quando o armazenamento do navegador está disponível, novos Playgrounds são salvos automaticamente. Você encontra até cinco salvamentos automáticos recentes em **Seus Playgrounds**, no Dock. Se precisar de um site que seja descartado ao atualizar a página, abra o Playground com `?storage=temp`.

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**O WordPress Playground é privado**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

O Playground é executado localmente no navegador. Ele não envia seu site, a menos que você escolha uma ação como **Exportar para o GitHub**. Quando terminar, você pode armazenar o Playground permanentemente, exportá-lo como ZIP ou recomeçar em **Novo Playground**.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Testar um bloco, um tema ou um plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

Você pode enviar qualquer plugin ou tema em [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para economizar alguns cliques, adicione um parâmetro `plugin` ou `theme` à URL para pré-instalar plugins ou temas do diretório do WordPress. Por exemplo, use esta URL para instalar o plugin coblocks:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

Use esta URL para pré-instalar o tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Para instalar vários temas e plugins, repita os parâmetros `theme` ou `plugin`:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Você também pode combinar esses parâmetros e adicionar vários plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Isso é chamado de [API de consulta](/developers/apis/query-api/). Saiba mais na [documentação da API](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## Armazenar um Playground no navegador

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

Clique no status **Salvo automaticamente** ou **Não salvo** no Dock para abrir **Armazenar permanentemente**. Depois, escolha **Salvar no armazenamento do navegador**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![O painel Armazenar permanentemente com o nome do Playground e o botão Salvar](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Um Playground armazenado no navegador aparece em **Seus Playgrounds**. Os salvamentos automáticos também aparecem ali, mas o Playground mantém até cinco deles. Armazene um Playground permanentemente quando quiser mantê-lo além do ciclo de vida dos salvamentos automáticos.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

O armazenamento do navegador ainda pertence ao navegador. Exporte um ZIP quando precisar de um arquivo que possa mover, arquivar ou restaurar depois.

<!--
## Export a portable ZIP
-->

## Exportar um ZIP portátil

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Abra **Exportar** no Dock e use **Baixar como .zip**.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![O painel Exportar com Baixar como .zip destacado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

O arquivo exportado contém os arquivos, o banco de dados, os plugins, os temas, os arquivos enviados e as edições atuais. Você pode restaurá-lo no Playground ou hospedá-lo em um servidor compatível com PHP e SQLite.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

O arquivo do banco de dados SQLite fica em `wp-content/database/.ht.sqlite`. Arquivos cujo nome começa com ponto ficam ocultos por padrão na maioria dos sistemas operacionais. Talvez seja necessário habilitar a exibição de arquivos ocultos no gerenciador de arquivos.

<!--
## Restore a ZIP
-->

## Restaurar um ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Abra **Novo Playground** no Dock, escolha **Importar zip** e selecione o arquivo ZIP.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![O painel Novo Playground com Importar zip selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

Isso restaura os arquivos e o banco de dados do ZIP em um novo Playground.

<!--
## Use a specific WordPress or PHP version
-->

## Usar uma versão específica do WordPress ou do PHP

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Abra **Configurações do site** no Dock para escolher as opções de WordPress, PHP, idioma, rede multisite e acesso à rede.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![O painel Configurações do site](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**Teste seu plugin ou tema**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

Testar a compatibilidade com tantas versões do WordPress e do PHP sempre foi trabalhoso. O WordPress Playground facilita esse processo. Aproveite essa possibilidade.

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Você também pode usar os [parâmetros de consulta](/developers/apis/query-api) `wp` e `php` para abrir o Playground com as versões corretas já carregadas:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Isso é chamado de [API de consulta](/developers/apis/query-api/). Saiba mais na [documentação da API](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Use `php=next` para pré-visualizar a próxima versão do PHP, criada a partir do branch de desenvolvimento php-src. Por exemplo, veja a [prévia dos recursos do PHP 8.6](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para saber como preparar conteúdo para demonstrações, consulte o [guia sobre como fornecer conteúdo para sua demonstração](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

<!--
**Major versions only**
-->

**Somente versões principais**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

Você pode especificar versões principais, como `wp=6.2` ou `php=8.1`, e receber a versão mais recente dessa linha. No entanto, não pode solicitar versões secundárias antigas, portanto `wp=6.1.2` e `php=7.4.9` não funcionam. Aliases genéricos, como `latest` e `next`, são exceções.

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

Também é possível usar [Blueprints JSON](/blueprints). Consulte os [primeiros passos com Blueprints](/blueprints/getting-started) para saber mais.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

Isso é diferente de restaurar um ZIP do Playground. Um arquivo WXR importa conteúdo do WordPress para um site existente. Um ZIP do Playground restaura arquivos e o banco de dados em um novo Playground.

<!--
## Build apps with WordPress Playground
-->

## Criar aplicativos com o WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

O WordPress Playground é programável. Isso significa que você pode [criar aplicativos WordPress](/developers/build-your-first-app), configurar demonstrações de plugins e até usá-lo como um [ambiente de desenvolvimento local](/developers/local-development/) sem configuração.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para saber mais sobre desenvolvimento com o WordPress Playground, consulte a seção de [início rápido para desenvolvimento](/developers/build-your-first-app).
