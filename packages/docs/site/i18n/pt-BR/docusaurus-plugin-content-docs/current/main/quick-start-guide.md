---
title: Primeiros passos
slug: /quick-start-guide
description: Um guia de 5 minutos para começar a usar o Playground. Aprenda a testar plugins, temas e usar diferentes versões de WP/PHP.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!--
# Start using WordPress Playground in 5 minutes
-->

# Comece a usar o WordPress Playground em 5 minutos

<!--
WordPress Playground can help you with any of the following:
-->

WordPress Playground pode nos seguintes pontos:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:
-->

Esta página irá guiá-lo por cada um deles. Ah, e se você aprende visualmente, aqui está um vídeo:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
 -->

## Inicie um novo site WordPress

<!--
Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.
-->

Cada vez que você visita o [official demo on playground.wordpress.net](https://playground.wordpress.net/), você recebe uma instância nova de um site WordPress.

<!--
You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.
-->

Você pode então criar páginas, carregar plugins, temas, importar o seu próprio site e fazer a maioria das coisas que faria numa instalação normal do WordPress.

<!--
It's that easy to start!
-->

E o processo para iniciar é simples!

<!--
The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!
-->

A estrutura inteira do site fica no seu navegador sendo copiado quando você fecha a aba. Quer recomeçar? Basta atualizar a página!

<!--
:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::
-->

:::info O WordPress Playground é privado

Tudo o que você cria fica no seu navegador e **não** é enviado para nenhum servidor remoto, funcionando totalmente de forma privada. Quando terminar, você pode exportar o seu site como um arquivo zip. Ou simplesmente atualize a página e comece de novo!

:::

<!--
## Try a block, a theme, or a plugin
-->

## Testando Blocos, Temas e plugins

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

É possível realizar o upload de qualquer plugin ou tema no [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para agilizar o processo, também é possível pre-instalar plugins ou temas, passando o parâmetro no URL `plugin` ou `theme`. Por exemplo, caso queira instalar o plugin coblocks, basta usar o URL:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

Ou este URL para pre-instalar o tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Caso você queira instalar vários temas e plugins, é possível repetir os parâmetros `theme` ou `plugin`:

https://playground.wordpress.net/?theme=pendant&theme=acai

Você também pode misturar e combinar esses parâmetros e até mesmo adicionar vários plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

<!--
## Save your site
-->

## Salve o seu site

<!--
To keep your WordPress Playground site for longer than a single browser session, you can export it as a zip file.
-->

<!--
To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file.
-->

Para manter o seu site WordPress Playground por mais de uma sessão do navegador, você pode exporta-lo como um arquivo `.zip`.

<!--
1. Open the Playground site manager panel:
-->

1. Abra o painel do gerenciador de sites do Playground:

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

<!--
2. Use the "Download as .zip" button in the additional actions menu
-->

2. Use o botão "Download como .zip" no menu de ações adicionais

![Export button](@site/static/img/site-manager/export-zip-file.webp)

<!--
The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.
-->

O arquivo exportado contém o site completo que você criou. Você pode hospedá-lo em qualquer servidor compatível com PHP e SQLite. Todos os arquivos principais do WordPress, plugins, temas e tudo o mais que você adicionou ao seu site estarão lá.

<!--
The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.
-->

O arquivo de banco de dados SQLite também está incluído na exportação. Você o encontrará em `wp-content/database/.ht.sqlite`. Lembre-se de que arquivos que começam com um ponto ficam ocultos por padrão na maioria dos sistemas operacionais, portanto, pode ser necessário habilitar a opção "Mostrar arquivos ocultos" no seu gerenciador de arquivos.

<!--
## Restore a saved site
-->

## Restaurando um site salvo

<!--
You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel:
-->

Você pode restaurar o site salvo usando o botão "Importar de .zip" no painel do painel de controle do Playground:

<!--
1. Open the Playground dashboard panel:
-->

1. Abra o painel do painel de controle do Playground:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

<!--
1. Use the "Import .zip" button at the end of the "Start a new Playground" section
-->

1. Use o botão "Importar .zip" no final da seção "Iniciar um novo Playground"

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

<!--
## Use a specific WordPress or PHP version
-->

## Use uma versão específica do WordPress ou PHP

<!--
The easiest way is to use the version switcher on [the official demo site](https://playground.wordpress.net/):
-->

A maneira mais rápida de trocar a versão do WordPress ou PHP no é utilizando o painel de configurações do [site oficial de demonstração](https://playground.wordpress.net/):
![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

<!--
:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::
-->

:::info Teste seu plugin ou tema

Testes de compatibilidade com tantas versões do WordPress e do PHP sempre foram um desafio. O WordPress Playground torna esse processo fácil – use-o a seu favor!

:::

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Você também pode usar os [parâmetros de consulta](/developers/apis/query-api) `wp` e `php` para abrir o Playground com as versões certas já carregadas:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para saber mais sobre como preparar conteúdo para demonstrações, consulte o [guia de fornecimento de conteúdo para sua demonstração](/guides/providing-content-for-your-demo).

<!--
:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

:::
-->

:::info Somente versões principais

Você pode especificar versões principais, como `wp=6.2` ou `php=8.1`, e esperar a versão mais recente nessa linha. No entanto, você não pode solicitar versões secundárias mais antigas, portanto, nem `wp=6.1.2` nem `php=7.4.9` funcionarão.

:::

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
This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.
-->

Isso é diferente do recurso de importação descrito acima. O recurso de importação exporta o site inteiro, incluindo o banco de dados. Este recurso importa um arquivo WXR para um site existente.

<!--
## Build apps with WordPress Playground
-->

## Crie aplicativos com o WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

O WordPress Playground é programável, o que significa que você pode [criar aplicativos WordPress](/developers/build-your-first-app), configurar demonstrações de plugins e até mesmo usá-lo como um [ambiente de desenvolvimento local](/developers/local-development/) sem necessidade de configuração.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para saber mais sobre desenvolvimento com o WordPress Playground, confira a seção [início rápido de desenvolvimento](/developers/build-your-first-app).
