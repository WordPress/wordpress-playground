---
title: Uso programático do Playground CLI
slug: /guides/programmatic-playground-cli
description: Aprenda a usar a função runCLI para controlar o WordPress Playground de forma programática a partir de JavaScript/TypeScript para automação e testes.
---

<!--
# Programmatic Usage of Playground CLI
-->

# Uso programático do Playground CLI

<!--
The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. The options you pass to `runCLI` map directly to the [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments).
-->

O Playground CLI também pode ser controlado de forma programática no seu código JavaScript/TypeScript usando a função `runCLI`. Isso dá acesso direto a todas as funcionalidades do CLI no seu código, o que é útil para automatizar testes de ponta a ponta. As opções que você passa para `runCLI` correspondem diretamente às [opções do CLI](/developers/local-development/wp-playground-cli#command-and-arguments).

<!--
## Running a WordPress instance with a specific version
-->

## Executando uma instância WordPress com uma versão específica

<!--
Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.
-->

Usando a função `runCLI`, você pode especificar opções como as versões do PHP e do WordPress. No exemplo abaixo, solicitamos PHP 8.3, a versão mais recente do WordPress e login automático. Todos os argumentos suportados estão definidos no tipo `RunCLIArgs`.

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

Execute o código acima usando seu runtime TypeScript preferido, por exemplo `tsx`:

```sh
npx tsx my-script.ts
```

<!--
## Setting a blueprint
-->

## Definindo um blueprint

<!--
You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.
-->

Você pode fornecer um blueprint de duas formas: como um objeto literal passado diretamente à propriedade `blueprint`, ou como uma string com o caminho para um arquivo `.json` externo.

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

Para segurança total de tipos ao definir seu objeto de blueprint, você pode importar e usar o tipo `BlueprintDeclaration` do pacote `@wp-playground/blueprints`:

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

## Montando um plugin de forma programática

<!--
You can mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.
-->

Você pode montar diretórios locais de forma programática usando `runCLI`. As opções `mount` e `mount-before-install` estão disponíveis. A propriedade `hostPath` espera um caminho para um diretório na sua máquina local. Esse caminho deve ser relativo ao local de onde seu script está sendo executado.

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

## Combinando montagens com blueprints

<!--
You can combine mounting parts of the project with blueprints, for example:
-->

Você pode combinar a montagem de partes do projeto com blueprints, por exemplo:

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

## Testes automatizados

<!--
### Integration testing with Vitest
-->

### Testes de integração com Vitest

<!--
The programmatic API is excellent for automated testing. Here's a complete example using Vitest:
-->

A API programática é excelente para testes automatizados. Aqui está um exemplo completo usando Vitest:

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

### Testando com diferentes versões de WordPress/PHP

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

## Configuração avançada

<!--
### Skip WordPress and SQLite setup
-->

### Pular a configuração do WordPress e do SQLite

<!--
When you only need to test PHP code without WordPress, you can skip the setup for faster testing:
-->

Quando você só precisa testar código PHP sem WordPress, pode pular a configuração para testes mais rápidos:

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

### Tratamento de erros

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
