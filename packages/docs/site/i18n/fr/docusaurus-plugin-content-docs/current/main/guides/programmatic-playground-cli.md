---
title: Utilisation programmatique du Playground CLI
slug: /guides/programmatic-playground-cli
description: Apprenez à utiliser la fonction runCLI pour contrôler WordPress Playground de manière programmatique depuis JavaScript/TypeScript pour l'automatisation et les tests.
---

<!--
# Programmatic Usage of Playground CLI
-->

# Utilisation programmatique du Playground CLI

<!--
The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. The options you pass to `runCLI` map directly to the [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments).
-->

Le Playground CLI peut également être contrôlé de manière programmatique depuis votre code JavaScript/TypeScript grâce à la fonction `runCLI`. Cela vous donne un accès direct à toutes les fonctionnalités du CLI dans votre code, ce qui est utile pour automatiser les tests de bout en bout. Les options que vous passez à `runCLI` correspondent directement aux [options du CLI](/developers/local-development/wp-playground-cli#command-and-arguments).

<!--
## Running a WordPress instance with a specific version
-->

## Lancer une instance WordPress avec une version spécifique

<!--
Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.
-->

Avec la fonction `runCLI`, vous pouvez préciser des options comme les versions de PHP et de WordPress. Dans l'exemple ci-dessous, nous demandons la version PHP 8.3, la dernière version de WordPress et une connexion automatique. Tous les arguments pris en charge sont définis dans le type `RunCLIArgs`.

```TypeScript
import { runCLI } from "@wp-playground/cli";

const cliServer = await runCLI({
  command: 'server',
  php: '8.3',
  wp: 'latest',
  login: true,
});
```

<!--
Run the code above using your preferred TypeScript runtime, e.g. `tsx`:
-->

Exécutez le code ci-dessus avec votre environnement d'éxécution Typescript préféré, par exemple `tsx` :

```sh
npx tsx my-script.ts
```

<!--
## Setting a blueprint
-->

## Définir un blueprint

<!--
You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.
-->

Vous pouvez fournir un blueprint de deux façons : soit comme un objet littéral passé directement à la propriété `blueprint`, soit comme une chaîne contenant le chemin vers un fichier `.json` externe.

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

const cliServer: RunCLIServer;

cliServer = await runCLI({
  command: 'server',
  wp: 'latest',
  blueprint: {
    steps: [
        {
          "step": "setSiteOptions",
          "options": {
              "blogname": "Blueprint Title",
              "blogdescription": "A great blog description"
          }
        }
    ],
  },
});
```

<!--
For full type-safety when defining your blueprint object, you can import and use the `BlueprintDeclaration` type from the `@wp-playground/blueprints` package:
-->

Pour une sécurité de typage complète lors de la définition de votre objet blueprint, vous pouvez importer et utiliser le type `BlueprintDeclaration` du paquet `@wp-playground/blueprints` :

```TypeScript
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

const myBlueprint: BlueprintDeclaration = {
  landingPage: "/wp-admin/",
  steps: [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    }
  ]
};
```

<!--
## Mounting a plugin programmatically
-->

## Monter une extension de manière programmatique

<!--
You can mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.
-->

Vous pouvez monter des répertoires locaux de manière programmatique avec `runCLI`. Les options `mount` et `mount-before-install` sont disponibles. La propriété `hostPath` attend un chemin vers un répertoire sur votre machine locale. Ce chemin doit être relatif à l’endroit d’où votre script est exécuté.

```TypeScript
import { runCLI } from "@wp-playground/cli";

cliServer = await runCLI({
  command: 'server',
  login: true,
  'mount-before-install': [
    {
      hostPath: './[my-plugin-local-path]',
      vfsPath: '/wordpress/wp-content/plugins/my-plugin',
    },
  ],
});
```

<!--
## Combining mounts with blueprints
-->

## Combiner les montages avec les blueprints

<!--
You can combine mounting parts of the project with blueprints, for example:
-->

Vous pouvez combiner le montage de parties du projet avec des blueprints, par exemple :

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

const cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true,
    mount: [
        {
            "hostPath": "./plugin/",
            "vfsPath": "/wordpress/wp-content/plugins/playwright-test"
        }
    ],
    blueprint: {
        steps: [
            {
                "step": "activatePlugin",
                "pluginPath": "/wordpress/wp-content/plugins/playwright-test/plugin-playwright.php"
            }
        ]
    }
});
```

<!--
## Automated testing
-->

## Tests automatisés

<!--
### Integration testing with Vitest
-->

### Tests d’intégration avec Vitest

<!--
The programmatic API is excellent for automated testing. Here's a complete example using Vitest:
-->

L’API programmatique est idéale pour les tests automatisés. Voici un exemple complet avec Vitest :

```TypeScript
import { describe, test, expect, afterEach } from 'vitest';
import { runCLI, RunCLIServer } from "@wp-playground/cli";

describe('My Plugin Tests', () => {
  const cliServer: RunCLIServer;

  afterEach(async () => {
    if (cliServer) {
      await cliServer[Symbol.asyncDispose]();
    }
  });

  test('plugin activates successfully', async () => {
    cliServer = await runCLI({
      command: 'server',
      mount: [
        {
          hostPath: './my-plugin',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin'
        }
      ],
      blueprint: {
        steps: [
          {
            step: 'activatePlugin',
            pluginPath: '/wordpress/wp-content/plugins/my-plugin/plugin.php'
          }
        ]
      }
    });

    const homeUrl = new URL('/', cliServer.serverUrl);
    const response = await fetch(homeUrl);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('My Plugin');
  });

  test('plugin settings page loads', async () => {
    cliServer = await runCLI({
      command: 'server',
      login: true, // Auto-login as admin
      mount: [
        {
          hostPath: './my-plugin',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin'
        }
      ],
      blueprint: {
        steps: [
          {
            step: 'activatePlugin',
            pluginPath: '/wordpress/wp-content/plugins/my-plugin/plugin.php'
          }
        ]
      }
    });

    const settingsUrl = new URL(
      '/wp-admin/options-general.php?page=my-plugin',
      cliServer.serverUrl
    );
    const response = await fetch(settingsUrl);

    expect(response.status).toBe(200);
  });
});
```

<!--
### Testing with different WordPress/PHP versions
-->

### Tester avec différentes versions WordPress/PHP

```TypeScript
test('plugin works with WordPress 6.4 and PHP 8.3', async () => {
  cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: '6.4',
    mount: [
      {
        hostPath: './my-plugin',
        vfsPath: '/wordpress/wp-content/plugins/my-plugin'
      }
    ],
    blueprint: {
      steps: [
        {
          step: 'activatePlugin',
          pluginPath: '/wordpress/wp-content/plugins/my-plugin/plugin.php'
        }
      ]
    }
  });

  const homeUrl = new URL('/', cliServer.serverUrl);
  const response = await fetch(homeUrl);

  expect(response.status).toBe(200);
});
```

<!--
## Advanced configuration
-->

## Configuration avancée

<!--
### Skip WordPress and SQLite setup
-->

### Ignorer la configuration WordPress et SQLite

<!--
When you only need to test PHP code without WordPress, you can skip the setup for faster testing:
-->

Lorsque vous n’avez besoin de tester que du code PHP sans WordPress, vous pouvez ignorer la configuration pour des tests plus rapides :

```TypeScript
import { runCLI } from "@wp-playground/cli";

const cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wordpressInstallMode: 'do-not-attempt-installing',
    skipSqliteSetup: true,
});

// Test PHP version
await cliServer.playground.writeFile(
  '/wordpress/version.php',
  '<?php echo phpversion(); ?>'
);

const versionUrl = new URL('/version.php', cliServer.serverUrl);
const response = await fetch(versionUrl);
const version = await response.text();
console.log('PHP Version:', version); // Outputs: 8.3.x
```

<!--
### Error handling
-->

### Gestion des erreurs

```TypeScript
import { runCLI } from "@wp-playground/cli";

try {
  const cliServer = await runCLI({
    command: 'server',
    debug: true // Enable PHP error logging
  });

  // Your test code here

} catch (error) {
  console.error('Server failed to start:', error);
}
```
