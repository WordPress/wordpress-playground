---
slug: /contributing/code
---

<!--
# Code contributions
-->

# Contribuciones de código

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

Como todos los proyectos de WordPress, Playground utiliza GitHub para gestionar el código y hacer seguimiento de los problemas. El repositorio principal está en [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) y el repositorio de Playground Tools está en [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

<!--
:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or local development tools—start there.

:::
-->

:::info Contribuye a las herramientas de Playground

Esta guía incluye enlaces al repositorio principal, pero todos los pasos y opciones se aplican a ambos. Si estás interesado en los plugins o en las herramientas de desarrollo local, empieza por ahí.

:::

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

Explora [la lista de problemas abiertos](https://github.com/wordpress/wordpress-playground/issues) para encontrar en qué trabajar. La etiqueta [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) es un punto de partida recomendado para los que contribuyen por primera vez.

<!--
Be sure to review the following resources before you begin:
-->

Asegúrate de revisar los siguientes recursos antes de empezar:

<!--
-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

-   [Principios de codificación](/contributing/coding-standards)
-   [Arquitectura](/developers/architecture)
-   [Visión y Filosofía](https://github.com/WordPress/wordpress-playground/issues/472)
-   [Hoja de ruta de WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
## Contribute Pull Requests
-->

## Contribuir con Pull Requests

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

[Haz un fork del repositorio de Playground](https://github.com/WordPress/wordpress-playground/fork) y clónalo en tu máquina local. Para ello, copia y pega estos comandos en tu terminal:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

Crea una rama, haz los cambios y pruébalo localmente ejecutando el siguiente comando:

```bash
npm run dev
```

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

Playground se abrirá en una nueva pestaña del navegador y se actualizará automáticamente con cada cambio.

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

Cuando estés listo, haz commit de los cambios y envía un Pull Request.

<!--
:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

:::info Formato

Nos encargamos del formato del código y del linting automáticamente. Relájate, escribe y deja que las máquinas hagan el trabajo.

:::

<!--
### Running a local Multisite
-->

### Ejecutar un Multisite local

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.
-->

WordPress Multisite tiene algunas [restricciones cuando se ejecuta localmente](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). Si planeas probar una red Multisite usando el paso `enableMultisite` de Playground, asegúrate de cambiar el puerto por defecto de `wp-now` o de establecer un dominio de prueba local que se ejecute a través de HTTPS.

<!--
To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

Para cambiar el puerto por defecto de `wp-now` al soportado por WordPress Multisite, ejecútalo usando la bandera `--port=80`:

```bash
npx @wp-now/wp-now start --port=80
```

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

Hay varias maneras de configurar un dominio de prueba local, incluyendo la edición de tu archivo `hosts`. Si no estás seguro de cómo hacerlo, te sugerimos que instales [Laravel Valet](https://laravel.com/docs/11.x/valet) y luego ejecutes el siguiente comando:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

<!--
Your dev server is now available on https://playground.test.
-->

Tu servidor de desarrollo está ahora disponible en https://playground.test.

<!--
## Debugging
-->

## Depuración

<!--
### Use VS Code and Chrome
-->

### Usar VS Code y Chrome

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:
-->

Si usas VS Code y tienes Chrome instalado, puedes depurar Playground en el editor de código:

<!--
-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

-   Abre la carpeta del proyecto en VS Code.
-   Selecciona Ejecutar > Iniciar depuración en el menú principal o pulsa `F5`/`fn`+`F5`.

<!--
### Debugging PHP
-->

### Depuración de PHP

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->

Playground registra los errores de PHP en la consola del navegador después de cada solicitud PHP.
