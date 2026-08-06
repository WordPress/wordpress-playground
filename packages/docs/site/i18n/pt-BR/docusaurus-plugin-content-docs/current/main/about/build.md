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

<!--
With this workflow, you could build a block theme completely in your browser and save your changes to GitHub, or you could improve/fix an existing one.
-->

Com este fluxo de trabalho, você pode construir um tema de blocos completamente no seu navegador e salvar suas alterações no GitHub, ou pode melhorar/corrigir um existente.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<!--
<p></p>
Some more examples of this workflow:
-->

<p></p>

<!--
Some more examples of this workflow:

-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

Mais alguns exemplos deste fluxo de trabalho:

- [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
- [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
## Synchronize your Playground with a local folder and create GitHub Pull Requests
-->

## Sincronizar seu Playground com uma pasta local e criar pull requests no GitHub

<!--
In the Dock, click the **Autosaved** or **Unsaved** save status, select **Save
in a local directory**, click **Choose...**, and select a directory dedicated
to this Playground. After granting write access, click **Save**. Playground
copies the current site into the selected directory and overwrites files with
matching names; it does not import an existing site from that directory.
-->

No Dock, clique no status de salvamento **Salvo automaticamente** ou **Não salvo**, selecione **Salvar em uma pasta local**, clique em **Escolher...** e selecione uma pasta dedicada a esse Playground. Depois de conceder acesso de gravação, clique em **Salvar**. O Playground copia o site atual para a pasta selecionada e substitui arquivos com o mesmo nome. Ele não importa um site que já esteja nessa pasta.

<!--
![The Store permanently pane with local-directory storage selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)
-->

![O painel Armazenar permanentemente com o armazenamento em uma pasta local selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)

<!--
Local-directory storage uses the File System Access API, so availability depends on browser and platform support for choosing and writing to directories. Chromium-based desktop browsers usually support it. Browsers without that capability can still use browser storage and ZIP export. See [Browser support](/developers/limitations#browser-support) for the broader compatibility model.
-->

O armazenamento em uma pasta local usa a File System Access API. Portanto, a disponibilidade depende da compatibilidade do navegador e da plataforma com a seleção e a gravação em pastas. Navegadores para computador baseados em Chromium geralmente são compatíveis. Navegadores sem esse recurso ainda podem usar o armazenamento do navegador e a exportação de ZIP. Consulte a seção [Suporte a navegadores](/developers/limitations#browser-support) para entender o modelo de compatibilidade mais amplo.

<!--
Files changed in Playground are written to the selected directory. Files changed on disk are not pulled into the running Playground automatically. For a local-directory Playground, open the **Saved** status menu in the Dock and choose **Reload files from disk** when you want Playground to read the current files from the directory.
-->

Os arquivos alterados no Playground são gravados na pasta selecionada. Os arquivos alterados no disco não são carregados automaticamente no Playground em execução. Em um Playground armazenado em uma pasta local, abra o menu do status **Salvo** no Dock e escolha **Recarregar arquivos do disco** quando quiser que o Playground leia os arquivos atuais da pasta.

<!--
With this workflow, you can create GitHub PRs directly from changes made in your local directory.
-->

Com esse fluxo de trabalho, você pode criar pull requests no GitHub diretamente das alterações feitas na pasta local.

<!--
See here a little demo of this workflow in action:
-->

Veja uma breve demonstração desse fluxo de trabalho:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
## Integrate with other APIs to create new tools.
-->

## Integrar com outras APIs para criar novas ferramentas.

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.

You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.

Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with OpenAI provides a WordPress translations tool "in place" where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

O Playground pode ser combinado com diferentes APIs para criar ferramentas incríveis. As possibilidades são infinitas.

<!--
You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.
-->

Você pode [usar o WordPress Playground no Node.js](/developers/local-development/php-wasm-node) para criar novas ferramentas. O pacote [@php-wasm/node](https://npmjs.org/@php-wasm/node), que envia o runtime PHP WebAssembly, é o pacote usado para [https://playground.wordpress.net/](https://playground.wordpress.net/), por exemplo.

Outro aplicativo interessante construído sobre o Playground é o **Translate Live** (veja [exemplo](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) que, em combinação com a OpenAI, fornece uma ferramenta de traduções WordPress "no local" onde as traduções podem ser vistas e modificadas em seu contexto real (veja exemplo). Leia mais sobre esta ferramenta em [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)

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

<!--
You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.
-->

Você também pode instalar o Playground no seu dispositivo como um Progressive Web App (PWA) para lançar o Playground diretamente da sua tela inicial—exatamente como um aplicativo nativo.

<!--
Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

Leia [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) para mais informações.

<!--
## Embed a WordPress site in non-web environments
-->

## Incorporar um site WordPress em ambientes não-web

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->

O guia [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) mostra como podemos aproveitar o Playground para envolver um site WordPress em um aplicativo iOS.
