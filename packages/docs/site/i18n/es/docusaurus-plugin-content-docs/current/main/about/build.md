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

<!--
With this workflow, you could build a block theme completely in your browser and save your changes to GitHub, or you could improve/fix an existing one.
-->

Con este flujo de trabajo, podrías crear un tema de bloques completamente en tu navegador y guardar tus cambios en GitHub, o podrías mejorar/corregir uno existente.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<!--
<p></p>
Some more examples of this workflow:
-->

<p></p>
Algunos ejemplos más de este flujo de trabajo:

- [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
- [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
## Synchronize your Playground with a local folder and create GitHub Pull Requests
-->

## Sincroniza tu Playground con una carpeta local y crea Pull Requests en GitHub

<!--
In the Dock, click the **Autosaved** or **Unsaved** save status, select **Save
in a local directory**, click **Choose...**, and select a directory dedicated
to this Playground. After granting write access, click **Save**. Playground
copies the current site into the selected directory and overwrites files with
matching names; it does not import an existing site from that directory.
-->

En el Dock, haz clic en el estado **Guardado automáticamente** o **Sin guardar**, selecciona **Guardar en un directorio local**, haz clic en **Elegir...** y selecciona un directorio dedicado a este Playground. Después de conceder acceso de escritura, haz clic en **Guardar**. Playground copia el sitio actual en el directorio seleccionado y sobrescribe los archivos con nombres coincidentes; no importa un sitio existente desde ese directorio.

<!--
![The Store permanently pane with local-directory storage selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)
-->

![El panel Almacenar permanentemente con el almacenamiento en un directorio local seleccionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)

<!--
Local-directory storage uses the File System Access API, so availability depends on browser and platform support for choosing and writing to directories. Chromium-based desktop browsers usually support it. Browsers without that capability can still use browser storage and ZIP export. See [Browser support](/developers/limitations#browser-support) for the broader compatibility model.
-->

El almacenamiento en un directorio local usa la API de acceso al sistema de archivos, por lo que su disponibilidad depende de la compatibilidad del navegador y la plataforma para elegir directorios y escribir en ellos. Los navegadores de escritorio basados en Chromium suelen admitirlo. Los navegadores sin esta capacidad pueden seguir usando el almacenamiento del navegador y la exportación ZIP. Consulta [Compatibilidad con navegadores](/developers/limitations#compatibilidad-con-navegadores) para conocer el modelo de compatibilidad general.

<!--
Files changed in Playground are written to the selected directory. Files changed on disk are not pulled into the running Playground automatically. For a local-directory Playground, open the **Saved** status menu in the Dock and choose **Reload files from disk** when you want Playground to read the current files from the directory.
-->

Los archivos modificados en Playground se escriben en el directorio seleccionado. Los archivos modificados en el disco no se cargan automáticamente en el Playground en ejecución. En un Playground guardado en un directorio local, abre el menú de estado **Guardado** del Dock y elige **Recargar archivos desde el disco** cuando quieras que Playground lea los archivos actuales del directorio.

<!--
With this workflow, you can create GitHub PRs directly from changes made in your local directory.
-->

Con este flujo de trabajo, puedes crear PRs en GitHub directamente a partir de los cambios realizados en tu directorio local.

<!--
See here a little demo of this workflow in action:
-->

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

<!--
You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.
-->

Puedes [usar WordPress Playground en Node.js](/developers/local-development/php-wasm-node) para crear nuevas herramientas. El paquete [@php-wasm/node](https://npmjs.org/@php-wasm/node), que incluye el runtime de PHP WebAssembly, es por ejemplo, el paquete utilizado para [https://playground.wordpress.net/](https://playground.wordpress.net/).

<!--
Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with OpenAI provides a WordPress translations tool “in place” where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

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

<!--
You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.
-->

También puedes instalar Playground en tu dispositivo como una Aplicación Web Progresiva (PWA) para iniciar Playground directamente desde la pantalla de inicio, al igual que una aplicación nativa.

<!--
Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

Puedes leer [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) para más información.

<!--
## Embed a WordPress site in non-web environments
-->

## Incrusta un sitio de WordPress en entornos no web

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->

La guía [Cómo lanzar un sitio real de WordPress en una aplicación nativa de iOS a través de Playground](../guides/wordpress-native-ios-app) muestra cómo podemos aprovechar Playground para empaquetar un sitio de WordPress en una aplicación IOS.
