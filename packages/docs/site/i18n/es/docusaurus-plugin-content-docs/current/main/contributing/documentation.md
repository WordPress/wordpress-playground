---
slug: /contributing/documentation
---

<!--
# Documentation contributions
-->

# Contribuciones a la documentación

<!--
[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.
-->

El [sitio de documentación de WordPress Playground](/) es mantenido por voluntarios como tú, a quienes les encantaría tu ayuda.

<!--
All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

Todos los problemas relacionados con la documentación están etiquetados como [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) o [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) en el repositorio [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground). Explora la lista de problemas abiertos para encontrar uno en el que te gustaría trabajar. Alternativamente, si crees que falta algo en la documentación actual, abre un issue para discutir tu sugerencia.

<!--
## How can I contribute?
-->

## ¿Cómo puedo contribuir?

<!--
You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.
-->

Puedes contribuir [abriendo un issue en el repositorio del proyecto](https://github.com/WordPress/wordpress-playground/issues/new) y describiendo lo que te gustaría añadir o cambiar.

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

Si te animas, escribe el contenido en la descripción del issue, y los contribuidores del proyecto se encargarán del resto.

<!--
### Forking the repo, edit files locally and opening Pull Requests
-->

### Hacer un fork del repositorio, editar archivos localmente y abrir Pull Requests

<!--
If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.
-->

Si estás familiarizado con markdown, puedes hacer un [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) del repositorio `wordpress-playground` y proponer cambios y nuevas páginas de documentación enviando un Pull Request.

<!--
The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

El proceso de crear una rama para abrir nuevos PRs con páginas traducidas en el repositorio [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) es el mismo que para contribuir a otros repositorios de WordPress como gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--
The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.
-->

Los archivos de documentación (archivos `.md`) se almacenan en el repositorio de GitHub de Playground, [en `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) para inglés y en [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) para otros idiomas.

<!--
### Edit in the browser
-->

### Editar en el navegador

<!--
If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:
-->

Si has iniciado sesión en GitHub, también puedes editar archivos existentes (o añadir nuevos) y enviar un PR directamente desde la interfaz de usuario de GitHub:

<!--
1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.
-->

1. Encuentra la página que te gustaría editar o el directorio del capítulo al que te gustaría añadir una nueva página.
2. Haz clic en el botón **Añadir archivos** para añadir un nuevo archivo, o haz clic en un archivo existente y luego en el icono del lápiz para editarlo.
3. GitHub te pedirá que hagas un fork del repositorio y crees una nueva rama con tus cambios.
4. Se abrirá un editor donde podrás hacer los cambios.
5. Cuando hayas terminado, haz clic en el botón **Commit Changes** y envía un Pull Request.

<!--
That's it! You've just contributed to the WordPress Playground documentation.
-->

¡Eso es todo! Acabas de contribuir a la documentación de WordPress Playground.

<!--
This approach means you don't need to clone the repository, set up a local development environment, or run any commands.
-->

Este enfoque significa que no necesitas clonar el repositorio, configurar un entorno de desarrollo local ni ejecutar ningún comando.

<!--
The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

La desventaja es que no podrás previsualizar tus cambios. Sigue leyendo para aprender a revisar tus cambios antes de enviar un Pull Request.

<!--
### Local preview
-->

### Previsualización local

<!--
Clone the repository and navigate to the directory on your device. Now run the following commands:
-->

Clona el repositorio y navega al directorio en tu dispositivo. Ahora ejecuta los siguientes comandos:

```bash
npm install
npm run build:docs
npm run dev:docs
```

<!--
The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
-->

El sitio de documentación se abre en una nueva pestaña del navegador y se actualiza automáticamente con cada cambio. Continúa editando el archivo relevante en tu editor de código y prueba los cambios en tiempo real.
