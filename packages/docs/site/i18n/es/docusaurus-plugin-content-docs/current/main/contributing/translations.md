---
slug: /contributing/translations
---

<!--
# Contributions to translations
-->

# Contribuciones a las traducciones

<!--
You can help translate the Playground documentation into any language. This page provides a comprehensive guide on how to contribute to the translation of Playground docs.
-->

Puedes ayudar a traducir la documentación de Playground a cualquier idioma. Esta página proporciona una guía completa sobre cómo contribuir a la traducción de los documentos de Playground.

<!--
## How can I contribute to translations?
-->

## ¿Cómo puedo contribuir a las traducciones?

<!--
By using the same workflow than contributing to any other docs page. You could fork [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and make PRs with your changes, or edit pages directly using the GitHub UI
-->

Usando el mismo flujo de trabajo que para contribuir a cualquier otra página de la documentación. Puedes hacer un fork de [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) y hacer PRs con tus cambios, o editar las páginas directamente usando la interfaz de usuario de GitHub.

<!--
:::info
Check the [How can I contribute?](/contributing/documentation#how-can-i-contribute) to learn more about how to contribute to Playground Docs
:::
-->

:::info
Consulta [¿Cómo puedo contribuir?](/contributing/documentation#how-can-i-contribute) para aprender más sobre cómo contribuir a la documentación de Playground.
:::

<!--
## Translations implementation details
-->

## Detalles de la implementación de las traducciones

<!--
:::info
Check the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of Docusaurus Docs to learn more about translation management in a Docusaurus website (the engine behind Playground Docs).
:::
-->

:::info
Consulta la [sección de Internacionalización](https://docusaurus.io/docs/i18n/introduction) de la documentación de Docusaurus para aprender más sobre la gestión de traducciones en un sitio web de Docusaurus (el motor detrás de la documentación de Playground).
:::

<!--
Languages available for the Docs site are defined on `packages/docs/site/docusaurus.config.js`. For example:
-->

Los idiomas disponibles para el sitio de documentación se definen en `packages/docs/site/docusaurus.config.js`. Por ejemplo:

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
Translated docs pages are located in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository.
-->

Las páginas de documentación traducidas se encuentran en el repositorio [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground).

<!--
Under `packages/docs/site/i18n/`, there's a folder for each language.
For example, for `es` (Spanish), there's a `packages/docs/site/i18n/es` folder.
-->

Dentro de `packages/docs/site/i18n/`, hay una carpeta para cada idioma.
Por ejemplo, para `es` (español), hay una carpeta `packages/docs/site/i18n/es`.

<!--
Under each language folder, there should be a `docusaurus-plugin-content-docs/current` folder.
For example, for `es` (Spanish), there's a `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` folder.
-->

Dentro de cada carpeta de idioma, debería haber una carpeta `docusaurus-plugin-content-docs/current`.
Por ejemplo, para `es` (español), hay una carpeta `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current`.

<!--
Under `docusaurus-plugin-content-docs/current`, the same structure of files of the original docs (same structure of files as) under `packages/docs/site/docs`) should be replicated.
-->

Dentro de `docusaurus-plugin-content-docs/current`, se debe replicar la misma estructura de archivos de la documentación original (la misma estructura de archivos que se encuentra en `packages/docs/site/docs`).

<!--
For example, for `es` (Spanish), the following translated files exist: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`
-->

Por ejemplo, para `es` (español), existen los siguientes archivos traducidos: `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`

<!--
If a file is not available under a language's folder, the original file in the default language will be loaded.
-->

Si un archivo no está disponible en la carpeta de un idioma, se cargará el archivo original en el idioma por defecto.

<!--
When a new language is added (see PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)), you can run `npm run write-translations -- --locale <%LANGUAGE%>` from `packages/docs/site` to generate the JSON files containing messages that can be translated into a specific language.
-->

Cuando se añade un nuevo idioma (ver PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)), puedes ejecutar `npm run write-translations -- --locale <%LANGUAGE%>` desde `packages/docs/site` para generar los archivos JSON que contienen los mensajes que se pueden traducir a un idioma específico.

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

Con la configuración adecuada de i18n en `docusaurus.config.js` y los archivos en `i18n`, al ejecutar `npm run build:docs` desde la raíz del proyecto, se crearán carpetas específicas para cada idioma en `dist`.

<!--
## How to locally test a language
-->

## Cómo probar un idioma localmente

<!--
To locally test an existing language, you can do:
-->

Para probar un idioma existente localmente, puedes hacer lo siguiente:

<!--
-   Modify (translate) any file under one of the available languages: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   From `/packages/docs/site` run the version for the language you'd like to test. For example, to test `es`:
-->

-   Modifica (traduce) cualquier archivo en uno de los idiomas disponibles: `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   Desde `/packages/docs/site` ejecuta la versión para el idioma que te gustaría probar. Por ejemplo, para probar `es`:

```

npm run dev:docs -- --locale es

```

<!--
## Language Switcher - UI element to change language
-->

## Selector de idioma - Elemento de la interfaz de usuario para cambiar de idioma

<!--
The "Language Switcher" is a UI element provided by Docusaurus (the docs engine behind Playground Docs) that allows users to change the language of a specific page.
-->

El "Selector de idioma" es un elemento de la interfaz de usuario proporcionado por Docusaurus (el motor de documentación detrás de Playground Docs) que permite a los usuarios cambiar el idioma de una página específica.

<!--
To give more visibility to a translated version, the language switcher can be displayed by adding the following lines to `packages/docs/site/docusaurus.config.js`
-->

Para dar más visibilidad a una versión traducida, se puede mostrar el selector de idioma añadiendo las siguientes líneas a `packages/docs/site/docusaurus.config.js`

```

{
  type: 'localeDropdown',
  position: 'right',
},

```

<!--
This will generate a dropdown in the header to access directly to a language version of each file.
-->

Esto generará un menú desplegable en la cabecera para acceder directamente a la versión de cada archivo en un idioma.

<!--
It's strongly recommended that a specific language is activated in this Dropdown only when there's a fair amount of pages translated. If it's activated with a few pages translated, the user's experience will be that whenever they switch to the language, no page will be translated into that language.
-->

Se recomienda encarecidamente que un idioma específico se active en este menú desplegable solo cuando haya una cantidad considerable de páginas traducidas. Si se activa con pocas páginas traducidas, la experiencia del usuario será que cada vez que cambie de idioma, ninguna página estará traducida a ese idioma.

<!--
### Making a language publicly available on the Language Switcher
-->

### Hacer que un idioma esté disponible públicamente en el Selector de idioma

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

Todos los idiomas están disponibles una vez que la configuración de i18n para un idioma está completa y la estructura de archivos correcta está en su lugar en `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
These language versions of the docs should be hidden on the language switcher hidden until there's a fair amount of pages translated for that language. To be more precise, the recommendation is only to make a language publicly available on the Language Switcher when at least the [Documentation](https://wordpress.github.io/wordpress-playground/) section is completely translated for a specific language, including the following sections:
-->

Estas versiones de la documentación en otros idiomas deben estar ocultas en el selector de idioma hasta que haya una cantidad considerable de páginas traducidas para ese idioma. Para ser más precisos, la recomendación es hacer que un idioma esté disponible públicamente en el Selector de idioma solo cuando al menos la sección de [Documentación](https://wordpress.github.io/wordpress-playground/) esté completamente traducida para un idioma específico, incluyendo las siguientes secciones:

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
Even if the language switcher doesn't display a specific language, work on adding translated pages can still progress, as the translated pages will become publicly available once the PRs containing the translated files are merged.
-->

Incluso si el selector de idioma no muestra un idioma específico, el trabajo de añadir páginas traducidas puede continuar, ya que las páginas traducidas estarán disponibles públicamente una vez que se fusionen los PRs que contienen los archivos traducidos.

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

Suponiendo que el idioma `fr` es el primer idioma con las páginas del hub de Documentación (Guía de inicio rápido, instancia web de Playground, Acerca de Playground, Guías,...) completamente traducidas al francés, el `docusaurus.config.js` debería verse así en esa rama para que `npm run build:docs` genere correctamente el subsitio `fr` y solo muestre el idioma francés en el selector de idioma `localeDropdown`.

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
### Testing the Language Switcher locally
-->

### Probar el Selector de idioma localmente

<!--
Regarding testing the `localeDropdown` locally, I have found that although it is displayed locally, it doesn't work locally as expected, as the translated pages are not found. But it seems to work well in production.
-->

En cuanto a probar el `localeDropdown` localmente, he descubierto que aunque se muestra localmente, no funciona como se esperaba, ya que no se encuentran las páginas traducidas. Pero parece que funciona bien en producción.

<!--
You can test the `localeDropdown` from any fork and do so from the root of the project:
-->

Puedes probar el `localeDropdown` desde cualquier fork y hacerlo desde la raíz del proyecto:

```
npm run build:docs
npm run deploy:docs
```

<!--
This generates three versions of the docs in the GitHub Pages of my forked repo:
-->

Esto genera tres versiones de la documentación en las Páginas de GitHub de mi repositorio "forkeado":

```
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/es/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/fr/
```

<!--
A possible approach to testing the `localeDropdown` feature is to deploy it to the GitHub Pages of a forked repository.
-->

Un posible enfoque para probar la función `localeDropdown` es desplegarla en las Páginas de GitHub de un repositorio "forkeado".

<!--
## Process to translate one page into a language
-->

## Proceso para traducir una página a un idioma

<!--
The recommended process is to copy and paste the `.md` file from the original path (`packages/docs/site/docs`) into the desired language path ( `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). It is important to replicate the structure of files at `packages/docs/site/docs`
-->

El proceso recomendado es copiar y pegar el archivo `.md` desde la ruta original (`packages/docs/site/docs`) a la ruta del idioma deseado (`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). Es importante replicar la estructura de archivos que hay en `packages/docs/site/docs`.

<!--
The file under `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` can be translated, and a PR can be created with the new changes.
-->

El archivo en `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` puede ser traducido, y se puede crear un PR con los nuevos cambios.

<!--
When the PR is merged, the translated version of that page should appear under https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
-->

Cuando el PR se fusione, la versión traducida de esa página debería aparecer en https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}

<!--
## Review process
-->

## Proceso de revisión

<!--
To facilitate the reviewing process, we do recommend keeping the original content commented close to the translated content, for example:
-->

Para facilitar el proceso de revisión, recomendamos mantener el contenido original comentado cerca del contenido traducido, por ejemplo:

```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 ¡Hola! Bienvenido a la documentación de WordPress Playground.

Playground es una herramienta en línea para experimentar y aprender sobre WordPress. Este sitio (Documentación) es donde encontrarás toda la información que necesitas para empezar a usar Playground.

<!--
<p class="docs-hubs">The WordPress Playground documentation is distributed across four separate hubs (subsites):</p>
-->
<p class="docs-hubs">La documentación de WordPress Playground se distribuye en cuatro hubs (subsitios) separados:</p>
```

<!--
For an improved review process, find reviewers matching the PR's language. Request a reviewer by posting on https://make.wordpress.org/polyglots/ and include the locale tag (e.g., #ja for Japanese). This will notify the Japanese GTEs.
-->

Para un proceso de revisión mejorado, busca revisores que coincidan con el idioma del PR. Solicita un revisor publicando en https://make.wordpress.org/polyglots/ e incluye la etiqueta de la configuración regional (por ejemplo, #ja para japonés). Esto notificará a los GTEs japoneses.
