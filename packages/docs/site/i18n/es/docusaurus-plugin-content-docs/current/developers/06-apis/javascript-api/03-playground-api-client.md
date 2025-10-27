---
slug: /developers/apis/javascript-api/playground-api-client
---

<!--
# Playground API Client
-->

# Cliente API de Playground

<!--
The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).
-->

El objeto `PlaygroundClient` implementa la interfaz `UniversalPHP`. Todos los métodos de esa interfaz también están disponibles en Node.js e instancias PHP del mismo proceso (Playground ejecuta PHP en un web worker).

<!--
Broadly speaking, you can use the client to perform three types of operations:

-   Running PHP code
-   Customizing `PHP.ini`
-   Managing files and directories
-->

En términos generales, puedes usar el cliente para realizar tres tipos de operaciones:

-   Ejecutar código PHP
-   Personalizar `PHP.ini`
-   Gestionar archivos y directorios

<!--
## Running PHP code
-->

## Ejecutar código PHP

<!--
The two methods you can use to run PHP code are:

-   [`run()`](#the-run-method) - runs PHP code and returns the output
-   [`request()`](#the-request-method) - makes an HTTP request to the website
-->

Los dos métodos que puedes usar para ejecutar código PHP son:

-   [`run()`](#the-run-method) - ejecuta código PHP y devuelve la salida
-   [`request()`](#the-request-method) - realiza una solicitud HTTP al sitio web

<!--
In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.
-->

En Node.js, también puedes usar el método [`cli()`](#the-cli-method) para ejecutar PHP en modo CLI.

<!--
### The `run()` method
-->

### El método `run()`

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

<!--
### The `request()` method
-->

### El método `request()`

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

<!--
## Customizing `PHP.ini`
-->

## Personalizar `PHP.ini`

<!--
The API client also allows you to change the `php.ini` file:
-->

El cliente API también te permite cambiar el archivo `php.ini`:

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

<!--
## Managing files and directories
-->

## Gestionar archivos y directorios

<!--
The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem:
-->

El objeto `client` te proporciona una API de bajo nivel para gestionar archivos y directorios en el sistema de archivos PHP:

```ts
await client.mkdirTree('/wordpress/test');
// Create a new PHP file
await client.writeFile(
	'/wordpress/test/index.php',
	`<?php
     echo "Hello, world!<br/>";
     // List all the files in current directory
     print_r(glob(__DIR__ . '/*'));
  `
);
// Create files named 1, 2, and 3
await client.writeFile('/wordpress/test/1', '');
await client.writeFile('/wordpress/test/2', '');
await client.writeFile('/wordpress/test/3', '');
// Remove the file named 1
await client.unlink('/wordpress/test/1');
// Navigate to our PHP file
await client.goTo('/test/index.php');
```

<!--
For a complete list of these methods, refer to the `PlaygroundClient` interface.
-->

Para obtener una lista completa de estos métodos, consulta la interfaz `PlaygroundClient`.

<!--
## Sending messages to JavaScript
-->

## Enviar mensajes a JavaScript

<!--
You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:

-   `$data` (string) – Data to pass to JavaScript.
-->

Puedes pasar mensajes de PHP a JavaScript usando la función `post_message_to_js()`. Acepta un argumento:

-   `$data` (string) – Datos para pasar a JavaScript.

<!--
For example, here's how you would send a message with a JSON-encoded post ID and title:
-->

Por ejemplo, así es como enviarías un mensaje con un ID de publicación y un título codificado en JSON:

```TypeScript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

php.onMessage(
	// The data is always passed as a string
	function (data: string) {
		// Let's decode and log the data:
		console.log(JSON.parse(data));
	}
);

// Now that we have a listener in place, let's
// dispatch a message:
const output = await php.runStream({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        );
    `,
});

console.log(await output.stdoutText);
// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

<!--
## The `cli()` method
-->

## El método `cli()`

<!--
In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:
-->

En Node.js, también tienes acceso al método `cli()` que ejecuta PHP en modo CLI:

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

<!--
Once `cli()` method finishes running, the PHP instance is no longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls `exit()`.
-->

Una vez que el método `cli()` termina de ejecutarse, la instancia de PHP ya no es utilizable y debe descartarse. Esto se debe a que PHP internamente limpia todos los recursos y llama a `exit()`.
