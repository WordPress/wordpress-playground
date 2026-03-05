---
title: Build
slug: /about/build
description: Build with WP Playground
sidebar_class_name: navbar-build-item
---

<!--
# Build
-->

# Construir

<!--
WordPress Playground can help you to create and learn WordPress quickly, even on mobile with no signal. You can use Playground where you work best, whether that's in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-->

O WordPress Playground pode ajudá-lo a criar e aprender WordPress rapidamente, mesmo no celular sem sinal. Você pode usar o Playground onde trabalha melhor, seja no navegador, Node.js, aplicativos móveis, VS Code ou em outros lugares.

<!--
## Setting quickly a local WordPress environment
-->

## Configurando rapidamente um ambiente WordPress local

<!--
You can seamlessly integrate Playground into your development workflow to launch a local WordPress environment quickly for testing your code. You can do this directly [from the terminal](/developers/local-development/wp-playground-cli) or [your preferred IDE.](/developers/local-development/vscode-extension)
-->

Você pode integrar perfeitamente o Playground ao seu fluxo de trabalho de desenvolvimento para lançar rapidamente um ambiente WordPress local para testar seu código. Você pode fazer isso diretamente [do terminal](/developers/local-development/wp-playground-cli) ou [da sua IDE preferida](/developers/local-development/vscode-extension).

<!--
## Save changes done on a Block Theme and create GitHub Pull Requests
-->

## Salvar alterações feitas em um Tema de Blocos e criar Pull Requests no GitHub

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you've done through the WordPress UI, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.

With this workflow, you could build a block theme completely in your browser and save your change to GitHub, or you could improve/fix an existing one.
-->

Você pode conectar sua instância do Playground a um repositório GitHub e criar um Pull Request com as alterações que fez através da interface do WordPress, aproveitando o plugin [Create Block Theme](https://wordpress.org/plugins/create-block-theme/).

Com este fluxo de trabalho, você pode construir um tema de blocos completamente no seu navegador e salvar suas alterações no GitHub, ou pode melhorar/corrigir um existente.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
Some more examples of this workflow:

-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

Mais alguns exemplos deste fluxo de trabalho:

-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
## Synchronize your playground instance with a local folder and create GitHub Pull Requests
-->

## Sincronizar sua instância do playground com uma pasta local e criar Pull Requests no GitHub

![Storage Type Device Snapshot](@site/static/img/about/storage-type-device.webp)

<!--
With Google Chrome you can synchronize your Playground instance with a local directory, that can be either:

-   And empty directory – to save this Playground and start syncing
-   An existing directory – to load it here and start syncing
-->

Com o Google Chrome você pode sincronizar sua instância do Playground com um diretório local, que pode ser:

-   Um diretório vazio – para salvar este Playground e começar a sincronizar
-   Um diretório existente – para carregá-lo aqui e começar a sincronizar

<!--
:::info

This feature is only available for Google Chrome for now. It won't work with other browsers, yet.

:::
-->

:::info

Este recurso está disponível apenas para o Google Chrome por enquanto. Não funcionará com outros navegadores ainda.

:::

<!--
Regarding changes done on both sides of the connection:

-   Files changed in Playground will be synchronized to your computer.
-   Files changed on your computer will not be synchronized to Playground. You'll need to click the "Sync local files" button.

With this workflow you can create directly GitHub PRs from your changes done on your local directory.
-->

Quanto às alterações feitas em ambos os lados da conexão:

-   Arquivos alterados no Playground serão sincronizados para o seu computador.
-   Arquivos alterados no seu computador não serão sincronizados para o Playground. Você precisará clicar no botão "Sync local files".

Com este fluxo de trabalho você pode criar diretamente PRs do GitHub a partir das suas alterações feitas no seu diretório local.

<!--
See here a little demo of this workflow in action:
-->

Veja aqui uma pequena demonstração deste fluxo de trabalho em ação:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
## Integrate with other APIs to create new tools.
-->

## Integrar com outras APIs para criar novas ferramentas.

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.

You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.

Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with Open AI provides a WordPress translations tool "in place" where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

O Playground pode ser combinado com diferentes APIs para criar ferramentas incríveis. As possibilidades são infinitas.

Você pode [usar o WordPress Playground no Node.js](/developers/local-development/php-wasm-node) para criar novas ferramentas. O pacote [@php-wasm/node](https://npmjs.org/@php-wasm/node), que envia o runtime PHP WebAssembly, é o pacote usado para [https://playground.wordpress.net/](https://playground.wordpress.net/), por exemplo.

Outro aplicativo interessante construído sobre o Playground é o **Translate Live** (veja [exemplo](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) que, em combinação com a Open AI, fornece uma ferramenta de traduções WordPress "no local" onde as traduções podem ser vistas e modificadas em seu contexto real (veja exemplo). Leia mais sobre esta ferramenta em [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)

<!--
## Work offline and as a native app
-->

## Trabalhar offline e como um aplicativo nativo

<!--
When you first visit [playground.wordpress.net](https://playground.wordpress.net/), your browser automatically caches all the necessary files to use Playground. From that point on, you can access [playground.wordpress.net](https://playground.wordpress.net/), even without internet connection, ensuring you can continue working on your projects without interruptions.

You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.

Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

Quando você visita pela primeira vez [playground.wordpress.net](https://playground.wordpress.net/), seu navegador automaticamente armazena em cache todos os arquivos necessários para usar o Playground. A partir desse momento, você pode acessar [playground.wordpress.net](https://playground.wordpress.net/), mesmo sem conexão com a internet, garantindo que você pode continuar trabalhando em seus projetos sem interrupções.

Você também pode instalar o Playground no seu dispositivo como um Progressive Web App (PWA) para lançar o Playground diretamente da sua tela inicial—exatamente como um aplicativo nativo.

Leia [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) para mais informações.

<!--
## Embed a WordPress site in non-web environments
-->

## Incorporar um site WordPress em ambientes não-web

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->

O guia [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) mostra como podemos aproveitar o Playground para envolver um site WordPress em um aplicativo iOS.
