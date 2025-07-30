---
slug: /contributing/coding-standards
---

<!--
# Coding principles
-->

# Principios de codificación

<!--
## Error messages
-->

## Mensajes de error

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.
-->

Un buen mensaje de error informa al usuario de los siguientes pasos a seguir. Cualquier ambigüedad en los errores lanzados por las APIs públicas de Playground incitará a los desarrolladores a abrir issues.

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

Considera un error de red, por ejemplo, ¿podemos inferir el tipo de error y mostrar un mensaje relevante que resuma los siguientes pasos?

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

-   **Error de red**: "Tu conexión a internet ha fallado. Intenta recargar la página".
-   **404**: "No se ha podido encontrar el archivo".
-   **403**: "El servidor ha bloqueado el acceso al archivo".
-   **CORS**: aclara que es una característica de seguridad del navegador y añade un enlace a una explicación detallada (en MDN u otra fuente fiable). Sugiere al usuario que mueva su archivo a otro lugar, como `raw.githubusercontent.com`, y enlaza a un recurso que explique cómo configurar las cabeceras CORS en sus servidores.

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

Nos encargamos del formato del código y del linting automáticamente. Relájate, escribe y deja que las máquinas hagan el trabajo.

<!--
## Public API
-->

## API Pública

<!--
Playground aims to keep the narrowest possible API scope.
-->

Playground tiene como objetivo mantener el ámbito de la API lo más reducido posible.

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

Las APIs públicas son fáciles de añadir y difíciles de eliminar. Solo se necesita un PR para introducir una nueva API, pero puede que se necesiten mil para eliminarla, especialmente si otros proyectos ya la han consumido.

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

-   No expongas funciones, clases, constantes u otros componentes innecesarios.

<!--
## Blueprints
-->

## Blueprints

<!--
Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

Los Blueprints son la forma principal de interactuar con Playground. Estos archivos JSON describen un conjunto de pasos que Playground ejecuta en orden.

<!--
### Guidelines
-->

### Directrices

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

Los pasos de los Blueprints deben ser **concisos y centrados**. Deben hacer una cosa y hacerla bien.

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

-   Si necesitas crear un nuevo paso, intenta refactorizar uno existente primero.
-   Si eso no es suficiente, asegúrate de que el nuevo paso ofrezca una nueva capacidad. No repliques la funcionalidad de los pasos existentes.
-   Asume que el paso se llamará más de una vez.
-   Asume que se ejecutará en un orden específico.
-   Añade pruebas unitarias para verificarlo.

<!--
Blueprints should be **intuitive and straightforward**.
-->

Los Blueprints deben ser **intuitivos y directos**.

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->

-   No requieras argumentos que puedan ser opcionales.
-   Usa argumentos sencillos. Por ejemplo, `slug` en lugar de `path`.
-   Define constantes en archivos JSON virtuales, no modifiques archivos PHP.
-   Define un tipo de TypeScript para el Blueprint. Así es como Playground genera su esquema JSON.
-   Escribe una función para manejar un paso de Blueprint. Acepta el argumento del tipo que definiste.
-   Proporciona un ejemplo de uso en la cadena de documentación. Se refleja automáticamente en la documentación.
