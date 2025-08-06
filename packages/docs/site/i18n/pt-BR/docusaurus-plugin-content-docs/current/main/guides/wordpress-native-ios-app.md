---
title: Playground in native iOS apps
slug: /guides/wordpress-native-ios-app
description: WordPress Playground in native iOS apps
---

<!--
## How to ship a real WordPress site in a native iOS app via Playground?

Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server.

This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development.

**Important!** The current version of Blocknotes isn't running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress.
-->

## Como enviar um site WordPress real em um aplicativo iOS nativo via Playground?

Blocknotes é o primeiro aplicativo iOS que executou WordPress nativamente em dispositivos iOS aproveitando o WordPress Playground. Desenvolvido por [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), uma committer principal do WordPress, Blocknotes representa um salto significativo nas capacidades dos aplicativos móveis ao utilizar WebAssembly para executar WordPress sem a necessidade de um servidor PHP tradicional.

Este estudo de caso explora os recursos, implementação técnica e implicações potenciais do Blocknotes para o futuro do desenvolvimento móvel e web.

**Importante!** A versão atual do Blocknotes não está mais executando WordPress Playground. Desde o lançamento inicial, o aplicativo foi reescrito para usar apenas o editor de blocos do WordPress sem o resto do WordPress. Este estudo de caso cobre as versões iniciais do Blocknotes que abriram um mundo inteiro de novas possibilidades para o WordPress.

<!--
## Blocknotes features

Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user's iCloud Drive and seamlessly synchronized across devices.
-->

## Recursos do Blocknotes

Blocknotes permite aos usuários criar e editar notas usando o editor de blocos do WordPress. As notas são automaticamente salvas como arquivos HTML no iCloud Drive do usuário e sincronizadas perfeitamente entre dispositivos.

<!--
## Technical Implementation

Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported.

In [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts:

-   [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
-   [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
-   A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).
-->

## Implementação Técnica

Blocknotes operava como uma WebView executando uma página HTML onde uma versão WebAssembly do PHP estava executando WordPress. Essa página HTML foi empacotada como um iOS nativo via [Capacitor](https://capacitorjs.com/). Esta configuração permitiu que o WordPress funcionasse em ambientes tradicionalmente não suportados.

No [repositório GitHub do Blocknotes](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748), você pode revisar o último lançamento baseado no Playground. Aqui estão as partes mais importantes:

-   [Uma build do WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (empacotada como um arquivo `.data`).
-   [Recursos estáticos do WordPress](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [Uma build WebAssembly do PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [Um web worker executando PHP e WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   Plugin WordPress [Hypernotes](https://wordpress.com/plugins/hypernotes) ([instalado aqui](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) para transformar wp-admin em um aplicativo de anotações.
-   Uma camada para [carregar posts do WordPress de arquivos iOS](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) e [salvar alterações como arquivos iOS](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).

<!--
## Building your own iOS app with WordPress Playground

Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases.

The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what's possible with mobile web applications.

As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile.
-->

## Construindo seu próprio aplicativo iOS com WordPress Playground

Embora Blocknotes tenha provado que lançar um aplicativo iOS baseado em WordPress é possível, esta ainda é uma área altamente exploratória. Não há fluxos de trabalho, bibliotecas ou bases de conhecimento estabelecidas.

A melhor documentação que temos é o repositório do Blocknotes. Use-o como referência e ponto de partida para explorar seu novo aplicativo. Revise os componentes-chave como a build WebAssembly do PHP, a integração do editor de blocos do WordPress e como os web workers são utilizados para executar WordPress eficientemente. Ao dissecar esses elementos, você pode obter insights sobre como construir seu próprio aplicativo iOS com WordPress Playground, expandindo os limites do que é possível com aplicações web móveis.

Conforme você navega neste espaço inovador, compartilhe suas descobertas e desafios com a equipe do Playground e a comunidade WordPress mais ampla. Publicar seus aprendizados não apenas ajudará no seu desenvolvimento, mas também contribuirá para uma base de conhecimento coletiva, impulsionando o futuro do WordPress no mobile.

<!--
## Potential and the future

Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful.

Once the app-building workflows mature, we may see an automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app.

By working together and sharing our findings, we can push the boundaries of what's possible with WordPress and mobile app development
-->

## Potencial e o futuro

Blocknotes abre caminho para uma nova geração de aplicações que são mais acessíveis, flexíveis e poderosas.

Uma vez que os fluxos de trabalho de construção de aplicativos amadureçam, podemos ver pipelines automatizados para empacotar sites do Playground como aplicativos iOS. Isso tornaria extremamente fácil executar o mesmo código base no servidor, no navegador e como um aplicativo móvel.

Trabalhando juntos e compartilhando nossas descobertas, podemos expandir os limites do que é possível com WordPress e desenvolvimento de aplicativos móveis.
