---
title: Playground CLI का प्रोग्रामैटिक उपयोग
slug: /guides/programmatic-playground-cli
description: ऑटोमेशन और परीक्षण के लिए JavaScript/TypeScript से WordPress Playground को प्रोग्राम के ज़रिए नियंत्रित करने हेतु runCLI फ़ंक्शन का उपयोग करना सीखें।
---

<!-- # Programmatic Usage of Playground CLI -->

# Playground CLI का प्रोग्रामैटिक उपयोग

<!-- The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. The options you pass to `runCLI` map directly to the [CLI flags](/developers/local-development/wp-playground-cli#command-and-arguments). -->

Playground CLI को `runCLI` फ़ंक्शन की मदद से आपके JavaScript/TypeScript कोड से प्रोग्राम के ज़रिए भी नियंत्रित किया जा सकता है। इससे आपको अपने कोड के अंदर ही CLI की सभी सुविधाओं तक सीधी पहुँच मिलती है, जो एंड-टू-एंड परीक्षणों को ऑटोमेट करने में काम आती है। आप `runCLI` को जो विकल्प देते हैं, वे सीधे [CLI फ़्लैग](/developers/local-development/wp-playground-cli#command-and-arguments) से मेल खाते हैं।

<iframe width="800" src="https://www.youtube.com/embed/rmNf3CfXbtA?si=cduqQYbBWc6zAPVj" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="runCLI से JavaScript कोड में सीधे WordPress चलाना"></iframe>

<!-- ## Running a WordPress instance with a specific version -->

## किसी ख़ास संस्करण के साथ WordPress इंस्टेंस चलाना {#running-a-wordpress-instance-with-a-specific-version}

<!-- Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type. -->

आप `runCLI` फ़ंक्शन में PHP और WordPress संस्करण जैसे विकल्प तय कर सकते हैं। नीचे दिए गए उदाहरण में हम PHP 8.3, WordPress का नवीनतम संस्करण और अपने-आप लॉग इन होना माँगते हैं। सभी समर्थित आर्गुमेंट `RunCLIArgs` टाइप में परिभाषित हैं।

```TypeScript
import { runCLI } from "@wp-playground/cli";

const cliServer = await runCLI({
  command: 'server',
  php: '8.3',
  wp: 'latest',
  login: true,
});
```

<!-- Run the code above using your preferred TypeScript runtime, e.g. `tsx`: -->

ऊपर दिया गया कोड अपने पसंदीदा TypeScript रनटाइम से चलाएँ, जैसे `tsx`:

```sh
npx tsx my-script.ts
```

<!-- ## Setting a blueprint -->

## ब्लूप्रिंट सेट करना {#setting-a-blueprint}

<!-- You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file. The string form works at runtime, but the exported `RunCLIArgs` type does not include it, so TypeScript reports a type error for it. -->

आप ब्लूप्रिंट दो तरीकों से दे सकते हैं: या तो सीधे `blueprint` प्रॉपर्टी को दिए गए ऑब्जेक्ट लिटरल के रूप में, या किसी बाहरी `.json` फ़ाइल के पाथ वाली स्ट्रिंग के रूप में। स्ट्रिंग वाला रूप रनटाइम पर काम करता है, लेकिन एक्सपोर्ट किया गया `RunCLIArgs` टाइप इसे शामिल नहीं करता, इसलिए TypeScript इस पर टाइप एरर दिखाता है।

```TypeScript
import { runCLI } from "@wp-playground/cli";
import type { RunCLIServer } from "@wp-playground/cli";

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

<!-- For full type-safety when defining your blueprint object, you can import and use the `BlueprintDeclaration` type from the `@wp-playground/blueprints` package: -->

अपना ब्लूप्रिंट ऑब्जेक्ट परिभाषित करते समय पूरी टाइप-सेफ़्टी के लिए, आप `@wp-playground/blueprints` पैकेज से `BlueprintDeclaration` टाइप इम्पोर्ट करके उसका उपयोग कर सकते हैं:

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

<!-- ## Mounting a plugin programmatically -->

## प्रोग्राम के ज़रिए प्लगइन माउंट करना {#mounting-a-plugin-programmatically}

<!-- You can mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. A relative path is resolved from the current working directory, the directory you run the script from. -->

आप `runCLI` से लोकल डायरेक्टरी प्रोग्राम के ज़रिए माउंट कर सकते हैं। इसके लिए `mount` और `mount-before-install` विकल्प उपलब्ध हैं। प्रॉपर्टी `hostPath` में आपकी लोकल मशीन की किसी डायरेक्टरी का पाथ चाहिए। रिलेटिव पाथ को मौजूदा वर्किंग डायरेक्टरी से गिना जाता है, यानी उस डायरेक्टरी से जहाँ से आप स्क्रिप्ट चलाते हैं।

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

<!-- ## Combining mounts with blueprints -->

## माउंट और ब्लूप्रिंट को साथ में उपयोग करना {#combining-mounts-with-blueprints}

<!-- You can combine mounting parts of the project with blueprints, for example: -->

आप प्रोजेक्ट के कुछ हिस्सों को माउंट करना और ब्लूप्रिंट, दोनों साथ में उपयोग कर सकते हैं, उदाहरण के लिए:

```TypeScript
import { runCLI } from "@wp-playground/cli";
import type { RunCLIServer } from "@wp-playground/cli";

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

<!-- ## Automated testing -->

## ऑटोमेटेड परीक्षण {#automated-testing}

<!-- ### Integration testing with Vitest -->

### Vitest के साथ इंटीग्रेशन परीक्षण {#integration-testing-with-vitest}

<!-- The programmatic API is excellent for automated testing. Here's a complete example using Vitest: -->

प्रोग्रामैटिक API ऑटोमेटेड परीक्षण के लिए बहुत बढ़िया है। Vitest का उपयोग करने वाला एक पूरा उदाहरण यह रहा:

```TypeScript
import { describe, test, expect, afterEach } from 'vitest';
import { runCLI } from "@wp-playground/cli";
import type { RunCLIServer } from "@wp-playground/cli";

describe('My Plugin Tests', () => {
  let cliServer: RunCLIServer | undefined;

  afterEach(async () => {
    if (cliServer) {
      // RunCLIServer exposes Symbol.asyncDispose as its public async cleanup API.
      await cliServer[Symbol.asyncDispose]();
      cliServer = undefined;
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
  }, 30_000);

  test('plugin settings page loads', async () => {
    cliServer = await runCLI({
      command: 'server',
      login: true, // Auto-login as admin
      internalCookieStore: true, // Preserve login cookies across Node.js fetch requests.
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
    expect(response.url).toBe(settingsUrl.href);
    const html = await response.text();
    expect(html).toContain('My Plugin');
  }, 30_000);
});
```

<!-- ### Testing with different WordPress/PHP versions -->

### अलग-अलग WordPress/PHP संस्करणों के साथ परीक्षण {#testing-with-different-wordpressphp-versions}

```TypeScript
import { test, expect } from 'vitest';
import { runCLI } from "@wp-playground/cli";

test('plugin works with WordPress 6.4 and PHP 8.3', async () => {
  const cliServer = await runCLI({
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

  try {
    const homeUrl = new URL('/', cliServer.serverUrl);
    const response = await fetch(homeUrl);

    expect(response.status).toBe(200);
  } finally {
    await cliServer[Symbol.asyncDispose]();
  }
}, 30_000);
```

<!-- ## Advanced configuration -->

## एडवांस्ड कॉन्फ़िगरेशन {#advanced-configuration}

<!-- ### Skip WordPress and SQLite setup -->

### WordPress और SQLite सेटअप छोड़ना {#skip-wordpress-and-sqlite-setup}

<!-- When you only need to test PHP code without WordPress, you can skip the setup for faster testing: -->

जब आपको WordPress के बिना सिर्फ़ PHP कोड का परीक्षण करना हो, तो तेज़ परीक्षण के लिए आप सेटअप छोड़ सकते हैं:

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

<!-- ### Error handling -->

### एरर हैंडलिंग {#error-handling}

```TypeScript
import { runCLI } from "@wp-playground/cli";

try {
  const cliServer = await runCLI({
    command: 'server',
    verbosity: 'debug', // If boot fails, the thrown error includes the PHP error log.
  });

  // Your test code here

} catch (error) {
  console.error('Server failed to start:', error);
}
```
