---
title: Construye
slug: /about/build
description: Aprende cómo WordPress Playground te ayuda a construir productos, desde configurar entornos locales hasta crear temas y nuevas herramientas.
sidebar_class_name: navbar-build-item
---

<!--
# Build
-->

# Construye

<!--
WordPress Playground can help you to create and learn WordPress quickly, even on mobile with no signal. You can use Playground where you work best, whether that’s in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-->

WordPress Playground puede ayudarte a crear y aprender WordPress rápidamente, incluso en dispositivos móviles sin señal. Puedes usar Playground donde mejor trabajes, ya sea en el navegador, Node.js, aplicaciones móviles, VS Code u otros entornos.

<!--
## Setting up a local WordPress environment quickly
-->

## Configura rápidamente un entorno local de WordPress

<!--
You can seamlessly integrate Playground into your development workflow to launch a local WordPress environment quickly for testing your code. You can do this directly [from the terminal](/developers/local-development/wp-playground-cli) or [your preferred IDE.](/developers/local-development/vscode-extension)
-->

Puedes integrar Playground sin problemas en tu flujo de trabajo de desarrollo para lanzar rápidamente un entorno local de WordPress y probar tu código. Puedes hacerlo directamente [desde la terminal](/developers/local-development/wp-playground-cli) o desde [tu IDE preferido.](/developers/local-development/vscode-extension)

<!--
## Save changes done on a Block Theme and create GitHub Pull Requests
-->

## Guarda los cambios realizados en un tema de bloques y crea Pull Requests en GitHub

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve made through the WordPress UI, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.

With this workflow, you could build a block theme completely in your browser and save your changes to GitHub, or you could improve/fix an existing one.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>
Some more examples of this workflow:

-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

Puedes conectar tu instancia de Playground a un repositorio de GitHub y crear un Pull Request con los cambios que hayas realizado a través de la interfaz de WordPress, aprovechando el plugin [Create Block Theme](https://wordpress.org/plugins/create-block-theme/).

Con este flujo de trabajo, podrías crear un tema de bloques completamente en tu navegador y guardar tus cambios en GitHub, o podrías mejorar/corregir uno existente.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>
Algunos ejemplos más de este flujo de trabajo:

-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
## Synchronize your playground instance with a local folder and create GitHub Pull Requests
-->

## Sincroniza tu instancia de Playground con una carpeta local y crea Pull Requests en GitHub

<!--
![Storage Type Device Snapshot](@site/static/img/about/storage-type-device.webp)

With Google Chrome you can synchronize your Playground instance with a local directory, that can be either:

-   An empty directory – to save this Playground and start syncing
-   An existing directory – to load it here and start syncing
-->

![Captura de un tipo de almacenamiento](@site/static/img/about/storage-type-device.webp)

Con Google Chrome puedes sincronizar tu instancia de Playground con un directorio local, que puede ser:

-   Un directorio vacío: para guardar este Playground y comenzar a sincronizar
-   Un directorio existente: para cargarlo aquí y comenzar a sincronizar

<!--
:::info

This feature is only available for Google Chrome for now. It won't work with other browsers yet.

:::
-->

:::info

Esta función solo está disponible por ahora para Google Chrome. Aún no funciona con otros navegadores.

:::

<!--
Regarding changes done on both sides of the connection:

-   Files changed in the Playground will be synchronized to your computer.
-   Files changed on your computer will not be synchronized to Playground. You'll need to click the "Sync local files" button.

With this workflow, you can create GitHub PRs directly from your changes made in your local directory.

See here a little demo of this workflow in action:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>
-->

En cuanto a los cambios realizados en ambos lados de la conexión:

-   Los archivos modificados en Playground se sincronizarán con tu computadora.
-   Los archivos modificados en tu computadora no se sincronizarán con Playground. Deberás hacer clic en el botón "Sincronizar archivos locales".

Con este flujo de trabajo, puedes crear PRs en GitHub directamente a partir de los cambios realizados en tu directorio local.

Aquí tienes una pequeña demostración de este flujo de trabajo en acción:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
## Integrate with other APIs to create new tools.
-->

## Integra con otras APIs para crear nuevas herramientas.

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.

You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.

Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with Open AI provides a WordPress translations tool “in place” where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

Playground se puede combinar con diferentes APIs para crear herramientas increíbles. Las posibilidades son infinitas.

Puedes [usar WordPress Playground en Node.js](/developers/local-development/php-wasm-node) para crear nuevas herramientas. El paquete [@php-wasm/node](https://npmjs.org/@php-wasm/node), que incluye el runtime de PHP WebAssembly, es por ejemplo, el paquete utilizado para [https://playground.wordpress.net/](https://playground.wordpress.net/).

Otra aplicación interesante construida sobre Playground es **Translate Live** (ver [ejemplo](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) que, en combinación con Open AI, proporciona una herramienta de traducción de WordPress "in situ" donde las traducciones se pueden ver y modificar en su contexto real (ver ejemplo). Lee más sobre esta herramienta en [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)

<!--
## Work offline and as a native app
-->

## Trabaja sin conexión y como una aplicación nativa

<!--
When you first visit [playground.wordpress.net](https://playground.wordpress.net/), your browser automatically caches all the necessary files to use Playground. From that point on, you can access [playground.wordpress.net](https://playground.wordpress.net/), even without an internet connection, ensuring you can continue working on your projects without interruptions.

You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.

Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

Cuando visitas por primera vez [playground.wordpress.net](https://playground.wordpress.net/), tu navegador almacena automáticamente en caché todos los archivos necesarios para usar Playground. A partir de ese momento, puedes acceder a [playground.wordpress.net](https://playground.wordpress.net/), incluso sin conexión a Internet, asegurando que puedas continuar trabajando en tus proyectos sin interrupciones.

También puedes instalar Playground en tu dispositivo como una Aplicación Web Progresiva (PWA) para iniciar Playground directamente desde la pantalla de inicio, al igual que una aplicación nativa.

Puedes leer [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) para más información.

<!--
## Embed a WordPress site in non-web environments
-->

## Incrusta un sitio de WordPress en entornos no web

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->

La guía [Cómo lanzar un sitio real de WordPress en una aplicación nativa de iOS a través de Playground](../guides/wordpress-native-ios-app) muestra cómo podemos aprovechar Playground para empaquetar un sitio de WordPress en una aplicación IOS.
