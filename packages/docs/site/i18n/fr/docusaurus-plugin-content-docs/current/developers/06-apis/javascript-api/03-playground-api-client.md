---
slug: /developers/apis/javascript-api/playground-api-client
---

<!--
# Playground API Client
-->

# Client API Playground

<!--
The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).
-->

L'objet `PlaygroundClient` implémente l'interface `UniversalPHP`. Toutes les méthodes de cette interface sont également disponibles dans Node.js et les instances PHP du même processus (Playground exécute PHP dans un web worker).

<!--
Broadly speaking, you can use the client to perform three types of operations:

-   Running PHP code
-   Customizing `PHP.ini`
-   Managing files and directories
-->

De manière générale, vous pouvez utiliser le client pour effectuer trois types d'opérations :

-   Exécuter du code PHP
-   Personnaliser `PHP.ini`
-   Gérer les fichiers et dossiers

<!--
## Running PHP code
-->

## Exécuter du code PHP

<!--
The two methods you can use to run PHP code are:

-   [`run()`](#the-run-method) - runs PHP code and returns the output
-   [`request()`](#the-request-method) - makes an HTTP request to the website
-->

Les deux méthodes que vous pouvez utiliser pour exécuter du code PHP sont :

-   [`run()`](#the-run-method) - exécute du code PHP et renvoie la résultat
-   [`request()`](#the-request-method) - effectue une requête HTTP au site web

<!--
In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.
-->

Dans Node.js, vous pouvez également utiliser la méthode [`cli()`](#the-cli-method) pour exécuter PHP en mode CLI.

<!--
### The `run()` method
-->

### La méthode `run()`

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

<!--
### The `request()` method
-->

### La méthode `request()`

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

<!--
## Customizing `PHP.ini`
-->

## Personnaliser `PHP.ini`

<!--
The API client also allows you to change the `php.ini` file:
-->

Le client API vous permet également de modifier le fichier `php.ini` :

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

<!--
## Managing files and directories
-->

## Gérer les fichiers et dossiers

<!--
The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem:
-->

L'objet `client` vous fournit une API de bas niveau pour gérer les fichiers et dossiers dans le système de fichiers PHP :

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

Pour une liste complète de ces méthodes, consultez l'interface `PlaygroundClient`.

<!--
## Sending messages to JavaScript
-->

## Envoyer des messages à JavaScript

<!--
You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:

-   `$data` (string) – Data to pass to JavaScript.
-->

Vous pouvez transmettre des messages de PHP à JavaScript en utilisant la fonction `post_message_to_js()`. Elle accepte un argument :

-   `$data` (string) – Données à transmettre à JavaScript.

<!--
For example, here's how you would send a message with a JSON-encoded post ID and title:
-->

Par exemple, voici comment envoyer un message avec un ID de publication et un titre encodés en JSON :

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
await php.runStream({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        );
    `,
});

// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

<!--
## The `cli()` method
-->

## La méthode `cli()`

<!--
In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:
-->

Dans Node.js, vous avez également accès à la méthode `cli()` qui exécute PHP en mode CLI :

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

<!--
Once `cli()` method finishes running, the PHP instance is no longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls `exit()`.
-->

Une fois que la méthode `cli()` a terminé son exécution, l'instance PHP n'est plus utilisable et doit être supprimée. Cela est dû au fait que PHP nettoie en interne toutes les ressources et appelle `exit()`.
