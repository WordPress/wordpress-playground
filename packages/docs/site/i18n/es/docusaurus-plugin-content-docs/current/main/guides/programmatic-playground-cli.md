---
title: Uso programático del Playground CLI
slug: /guides/programmatic-playground-cli
description: Aprende a usar la función runCLI para controlar WordPress Playground de forma programática desde JavaScript/TypeScript para automatización y pruebas.
---

<!--
# Programmatic Usage of Playground CLI
-->

# Uso programático del Playground CLI

<!--
The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. The options you pass to `runCLI` map directly to the [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments).
-->

El Playground CLI también puede controlarse de forma programática desde tu código JavaScript/TypeScript usando la función `runCLI`. Esto te da acceso directo a todas las funcionalidades del CLI en tu código, lo cual es útil para automatizar pruebas de extremo a extremo. Las opciones que pasas a `runCLI` se corresponden directamente con las [opciones del CLI](/developers/local-development/wp-playground-cli#command-and-arguments).

<!--
## Running a WordPress instance with a specific version
-->

## Ejecutar una instancia de WordPress con una versión específica

<!--
Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.
-->

Con la función `runCLI` puedes especificar opciones como las versiones de PHP y WordPress. En el ejemplo siguiente solicitamos PHP 8.3, la última versión de WordPress y el inicio de sesión automático. Todos los argumentos soportados están definidos en el tipo `RunCLIArgs`.

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

Ejecuta el código anterior con tu runtime de TypeScript preferido, por ejemplo `tsx`:

```sh
npx tsx my-script.ts
```

<!--
## Setting a blueprint
-->

## Definir un blueprint

<!--
You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.
-->

Puedes proporcionar un blueprint de dos formas: como un objeto literal pasado directamente a la propiedad `blueprint`, o como una cadena con la ruta a un archivo `.json` externo.

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

const cliServer: RunCLIServer = await runCLI({
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

Para tener seguridad de tipos completa al definir tu objeto blueprint, puedes importar y usar el tipo `BlueprintDeclaration` del paquete `@wp-playground/blueprints`:

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

## Montar un plugin de forma programática

<!--
You can mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.
-->

Puedes montar directorios locales de forma programática con `runCLI`. Las opciones `mount` y `mount-before-install` están disponibles. La propiedad `hostPath` espera una ruta a un directorio en tu máquina local. Esta ruta debe ser relativa al lugar desde el que se ejecuta tu script.

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

## Combinar montajes con blueprints

<!--
You can combine mounting parts of the project with blueprints, for example:
-->

Puedes combinar el montaje de partes del proyecto con blueprints, por ejemplo:

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

## Pruebas automatizadas

<!--
### Integration testing with Vitest
-->

### Pruebas de integración con Vitest

<!--
The programmatic API is excellent for automated testing. Here's a complete example using Vitest:
-->

La API programática es excelente para pruebas automatizadas. Aquí tienes un ejemplo completo con Vitest:

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

### Probar con distintas versiones de WordPress/PHP

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

## Configuración avanzada

<!--
### Skip WordPress and SQLite setup
-->

### Omitir la configuración de WordPress y SQLite

<!--
When you only need to test PHP code without WordPress, you can skip the setup for faster testing:
-->

Cuando solo necesitas probar código PHP sin WordPress, puedes omitir la configuración para pruebas más rápidas:

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

### Manejo de errores

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
