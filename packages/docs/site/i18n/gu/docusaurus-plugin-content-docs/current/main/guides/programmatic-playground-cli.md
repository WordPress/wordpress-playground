---
title: Playground CLI નો પ્રોગ્રામેટિક ઉપયોગ
slug: /guides/programmatic-playground-cli
description: ઓટોમેશન અને ટેસ્ટિંગ માટે JavaScript/TypeScript દ્વારા runCLI ફંક્શનનો ઉપયોગ કરીને WordPress Playground ને પ્રોગ્રામેટિક રીતે કેવી રીતે નિયંત્રિત કરવું તે શીખો.
---

<!--
# Programmatic Usage of Playground CLI
-->

# પ્લેગ્રાઉન્ડ CLI નો પ્રોગ્રામેટિક ઉપયોગ

<!--
The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. The options you pass to `runCLI` map directly to the [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments).
-->

`runCLI` ફંક્શનનો ઉપયોગ કરીને તમારા JavaScript/TypeScript કોડમાંથી પ્લેગ્રાઉન્ડ CLI ને પ્રોગ્રામેટિક રીતે પણ નિયંત્રિત કરી શકાય છે. આથી તમારા કોડની અંદર CLI ની તમામ સુવિધાઓનો સીધો ઉપયોગ કરી શકાય છે, જે ખાસ કરીને end-to-end ટેસ્ટને ઓટોમેટ કરવા માટે ઉપયોગી છે. તમે `runCLI` ને આપો છો તે વિકલ્પો સીધા જ [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments) સાથે મેળ ખાય છે.

<!--
<iframe width="800" src="https://www.youtube.com/embed/rmNf3CfXbtA?si=cduqQYbBWc6zAPVj" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="Running WordPress Directly from the JavaScript Code with runCLI"></iframe>
-->

<iframe width="800" src="https://www.youtube.com/embed/rmNf3CfXbtA?si=cduqQYbBWc6zAPVj" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="runCLI સાથે JavaScript કોડમાંથી સીધું WordPress ચલાવવું"></iframe>

<!--
## Running a WordPress instance with a specific version
-->

## ચોક્કસ વર્ઝન સાથે WordPress ઇન્સ્ટન્સ ચલાવવું

<!--
Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.
-->

`runCLI` ફંક્શનનો ઉપયોગ કરીને તમે PHP અને WordPress વર્ઝન જેવા વિકલ્પો નિર્દિષ્ટ કરી શકો છો. નીચેના ઉદાહરણમાં, આપણે PHP 8.3, WordPress નું નવીનતમ વર્ઝન અને આપમેળે લૉગિન થવાની સુવિધા પસંદ કરીએ છીએ. સપોર્ટેડ તમામ આર્ગ્યુમેન્ટ્સ `RunCLIArgs` ટાઇપમાં વ્યાખ્યાયિત છે.

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

ઉપરનો કોડ તમારા પસંદગીના TypeScript runtime દ્વારા ચલાવો, ઉદાહરણ તરીકે `tsx`:

```sh
npx tsx my-script.ts
```

<!--
## Setting a blueprint
-->

## Blueprint સેટ કરવું

<!--
You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.
-->

તમે Blueprint બે રીતે આપી શકો છો: `blueprint` પ્રોપર્ટીમાં સીધો object literal આપીને અથવા બહારની `.json` ફાઇલનો પાથ ધરાવતી string આપીને.

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

તમારા Blueprint object ને સંપૂર્ણ type-safety સાથે વ્યાખ્યાયિત કરવા માટે, `@wp-playground/blueprints` પેકેજમાંથી `BlueprintDeclaration` ટાઇપ import કરીને તેનો ઉપયોગ કરી શકો છો:

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

## પ્રોગ્રામેટિક રીતે પ્લગઇન માઉન્ટ કરવું

<!--
You can mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.
-->

`runCLI` નો ઉપયોગ કરીને તમે લોકલ ડિરેક્ટરીઓ પ્રોગ્રામેટિક રીતે માઉન્ટ કરી શકો છો. તેના માટે `mount` અને `mount-before-install` વિકલ્પો ઉપલબ્ધ છે. `hostPath` પ્રોપર્ટીમાં તમારા લોકલ કમ્પ્યુટરની ડિરેક્ટરીનો પાથ આપવો પડે છે. આ પાથ તમારી સ્ક્રિપ્ટ જ્યાંથી ચલાવવામાં આવે છે તે સ્થાનના સાપેક્ષ (relative) હોવો જોઈએ.

```TypeScript
import { runCLI } from "@wp-playground/cli";

const cliServer = await runCLI({
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

## Mounts ને Blueprints સાથે જોડવા

<!--
You can combine mounting parts of the project with blueprints, for example:
-->

તમે પ્રોજેક્ટના ભાગોને માઉન્ટ કરવાની પ્રક્રિયાને Blueprints સાથે જોડી શકો છો. ઉદાહરણ તરીકે:

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

const cliServer: RunCLIServer = await runCLI({
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

## ઓટોમેટેડ ટેસ્ટિંગ

<!--
### Integration testing with Vitest
-->

### Vitest સાથે Integration Testing

<!--
The programmatic API is excellent for automated testing. Here's a complete example using Vitest:
-->

પ્રોગ્રામેટિક API ઓટોમેટેડ ટેસ્ટિંગ માટે ખૂબ જ ઉપયોગી છે. અહીં Vitest નો ઉપયોગ કરતું સંપૂર્ણ ઉદાહરણ છે:

```TypeScript
import { describe, test, expect, afterEach } from 'vitest';
import { runCLI, RunCLIServer } from "@wp-playground/cli";

describe('My Plugin Tests', () => {
  let cliServer: RunCLIServer | undefined;

  afterEach(async () => {
    if (cliServer) {
      // RunCLIServer exposes Symbol.asyncDispose as its public async cleanup API.
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

    // Note: A plain `fetch` call does not send the admin session cookie set by `login: true`,
    // so this request is typically redirected to the login page instead of returning 200.
    expect(response.status).toBe(302);
  });
});
```

<!--
### Testing with different WordPress/PHP versions
-->

### અલગ WordPress/PHP વર્ઝન સાથે ટેસ્ટિંગ

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

## અદ્યતન કન્ફિગરેશન

<!--
### Skip WordPress and SQLite setup
-->

### WordPress અને SQLite સેટઅપ છોડવું

<!--
When you only need to test PHP code without WordPress, you can skip the setup for faster testing:
-->

જો તમારે WordPress વિના માત્ર PHP કોડનું પરીક્ષણ કરવું હોય, તો ઝડપી ટેસ્ટિંગ માટે સેટઅપ પ્રક્રિયા છોડી શકો છો:

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

### ભૂલોનું સંચાલન (Error Handling)

```TypeScript
import { runCLI } from "@wp-playground/cli";

try {
  const cliServer = await runCLI({
    command: 'server',
    debug: true, // Enable PHP error logging.
  });

  // Your test code here

} catch (error) {
  console.error('Server failed to start:', error);
}
```
