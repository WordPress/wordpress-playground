---
title: wp-now
slug: /developers/local-development/wp-now
orphan: true
---

<div class="callout callout-warning">

<!-- **Package deprecated** -->

**पैकेज अप्रचलित है**

<!-- The NPM package @wp-now/wp-now is deprecated and won't receive updates in the future. To use a command-line tool in your developer workflow, use the NPM package `@wp-playground/cli`. -->

NPM पैकेज @wp-now/wp-now अप्रचलित है और आगे इसे कोई अपडेट नहीं मिलेगा। अपने डेवलपर वर्कफ़्लो में कमांड-लाइन टूल के लिए NPM पैकेज `@wp-playground/cli` का उपयोग करें।

</div>

<!-- # wp-now NPM package -->

# wp-now NPM पैकेज

<!-- [`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is deprecated.
Use [Playground CLI](/developers/local-development/wp-playground-cli) instead.
It uses the same WordPress Playground runtime and is maintained in the main
WordPress Playground repository. -->

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) अप्रचलित है। इसकी जगह [Playground CLI](/developers/local-development/wp-playground-cli) का उपयोग करें। यह वही WordPress Playground रनटाइम उपयोग करता है और मुख्य WordPress Playground रिपॉज़िटरी में मेंटेन होता है।

<!-- ## Migrate to Playground CLI -->

## Playground CLI पर माइग्रेट करें {#migrate-to-playground-cli}

<!-- The familiar wp-now workflow maps to the Playground CLI `start` command: -->

wp-now का जाना-पहचाना वर्कफ़्लो Playground CLI की `start` कमांड से मेल खाता है:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.3`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.3`           |
| `npx @wp-now/wp-now start --blueprint=./blueprint.json` | `npx @wp-playground/cli@latest start --blueprint=./blueprint.json` |
| `npx @wp-now/wp-now start --skip-browser`               | `npx @wp-playground/cli@latest start --skip-browser`               |
| `npx @wp-now/wp-now start --reset`                      | `npx @wp-playground/cli@latest start --reset`                      |

<!-- `@wp-playground/cli start` automatically detects whether the selected directory
is a plugin, theme, `wp-content` directory, or WordPress installation. When it
manages the WordPress root directory, it persists the site in
`~/.wordpress-playground/sites/<path-hash>/`. If the selected directory is a full
WordPress installation, that directory becomes the persistent store instead. -->

`@wp-playground/cli start` चलाने पर Playground CLI अपने-आप पहचान लेता है कि चुनी गई डायरेक्टरी प्लगइन है, थीम है, `wp-content` डायरेक्टरी है या WordPress इंस्टॉलेशन। जब यह WordPress की रूट डायरेक्टरी खुद संभालता है, तो साइट को `~/.wordpress-playground/sites/<path-hash>/` में सहेजकर रखता है। अगर चुनी गई डायरेक्टरी पूरा WordPress इंस्टॉलेशन है, तो साइट उसी डायरेक्टरी में सहेजी जाती है।

<!-- For manual mounts, automation, or CI workflows, use the lower-level
`@wp-playground/cli server` command. See the
[Playground CLI documentation](/developers/local-development/wp-playground-cli)
for details. -->

मैन्युअल माउंट, ऑटोमेशन या CI वर्कफ़्लो के लिए निचले स्तर की `@wp-playground/cli server` कमांड का उपयोग करें। ज़्यादा जानकारी के लिए [Playground CLI का दस्तावेज़ीकरण](/developers/local-development/wp-playground-cli) देखें।
