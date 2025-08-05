---
slug: /contributing/contributor-day
---

<!--
# WordCamp Contributor Day
-->

# Día del Contribuidor de WordCamp

<!--
The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.
-->

La [extensión de WordPress Playground para VS Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) y [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) agilizan el proceso de configuración de un entorno local de WordPress. WordPress Playground impulsa ambos, sin necesidad de Docker, MySQL o Apache.

<!--
Keep reading to learn how to use these tools for [local development](/developers/local-development/wp-playground-cli) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.
-->

Sigue leyendo para aprender a usar estas herramientas para el [desarrollo local](/developers/local-development/wp-playground-cli) al contribuir a WordPress. Ten en cuenta que la extensión y el paquete NPM están en desarrollo, y no todos los [equipos de Make WordPress](https://make.wordpress.org/) son totalmente compatibles.

<!--
## Getting Started
-->

## Primeros pasos

<!--
### VS Code Playground extension
-->

### Extensión de Playground para VS Code

<!--
The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.
-->

La [extensión de Playground para Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) es un entorno de desarrollo amigable y sin configuración.

<!--
1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.
-->

1. Abre VS Code y ve a la pestaña **Extensiones** (**Ver > Extensiones**).
2. En la barra de búsqueda, escribe _WordPress Playground_ y haz clic en **Instalar**.
3. Para interactuar con Playground, haz clic en el nuevo icono en la **Barra de Actividad** y pulsa el botón **Iniciar Servidor de WordPress**.
4. Se abrirá una nueva pestaña en tu navegador en segundos.

<!--
### @wp-playground/cli NPM package
-->

### Paquete NPM @wp-playground/cli

<!--
`@wp-playground/cli` is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.
-->

`@wp-playground/cli` es una herramienta de línea de comandos que te permite levantar un sitio de WordPress con un solo comando. No se requiere Docker, MySQL o Apache.

<!--
#### Prerequisites
-->

#### Requisitos previos

<!--
`@wp-playground/cli` requires Node.js 20.18 or newer and NPM. If you haven’t yet, [download and install](https://nodejs.org/en/download) both before you begin.
-->

`@wp-playground/cli` requiere Node.js 20.18 o superior y NPM. Si aún no lo has hecho, [descarga e instala](https://nodejs.org/en/download) ambos antes de comenzar.

<!--
Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).
-->

Dependiendo del equipo de Make WordPress al que contribuyas, es posible que necesites una versión de Node.js diferente a la que tienes instalada. Puedes usar Node Version Manager (NVM) para cambiar entre versiones. [Encuentra la guía de instalación aquí](https://github.com/nvm-sh/nvm#installing-and-updating).

<!--
#### Running `@wp-playground/cli`
-->

#### Ejecutando `@wp-playground/cli`

<!--
You don’t have to install `@wp-playground/cli` on your device to use it. Navigate to your plugin or theme directory and start `@wp-playground/cli` with the following commands:
-->

No es necesario que instales `@wp-playground/cli` en tu dispositivo para usarlo. Ve a tu directorio de plugins o temas e inicia `@wp-playground/cli` con los siguientes comandos:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

<!--
## Ideas for contributors
-->

## Ideas para contribuidores

<!--
### Create a Gutenberg Pull Request (PR)
-->

### Crear un Pull Request (PR) de Gutenberg

<!--
1. Fork the [Gutenberg repository](https://github.com/WordPress/gutenberg) in your GitHub account.
2. Then, clone the forked repository to download the files.
3. Install the necessary dependencies and build the code in development mode.
-->

1. Haz un fork del [repositorio de Gutenberg](https://github.com/WordPress/gutenberg) en tu cuenta de GitHub.
2. Luego, clona el repositorio "forkeado" para descargar los archivos.
3. Instala las dependencias necesarias y compila el código en modo de desarrollo.

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

<!--
:::info

If you’re unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `@wp-playground/cli` replaces `wp-env`.

:::
-->

:::info

Si no estás seguro de los pasos anteriores, visita la [Guía del Contribuidor del Proyecto Gutenberg](https://developer.wordpress.org/block-editor/contributors/) oficial. Ten en cuenta que en este caso, `@wp-playground/cli` reemplaza a `wp-env`.

:::

<!--
Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `@wp-playground/cli`:
-->

Abre una nueva pestaña de terminal, navega al directorio de Gutenberg e inicia WordPress usando `@wp-playground/cli`:

```bash
cd gutenberg
npx @wp-playground/cli@latest server --auto-mount
```

<!--
When you’re ready, commit and push your changes to your forked repository on GitHub and open a Pull Request on the Gutenberg repository.
-->

Cuando estés listo, haz commit y push de tus cambios a tu repositorio "forkeado" en GitHub y abre un Pull Request en el repositorio de Gutenberg.

<!--
### Test a Gutenberg PR
-->

### Probar un PR de Gutenberg

<!--
1. To test other Gutenberg PRs, checkout the branch associated with it.
2. Pull the latest changes to ensure your local copy is up to date.
3. Next, install the necessary dependencies, ensuring your testing environment matches the latest changes.
4. Finally, build the code in development mode.
-->

1. Para probar otros PRs de Gutenberg, haz checkout a la rama asociada a él.
2. Haz pull de los últimos cambios para asegurarte de que tu copia local esté actualizada.
3. A continuación, instala las dependencias necesarias, asegurándote de que tu entorno de prueba coincida con los últimos cambios.
4. Finalmente, compila el código en modo de desarrollo.

```bash
# copy the branch-name from GitHub #
git checkout branch-name
git pull
npm install
npm run dev

# In a different terminal inside the Gutenberg directory *
npx @wp-playground/cli@latest server --auto-mount
```

<!--
#### Test a Gutenberg PR with Playground in the browser
-->

#### Probar un PR de Gutenberg con Playground en el navegador

<!--
You don’t need a local development environment to test Gutenberg PRs—use Playground to do it directly in the browser.
-->

No necesitas un entorno de desarrollo local para probar los PRs de Gutenberg; usa Playground para hacerlo directamente en el navegador.

<!--
1. Copy the ID of the PR you’d like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground’s [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.
-->

1. Copia el ID del PR que te gustaría probar (elige uno de la [lista de Pull Requests abiertos](https://github.com/WordPress/gutenberg/pulls)).
2. Abre el [Visualizador de PRs de Gutenberg](https://playground.wordpress.net/gutenberg.html) de Playground y pega el ID que copiaste.
3. Una vez que hagas clic en **Ir**, Playground verificará que el PR es válido y abrirá una nueva pestaña con el PR correspondiente, permitiéndote revisar los cambios propuestos.

<!--
## Translate WordPress Plugins with Playground in the browser
-->

## Traducir plugins de WordPress con Playground en el navegador

<!--
You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).
-->

Puedes traducir los plugins de WordPress compatibles cargando el plugin que quieres traducir y usando la Traducción en Línea. Si los desarrolladores del plugin han añadido la opción, encontrarás el enlace **Traducir en vivo** en la barra de herramientas superior derecha de la vista de traducción. Puedes leer más sobre esta nueva y emocionante opción en [esta entrada del blog de Polyglots](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

<!--
## Get help and contribute to WordPress Playground
-->

## Obtén ayuda y contribuye a WordPress Playground

<!--
Have a question or an idea for a new feature? Found a bug? Something’s not working as expected? We’re here to help:
-->

¿Tienes alguna pregunta o una idea para una nueva función? ¿Has encontrado un error? ¿Algo no funciona como se esperaba? Estamos aquí para ayudar:

<!--
-   During Contributor Day, you can reach us at the **Playground table**.
-   Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Share your feedback on the [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
-->

-   Durante el Día del Contribuidor, puedes encontrarnos en la **mesa de Playground**.
-   Abre un issue en el [repositorio de GitHub de WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/new). Si tu enfoque es la extensión de VS Code, el paquete NPM o los plugins, abre un issue en el [repositorio de Playground Tools](https://github.com/WordPress/playground-tools/issues/new).
-   Comparte tus comentarios en el canal de Slack [**#playground**](https://wordpress.slack.com/archives/C04EWKGDJ0K).
