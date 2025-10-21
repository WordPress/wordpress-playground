---
slug: /contributing/translations
title: Contribuciones a las traducciones
description: Aprende a traducir la documentación de Playground, incluyendo la estructura de archivos, las pruebas locales y el proceso de revisión.
---

<!--
# Contributions to translations
-->

# Contribuciones a las traducciones

<!--
Help make WordPress Playground accessible to a global audience by translating its documentation. This guide provides everything you need to know to get started. Contributing translations follows the same workflow as any other documentation change. You can either fork the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository and create a pull request (PR) with your changes or edit pages directly using the GitHub UI.
-->

Ayuda a hacer WordPress Playground accesible a una audiencia global traduciendo su documentación. Esta guía proporciona todo lo que necesitas saber para comenzar. Contribuir con traducciones sigue el mismo flujo de trabajo que cualquier otro cambio en la documentación. Puedes hacer un fork del repositorio [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) y crear un pull request (PR) con tus cambios, o editar páginas directamente usando la interfaz de usuario de GitHub.

<!--
:::info
For a detailed guide on the contribution workflow (forking, creating PRs, etc.), please see our [documentation contribution guide](/contributing/documentation#how-can-i-contribute)
:::
-->

:::info
Para una guía detallada sobre el flujo de trabajo de contribución (hacer fork, crear PRs, etc.), consulta nuestra [guía de contribución a la documentación](/contributing/documentation#how-can-i-contribute)
:::

<!--
## How Translations Work
-->

## Cómo funcionan las traducciones

<!--
Playground's documentation site is built with Docusaurus, which handles the internationalization (i18n) features.
-->

El sitio de documentación de Playground está construido con Docusaurus, que maneja las funciones de internacionalización (i18n).

<!--
:::info
To learn more about how Docusaurus manages translations, see the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of the official Docusaurus documentation.
:::
-->

:::info
Para aprender más sobre cómo Docusaurus gestiona las traducciones, consulta la [sección de Internacionalización](https://docusaurus.io/docs/i18n/introduction) de la documentación oficial de Docusaurus.
:::

<!--
### Configuration
-->

### Configuración

<!--
Available languages are defined in the `packages/docs/site/docusaurus.config.js` file. For example:
-->

Los idiomas disponibles se definen en el archivo `packages/docs/site/docusaurus.config.js`. Por ejemplo:

```
i18n: {
  defaultLocale: 'en',
  path: 'i18n',
  locales: ['en', 'fr'],
  localeConfigs: {
	en: {
		label: 'English',
		path: 'en',
	},
	fr: {
		label: 'French',
		path: 'fr',
	},
  },
}
```

<!--
### File Structure
-->

### Estructura de archivos

<!--
All translated documentation pages are located within the `packages/docs/site/i18n/` directory, organized by language code.
-->

Todas las páginas de documentación traducidas se encuentran dentro del directorio `packages/docs/site/i18n/`, organizadas por código de idioma.

<!--
For a language to work correctly, its file structure must mirror the original English documentation found in `packages/docs/site/docs`.
-->

Para que un idioma funcione correctamente, su estructura de archivos debe reflejar la documentación original en inglés que se encuentra en `packages/docs/site/docs`.

<!--
For example, the Spanish (es) translation for `docs/main/intro.md` must be placed at:
packages`/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.
-->

Por ejemplo, la traducción al español (es) de `docs/main/intro.md` debe ubicarse en:
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

<!--
If a translated file does not exist for a specific language, Docusaurus will automatically fall back to the English version of that page.
-->

Si un archivo traducido no existe para un idioma específico, Docusaurus automáticamente recurrirá a la versión en inglés de esa página.

<!--
### Generating Translation Files
-->

### Generación de archivos de traducción

<!--
When adding a new language, you can generate the necessary JSON files for UI strings (like button labels and navigation items) by running the following command from the `packages/docs/site` directory:
-->

Al agregar un nuevo idioma, puedes generar los archivos JSON necesarios para las cadenas de la interfaz de usuario (como etiquetas de botones y elementos de navegación) ejecutando el siguiente comando desde el directorio `packages/docs/site`:

<!--
```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```
-->

```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

Con la configuración adecuada de i18n en `docusaurus.config.js` y los archivos en `i18n`, al ejecutar `npm run build:docs` desde la raíz del proyecto, se crearán carpetas específicas para cada idioma en `dist`.

<!--
## Testing Translations Locally
-->

## Prueba de traducciones localmente

<!--
To preview your changes for an existing language:
-->

Para previsualizar tus cambios para un idioma existente:

<!--
1. Modify or add a translated file in the appropriate language directory, such as `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. From the `/packages/docs/site` directory, run the local development server for your target language. For example, to test Spanish (es):
-->

1. Modifica o agrega un archivo traducido en el directorio del idioma apropiado, como `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. Desde el directorio `/packages/docs/site`, ejecuta el servidor de desarrollo local para tu idioma de destino. Por ejemplo, para probar español (es):

```bash

npm run dev -- --locale es

```

<!--
## The Language Switcher
-->

## El selector de idioma

<!--
The language switcher is a dropdown menu that allows users to select their preferred language.
-->

El selector de idioma es un menú desplegable que permite a los usuarios seleccionar su idioma preferido.

<!--
![Documentation Language Switcher](@site/static/img/contributing/language-switcher-docs.webp)
-->

![Selector de idioma de la documentación](@site/static/img/contributing/language-switcher-docs.webp)

<!--
### Making a language publicly available on the Language Switcher
-->

### Hacer que un idioma esté disponible públicamente en el selector de idioma

<!--
We recommend only adding a language to the switcher when a significant portion of the documentation has been translated. This avoids a poor user experience where switching to a new language results in seeing mostly untranslated English content.
-->

Recomendamos solo agregar un idioma al selector cuando una porción significativa de la documentación haya sido traducida. Esto evita una mala experiencia de usuario donde cambiar a un nuevo idioma resulta en ver principalmente contenido en inglés sin traducir.

<!--
As a guideline, a language should be made publicly available in the switcher only when the entire "Documentation" hub is translated, including these key sections:
-->

Como guía, un idioma solo debe estar públicamente disponible en el selector cuando todo el hub de "Documentación" esté traducido, incluyendo estas secciones clave:

<!--
-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)
-->

-   [Guía de inicio rápido](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Instancia web de Playground](https://wordpress.github.io/wordpress-playground/web-instance)
-   [Acerca de Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guías](https://wordpress.github.io/wordpress-playground/guides)
-   [Contribuir](https://wordpress.github.io/wordpress-playground/contributing)
-   [Enlaces y Recursos](https://wordpress.github.io/wordpress-playground/resources)

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

Todos los idiomas están disponibles una vez que la configuración de i18n para un idioma está completa y la estructura de archivos correcta está en su lugar bajo `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

Suponiendo que el idioma `fr` es el primer idioma con las páginas del hub de Documentación (Guía de inicio rápido, Instancia web de Playground, Acerca de Playground, Guías,...) completamente traducidas al francés, el `docusaurus.config.js` debería verse así en esa rama para que `npm run build:docs` genere correctamente el subsitio `fr` y solo muestre el idioma francés en el selector de idioma `localeDropdown`.

```
  {
    "i18n": {
      "defaultLocale": "en",
      "path": "i18n",
      "locales": [
        "en",
        "fr"
      ],
      "localeConfigs": {
        "en": {
          "label": "English",
          "path": "en"
        },
        "fr": {
          "label": "French",
          "path": "fr"
        }
      }
    }
  },
  {
    "type": "localeDropdown",
    "position": "right"
  }
```

<!--
## Translation Workflow
-->

## Flujo de trabajo de traducción

<!--
Follow these steps to translate a page:
-->

Sigue estos pasos para traducir una página:

<!--
1. **Check for an Existing Translation Issue**: First, [search the repository issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) to see if a tracking issue for your desired language already exists. If it does, comment on the issue to claim the page(s) you would like to translate.
2. **Create a New Translation Issue**: If no issue exists, please create a new one to track the translation progress for the language. You can model it after issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) and use the markdown checklist below to track progress.
3. **Translate the File**:
-->

1. **Buscar una issue de traducción existente**: Primero, [busca en las issues del repositorio](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) para ver si ya existe una issue de seguimiento para tu idioma deseado. Si existe, comenta en la issue para reclamar la(s) página(s) que te gustaría traducir.
2. **Crear una nueva issue de traducción**: Si no existe ninguna issue, por favor crea una nueva para rastrear el progreso de la traducción para el idioma. Puedes modelarla según la issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) y usar la lista de verificación en markdown a continuación para rastrear el progreso.
3. **Traducir el archivo**:

<!--
-   Check if you have the latest version of the documentation
-   Copy the original .md file from `packages/docs/site/docs/...` to the corresponding path in the language directory (e.g., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). It is crucial to replicate the original file structure.
-   Translate the content of the new file, keeping the original content commented out `<!-- English Content -->`.

-   The assets are listed at `packages/docs/site/static/img/` only place assets inside the translation folder when it requires localized content.
-   Once the translations are ready, check if the docs build script is running properly `npm run build:docs`.
    -->

-   Verifica que tengas la última versión de la documentación
-   Copia el archivo .md original de `packages/docs/site/docs/...` a la ruta correspondiente en el directorio del idioma (por ejemplo, `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). Es crucial replicar la estructura de archivos original.
-   Traduce el contenido del nuevo archivo, manteniendo el contenido original comentado `<!-- English Content -->`.
-   Los recursos están listados en `packages/docs/site/static/img/` solo coloca recursos dentro de la carpeta de traducción cuando requiera contenido localizado.
-   Una vez que las traducciones estén listas, verifica si el script de compilación de documentación se ejecuta correctamente `npm run build:docs`.

<!--
4. **Create a pull request with your changes**
-->

4. **Crear un pull request con tus cambios**

<!--
-   Add a prefix to the title `[i18n]` to help to identify the translations
-   Describe the pages that you translated
-   Request a review at `#playground` or `#polyglots` at `wordpress.slack.com`
-->

-   Agrega un prefijo al título `[i18n]` para ayudar a identificar las traducciones
-   Describe las páginas que tradujiste
-   Solicita una revisión en `#playground` o `#polyglots` en `wordpress.slack.com`

<!--
:::info
We highly recommend submitting pull requests with a small number of translated pages. This approach simplifies the review process and allows for a more gradual and manageable integration of your work.
:::
-->

:::info
Recomendamos encarecidamente enviar pull requests con un número pequeño de páginas traducidas. Este enfoque simplifica el proceso de revisión y permite una integración más gradual y manejable de tu trabajo.
:::

<!--
### Translation Tracking Template
-->

### Plantilla de seguimiento de traducción

<!--
You can use the following markdown in your tracking issue:
-->

Puedes usar el siguiente markdown en tu issue de seguimiento:

<!--
```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md #2291
  - [ ] index.md #2282
  - [ ] launch.md #2292
  - [ ] test.md #2302
- contributing
  - [ ] code.md #2218
  - [ ] coding-standards.md #2219
  - [ ] contributor-day.md #2246
  - [ ] contributor-badge.md
  - [ ] documentation.md #2271
  - [ ] translations.md #2201
- guides
  - [ ] for-plugin-developers.md #2210
  - [ ] for-theme-developers.md #2211
  - [ ] index.md #2209
  - [ ] providing-content-for-your-demo.md #2213
  - [ ] wordpress-native-ios-app.md #2214
- [ ] intro.md #2198
- [ ] quick-start-guide.md #2204
- [ ] resources.md #2207
- [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- blueprints
  - [ ] 01-index.md #2305
  - [ ] 02-using-blueprints.md #2330
  - [ ] 03-data-format.md #2340
   - [ ] 04-resources.md #2352
   - [ ] 05-steps-shorthands.md  #2386
  - [ ] 05-steps.md  #2386
  - [ ] 06-bundles.md #2438
   - [ ] 07-json-api-and-function-api.md #2438
   - [ ] 08-examples.md #2474
   - [ ] 09-troubleshoot-and-debug-blueprints.md #2474
   - [ ] intro.md #2489
   - tutorial
       - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511
       - [ ] 02-how-to-load-run-blueprints.md #2526
       - [ ] 03-build-your-first-blueprint.md
       - [ ] index.md #2511
</details>

<details open>
<summary><h3>Developers</h3></summary>

- [ ] developers
   - [ ] 03-build-an-app
      - [ ] 01-index.md
   - [ ] 05-local-development
      - [ ] 01-wp-now.md
      - [ ] 02-vscode-extension.md
      - [ ] 03-php-wasm-node.md
      - [ ] intro.md
   - [ ] 06-apis
      - [ ] 01-index.md
      - [ ] javascript-api
         - [ ] 01-index.md
         - [ ] 02-index-html-vs-remote-html.md
         - [ ] 03-playground-api-client.md
         - [ ] 04-blueprint-json-in-api-client.md
         - [ ] 05-blueprint-functions-in-api-client.md
         - [ ] 06-mount-data.md
      - [ ] query-api
          - [ ] 01-index.md
   - [ ] 23-architecture
      - [ ] 01-index.md
      - [ ] 02-wasm-php-overview.md
      - [ ] 03-wasm-php-compiling.md
      - [ ] 04-wasm-php-javascript-module.md
      - [ ] 05-wasm-php-filesystem.md
      - [ ] 07-wasm-asyncify.md
      - [ ] 08-browser-concepts.md
      - [ ] 09-browser-tab-orchestrates-execution.md
      - [ ] 10-browser-iframe-rendering.md
      - [ ] 11-browser-php-worker-threads.md
      - [ ] 12-browser-service-workers.md
      - [ ] 13-browser-scopes.md
      - [ ] 14-browser-cross-process-communication.md
      - [ ] 15-wordpress.md
      - [ ] 16-wordpress-database.md
      - [ ] 17-browser-wordpress.md
      - [ ] 18-host-your-own-playground.md
   - [ ] 24-limitations
      - [ ] 01-index.md
   - [ ] intro-devs.md
</details>
```
-->

```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md #2291
  - [ ] index.md #2282
  - [ ] launch.md #2292
  - [ ] test.md #2302
- contributing
  - [ ] code.md #2218
  - [ ] coding-standards.md #2219
  - [ ] contributor-day.md #2246
  - [ ] contributor-badge.md
  - [ ] documentation.md #2271
  - [ ] translations.md #2201
- guides
  - [ ] for-plugin-developers.md #2210
  - [ ] for-theme-developers.md #2211
  - [ ] index.md #2209
  - [ ] providing-content-for-your-demo.md #2213
  - [ ] wordpress-native-ios-app.md #2214
- [ ] intro.md #2198
- [ ] quick-start-guide.md #2204
- [ ] resources.md #2207
- [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- blueprints
  - [ ] 01-index.md #2305
  - [ ] 02-using-blueprints.md #2330
  - [ ] 03-data-format.md #2340
   - [ ] 04-resources.md #2352
   - [ ] 05-steps-shorthands.md  #2386
  - [ ] 05-steps.md  #2386
  - [ ] 06-bundles.md #2438
   - [ ] 07-json-api-and-function-api.md #2438
   - [ ] 08-examples.md #2474
   - [ ] 09-troubleshoot-and-debug-blueprints.md #2474
   - [ ] intro.md #2489
   - tutorial
       - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511
       - [ ] 02-how-to-load-run-blueprints.md #2526
       - [ ] 03-build-your-first-blueprint.md
       - [ ] index.md #2511
</details>

<details open>
<summary><h3>Developers</h3></summary>

- [ ] developers
   - [ ] 03-build-an-app
      - [ ] 01-index.md
   - [ ] 05-local-development
      - [ ] 01-wp-now.md
      - [ ] 02-vscode-extension.md
      - [ ] 03-php-wasm-node.md
      - [ ] intro.md
   - [ ] 06-apis
      - [ ] 01-index.md
      - [ ] javascript-api
         - [ ] 01-index.md
         - [ ] 02-index-html-vs-remote-html.md
         - [ ] 03-playground-api-client.md
         - [ ] 04-blueprint-json-in-api-client.md
         - [ ] 05-blueprint-functions-in-api-client.md
         - [ ] 06-mount-data.md
      - [ ] query-api
          - [ ] 01-index.md
   - [ ] 23-architecture
      - [ ] 01-index.md
      - [ ] 02-wasm-php-overview.md
      - [ ] 03-wasm-php-compiling.md
      - [ ] 04-wasm-php-javascript-module.md
      - [ ] 05-wasm-php-filesystem.md
      - [ ] 07-wasm-asyncify.md
      - [ ] 08-browser-concepts.md
      - [ ] 09-browser-tab-orchestrates-execution.md
      - [ ] 10-browser-iframe-rendering.md
      - [ ] 11-browser-php-worker-threads.md
      - [ ] 12-browser-service-workers.md
      - [ ] 13-browser-scopes.md
      - [ ] 14-browser-cross-process-communication.md
      - [ ] 15-wordpress.md
      - [ ] 16-wordpress-database.md
      - [ ] 17-browser-wordpress.md
      - [ ] 18-host-your-own-playground.md
   - [ ] 24-limitations
      - [ ] 01-index.md
   - [ ] intro-devs.md
</details>
```

<!--
### Translating with the GitHub Web Interface
-->

### Traducir con la interfaz web de GitHub

<!--
If you prefer not to use developer tools, you can easily contribute translations directly on the GitHub website. All you need is a free GitHub account.
-->

Si prefieres no usar herramientas de desarrollador, puedes contribuir fácilmente con traducciones directamente en el sitio web de GitHub. Todo lo que necesitas es una cuenta gratuita de GitHub.

<!--
This guide will show you how to both update an existing translation and add a brand-new one.
-->

Esta guía te mostrará cómo actualizar una traducción existente y agregar una nueva.

---

<!--
#### Updating an Existing Translation
-->

#### Actualizar una traducción existente

<!--
1.  **Navigate to the file.** Go to the repository and find the file you want to update. Translation files are located in a folder named after their language code. For example, all French translations are in `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.
-->

1.  **Navega al archivo.** Ve al repositorio y encuentra el archivo que deseas actualizar. Los archivos de traducción están ubicados en una carpeta nombrada según su código de idioma. Por ejemplo, todas las traducciones al francés están en `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.

<!--
2.  **Open the editor.** Select the file you wish to edit and click the pencil icon (**Edit this file**) in the upper right corner.
    ![Editing existing translation](@site/static/img/contributing/editing-translations.webp)
-->

2.  **Abre el editor.** Selecciona el archivo que deseas editar y haz clic en el icono de lápiz (**Edit this file**) en la esquina superior derecha.
    ![Editando traducción existente](@site/static/img/contributing/editing-translations.webp)

<!--
3.  **Fork the repository.** GitHub will automatically prompt you to **Fork this repository**. This creates a personal copy for you to edit safely. Click the button to proceed.
-->

3.  **Haz fork del repositorio.** GitHub automáticamente te pedirá **Fork this repository**. Esto crea una copia personal para que puedas editar de forma segura. Haz clic en el botón para continuar.

<!--
4.  **Make your changes.** The editor will open in your browser. Update the text with your improved translations.
-->

4.  **Haz tus cambios.** El editor se abrirá en tu navegador. Actualiza el texto con tus traducciones mejoradas.

<!--
5.  **Propose your changes.** Once you are finished, scroll to the bottom of the page. Add a brief title and description of your changes (e.g., "Fixing typos in French translation") and click the **Propose changes** button.
-->

5.  **Propón tus cambios.** Una vez que hayas terminado, desplázate hasta la parte inferior de la página. Agrega un título breve y una descripción de tus cambios (por ejemplo, "Corrigiendo errores tipográficos en la traducción al francés") y haz clic en el botón **Propose changes**.

<!--
6.  **Create a Pull Request.** On the next screen, click the **Create pull request** button. This will submit your changes to the project maintainers for review.
-->

6.  **Crea un Pull Request.** En la siguiente pantalla, haz clic en el botón **Create pull request**. Esto enviará tus cambios a los mantenedores del proyecto para su revisión.

---

<!--
#### Adding a New Translation
-->

#### Agregar una nueva traducción

<!--
1.  **Determine the correct file path.** The new file's path and name must mirror the original English file.

    -   **English original:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **French translation:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`
-->

1.  **Determina la ruta correcta del archivo.** La ruta y el nombre del nuevo archivo deben reflejar el archivo original en inglés.

    -   **Original en inglés:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **Traducción al francés:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`

<!--
2.  **Create the new file.** Navigate to the correct language folder (e.g., `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Click **Add file** > **Create new file**.
    ![Creating a new translation](@site/static/img/contributing/adding-file-github-ui.webp)

    -   **Pro Tip:** In the filename box, you can create new folders by typing the folder name followed by a `/`. For example, typing `main/contributing/documentation.md` will create the `main` and `contributing` folders automatically.
-->

2.  **Crea el nuevo archivo.** Navega a la carpeta del idioma correcto (por ejemplo, `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Haz clic en **Add file** > **Create new file**.
    ![Creando una nueva traducción](@site/static/img/contributing/adding-file-github-ui.webp)

    -   **Consejo profesional:** En el cuadro de nombre de archivo, puedes crear nuevas carpetas escribiendo el nombre de la carpeta seguido de un `/`. Por ejemplo, escribir `main/contributing/documentation.md` creará las carpetas `main` y `contributing` automáticamente.

<!--
3.  **Fork the repository.** Just like before, GitHub will prompt you to **Fork this repository**. Click the button to create your personal copy.
-->

3.  **Haz fork del repositorio.** Al igual que antes, GitHub te pedirá **Fork this repository**. Haz clic en el botón para crear tu copia personal.

<!--
4.  **Add the translated content.** The editor will open with an empty file. For the convenience of reviewers, please copy the content from the original English file and paste it into your new file, wrapping it in comment tags. Add your translation below it.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Ceci est le contenu traduit en français.
    ```

    ![GitHub UI Editor](@site/static/img/contributing/editor-github-ui.webp)

-->

4.  **Agrega el contenido traducido.** El editor se abrirá con un archivo vacío. Para la comodidad de los revisores, por favor copia el contenido del archivo original en inglés y pégalo en tu nuevo archivo, envolviéndolo en etiquetas de comentario. Agrega tu traducción debajo.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Este es el contenido traducido al español.
    ```

    ![Editor de interfaz de GitHub](@site/static/img/contributing/editor-github-ui.webp)

<!--
5.  **Commit the new file.** When you are done, scroll to the bottom. Add a title for your new file (e.g., "Add French translation for documentation.md") and click the **Commit new file** button.
-->

5.  **Confirma el nuevo archivo.** Cuando hayas terminado, desplázate hasta la parte inferior. Agrega un título para tu nuevo archivo (por ejemplo, "Agregar traducción al francés para documentation.md") y haz clic en el botón **Commit new file**.

<!--
6.  **Create a Pull Request.** On the next screen, click **Create pull request** to submit your new translation for review.
-->

6.  **Crea un Pull Request.** En la siguiente pantalla, haz clic en **Create pull request** para enviar tu nueva traducción para revisión.

<!--
## Review Process
-->

## Proceso de revisión

<!--
To simplify the review process, please keep the original English text as a comment directly above the translated content.
-->

Para simplificar el proceso de revisión, por favor mantén el texto original en inglés como un comentario directamente encima del contenido traducido.

<!--
```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem vindo a documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde podes testar e aprender mais sobre o WordPress. Nesta página(Documentação) irá encontrar todas as informações necessárias para começar a trabalhar com o Playground.

```
-->

```

<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 ¡Hola! Bienvenido a la documentación de WordPress Playground.

Playground es una herramienta en línea para experimentar y aprender sobre WordPress. Este sitio (Documentación) es donde encontrarás toda la información que necesitas para empezar a usar Playground.

```

<!--
:::info
This practice also helps the maintenance team identify outdated translations. When the original English content is updated, we can search the codebase for the old text (now in comments) and flag the corresponding translation for review.
:::
-->

:::info
Esta práctica también ayuda al equipo de mantenimiento a identificar traducciones desactualizadas. Cuando el contenido original en inglés se actualiza, podemos buscar en el código base el texto antiguo (ahora en comentarios) y marcar la traducción correspondiente para revisión.
:::

<!--
To find a reviewer fluent in the language of your PR, you can post a request on the [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/). Be sure to include the locale tag (e.g., #ja for Japanese) to notify the appropriate General Translation Editors (GTEs).
-->

Para encontrar un revisor que hable con fluidez el idioma de tu PR, puedes publicar una solicitud en el [blog Make WordPress Polyglots](https://make.wordpress.org/polyglots/). Asegúrate de incluir la etiqueta de localización (por ejemplo, #ja para japonés) para notificar a los Editores Generales de Traducción (GTEs) apropiados.

<!--
When the PR is merged, the translated version of that page should appear under `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, if you are contributing for the first time request your [Contributor Badge](/contributing/contributor-badge).
-->

Cuando el PR se fusione, la versión traducida de esa página debería aparecer en `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, si estás contribuyendo por primera vez, solicita tu [Insignia de Contribuidor](/contributing/contributor-badge).
```
