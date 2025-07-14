---
title: Sobre o Playground
slug: /about
---

<!--
# About WordPress Playground
-->

# Sobre o WordPress Playground

<!--
## What is WordPress Playground?
-->

## O que é o WordPress Playground?

<!--
**WordPress Playground is the platform that lets you run WordPress instantly on any device without a host**. It allows you to experiment and learn about WordPress without affecting your live website. It's a virtual sandbox where you can play around with different features, designs, and settings in a safe and controlled environment.
-->

**WordPress Playground é uma plataforma que permite executar WordPress instataneamente em qualquer dispositivo sem precisar de um servidor**. Isto permite usuários experimentar e aprender WordPress em um ambiente isoloado sem risco de afetar um site em produção. Playground é um sandbox virtual onde você pode experimentar diferentes recursos, design e configurações num ambiente seguro.

<!--
WordPress Playground is your place to build, test, and launch:

-   [Build](/about/build): WordPress Playground can help you to build products with WordPress. Use it from where you work best, whether that's in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-   [Test](/about/test): Upgrade your QA process with WordPress Playground. Quickly test your plugins or themes, experiment in a private sandbox, and create PRs from your WP Playground instance to any repo.
-   [Launch](/about/launch): Use WordPress Playground to showcase your product, let users try it live, or launch it in the App Store with zero lead time.
-->

WordPress Playground é um local para construir, testar e Lançamento:

-   [Construir](/about/build): WordPress Playground pode ajudar você a construir produtos com WordPress. Utilize isto onde funcionar melhor, seja no naevgador, Node.js, aplicações móveis, VS Code, ou em qualquer outro lugar.
-   [Test](/about/test): Atualize o seu processo de QA com o WordPress Playground. Rapidamente teste seus plugins ou temas, teste num sandbox privado e crie pull requests da sua instância Playground WordPress para qualquer repositório.
-   [Lançamento](/about/launch): Use o Playgroud WordPress para demostrar o seu produto, permitir que os usuários o experimentem ao vivo ou lançá-lo na App Store com zero tempo de espera.

<!--
## Why WordPress Playground?
-->

## Por que o WordPress Playground?

<!--
### Try themes and plugins on the fly
-->

### Experimente temas e plugins dinamicamente

<!--
With the WordPress Playground, you can explore any [theme](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). You can choose from a wide range of themes and see how they look on your site. You can also modify the colors, fonts, layouts, and other visual elements to create a unique design. \
In addition to themes, you can experiment with plugins too. With WordPress Playground, you can install and test different plugins to see how they work and what they can do for your site. This allows you to explore and understand the capabilities of WordPress without worrying about breaking anything.
-->

Com o WordPress Playground, você pode explorar qualquer [tema](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). Você pode escolher entre uma vasta gama de temas e ver como eles ficam no seu site. Você também pode modificar as cores, fontes, layouts e outros elementos visuais para criar um design único. \
Além dos temas, você também pode experimentar com plugins. Com o WordPress Playground, você pode instalar e testar diferentes plugins para ver como eles funcionam e o que eles podem fazer pelo seu site. Isso permite que você explore e entenda as capacidades do WordPress sem se preocupar em quebrar nada.

<!--
### Create content on the go
-->

### Crie conteúdo em qualquer lugar

<!--
Another great feature of WordPress Playground is the ability to create and edit content. You can write blog posts, create pages, and add media like images and videos to your site. This helps you understand how to organize and structure your content effectively.
-->

Outra ótima característica do WordPress Playground é a capacidade de criar e editar conteúdo. Você pode escrever posts de blog, criar páginas e adicionar mídias como imagens e vídeos ao seu site. Isso ajuda você a entender como organizar e estruturar seu conteúdo de forma eficaz.

<!--
The content you create is limited to the Playground on your device and disappears once you leave it, so you are free to explore and play without risking breaking any actual site.
-->

O conteúdo que você cria é limitado ao Playground no seu dispositivo e desaparece assim que você o fecha, então você está livre para explorar e brincar sem arriscar quebrar qualquer site real.

<!--
But hey! You can also connect your Playground instance to a GitHub repo and create a PR to persist those changes.
-->

Mas ei! Você também pode conectar sua instância do Playground a um repositório do GitHub e criar um PR para persistir essas mudanças.

<!--
### It's super safe
-->

### É super seguro

<!--
Overall, WordPress Playground provides a risk-free environment for beginners to learn and get hands-on experience with WordPress. It helps you to gain confidence and knowledge before making changes to your live website.
-->

No geral, o WordPress Playground oferece um ambiente livre de riscos para iniciantes aprenderem e terem experiência prática com o WordPress. Ele ajuda você a ganhar confiança e conhecimento antes de fazer alterações no seu site ao vivo.

<!--
:::tip
Check the [guides section](/guides) to learn more about how to leverage WordPress Playground to test your themes and plugins and create content on the fly.
:::
-->

:::tip
Confira a [seção de guias](/guides) para aprender mais sobre como aproveitar o WordPress Playground para testar seus temas e plugins e criar conteúdo dinamicamente.
:::

<!--
## How does WordPress Playground work?
-->

## Como o WordPress Playground funciona?

<!--
When you first start using WordPress Playground, you'll be provided with a separate space where you can create and customise your own WordPress website. This space is completely isolated from your actual website.
-->

Quando você começa a usar o WordPress Playground, você recebe um espaço separado onde pode criar e personalizar seu próprio site WordPress. Este espaço é completamente isolado do seu site real.

<!--
### Streamed, not served.
-->

### Transmitido, não servido.

<!--
The WordPress you see when you open Playground in your browser is a WordPress that should function like any WordPress, with [a few limitations](/developers/limitations) and the important exception that it's not a permanent server with an internet address which will limit connections to some third-party services (automation, sharing, analysis, email, backups, etc.) in a persistent way.
-->

O WordPress que você vê ao abrir o Playground no seu navegador é um WordPress que deve funcionar como qualquer outro WordPress, com [algumas limitações](/developers/limitations) e a importante exceção de que não é um servidor permanente com um endereço de internet, o que limitará as conexões a alguns serviços de terceiros (automação, compartilhamento, análise, e-mail, backups, etc.) de forma persistente.

<!--
The loading screen and progress bar you see on Playground includes both the streaming of those foundational technologies to your browser and configuration steps from [WordPress Blueprints](/blueprints) (see [examples](/blueprints/examples)), so that a full server, WordPress software, Theme & Plugin solutions and configuration instructions can be streamed over-the-wire.
-->

A tela de carregamento e a barra de progresso que você vê no Playground incluem tanto a transmissão dessas tecnologias fundamentais para o seu navegador quanto as etapas de configuração dos [WordPress Blueprints](/blueprints) (veja [exemplos](/blueprints/examples)), de modo que um servidor completo, o software WordPress, soluções de Temas e Plugins e instruções de configuração possam ser transmitidos pela rede.

<!--
## What makes Playground different from running WordPress on a web server or local desktop app?
-->

## O que torna o Playground diferente de executar o WordPress em um servidor web ou aplicativo de desktop local?

<!--
Web applications like WordPress have long relied on server technologies [to run logic](/developers/architecture/wasm-php-overview) and [store data](/developers/architecture/wordpress#sqlite).
-->

Aplicações web como o WordPress há muito tempo dependem de tecnologias de servidor [para executar a lógica](/developers/architecture/wasm-php-overview) e [armazenar dados](/developers/architecture/wordpress#sqlite).

<!--
Using those technologies has meant either running a web server connected to the internet or using those technologies in a desktop service or app (sometimes called a "WordPress local environment") that either leans on a virtual server with the technologies installed or the underlying technologies on the current device.
-->

Usar essas tecnologias significava executar um servidor web conectado à internet ou usar essas tecnologias em um serviço ou aplicativo de desktop (às vezes chamado de "ambiente local do WordPress") que se apoia em um servidor virtual com as tecnologias instaladas ou nas tecnologias subjacentes no dispositivo atual.

<!--
Playground is a novel way to stream server technologies—including WordPress (and WP-CLI)—as files that can then run in the browser.
-->

O Playground é uma maneira inovadora de transmitir tecnologias de servidor — incluindo WordPress (e WP-CLI) — como arquivos que podem ser executados no navegador.
