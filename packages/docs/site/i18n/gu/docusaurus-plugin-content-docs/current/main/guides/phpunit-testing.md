---
title: Playground CLI સાથે PHPUnit ચલાવવું
slug: /guides/phpunit-testing
description: Playground CLI નો ઉપયોગ કરીને વર્ડપ્રેસ પ્લગઇન્સ અને થીમ્સ માટે PHPUnit પરીક્ષણો ચલાવો — ડેટાબેઝની જરૂર નથી, દરેક રન પર સ્વચ્છ વાતાવરણ.
sidebar_class_name: navbar-build-item
---

<!--
The [Playground CLI](/developers/local-development/wp-playground-cli) includes a `php` subcommand that runs PHP scripts directly inside the Playground environment. By mounting your plugin or theme into the Playground filesystem, you can run PHPUnit without a local database. Every run starts with a clean WordPress installation, so tests are fully isolated.
-->

[Playground CLI](/developers/local-development/wp-playground-cli) માં `php` સબકમાન્ડ (subcommand) શામેલ છે, જે PHP સ્ક્રિપ્ટ્સને સીધા પ્લેગ્રાઉન્ડ વાતાવરણમાં ચલાવે છે. તમારા પ્લગઇન અથવા થીમને પ્લેગ્રાઉન્ડ ફાઇલસિસ્ટમ (filesystem) માં માઉન્ટ (mount) કરીને, તમે સ્થાનિક ડેટાબેઝ વિના PHPUnit ચલાવી શકો છો. દરેક રન સ્વચ્છ વર્ડપ્રેસ ઇન્સ્ટોલેશનથી શરૂ થાય છે, તેથી પરીક્ષણો સંપૂર્ણપણે અલગ (isolated) રહે છે.

<div class="callout callout-info">

<!--
This guide assumes your plugin or theme has PHPUnit installed via Composer (`composer require --dev phpunit/phpunit`). The `vendor/bin/phpunit` path used below assumes a standard Composer setup.
-->

આ માર્ગદર્શિકા ધારે છે કે તમારા પ્લગઇન અથવા થીમમાં Composer દ્વારા PHPUnit ઇન્સ્ટોલ કરેલું છે (`composer require --dev phpunit/phpunit`). નીચે વપરાયેલ `vendor/bin/phpunit` પાથ સામાન્ય (standard) Composer સેટઅપ ધારે છે.

</div>

<!--
## Running tests
-->

## પરીક્ષણો ચલાવવા

<!--
From your plugin or theme directory, run the following command. Replace `themes/THEME_NAME` with the path to your plugin or theme:
-->

તમારા પ્લગઇન અથવા થીમની ડિરેક્ટરીમાંથી નીચેનો કમાન્ડ ચલાવો. `themes/THEME_NAME` ને તમારા પ્લગઇન અથવા થીમના પાથથી બદલો:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/themes/THEME_NAME/vendor/bin/phpunit \
  -c /wordpress/wp-content/themes/THEME_NAME/phpunit.xml.dist
```

<!--
The `--auto-mount` flag detects whether the current directory is a plugin, theme, or WordPress installation and mounts it at the correct path under `/wordpress/wp-content/`. The `--` separates CLI flags from arguments passed to the PHP interpreter, and you can pass any arguments supported by your PHPUnit configuration.
-->

`--auto-mount` ફ્લેગ (flag) શોધી કાઢે છે કે વર્તમાન ડિરેક્ટરી પ્લગઇન છે, થીમ છે કે વર્ડપ્રેસ ઇન્સ્ટોલેશન છે, અને તેને `/wordpress/wp-content/` હેઠળ યોગ્ય પાથ પર માઉન્ટ કરે છે. `--` CLI ફ્લેગ્સને PHP ઇન્ટરપ્રેટર (interpreter) ને મોકલાતા આર્ગ્યુમેન્ટ્સ (arguments) થી અલગ કરે છે, અને તમે તમારા PHPUnit કન્ફિગરેશન દ્વારા સપોર્ટેડ કોઈપણ આર્ગ્યુમેન્ટ્સ પાસ કરી શકો છો.

<!--
For a plugin, the path would use `plugins/` instead:
-->

પ્લગઇન માટે, પાથમાં તેના બદલે `plugins/` નો ઉપયોગ થશે:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
You can also use `--mount` to explicitly map a local directory to a path inside the Playground filesystem:
-->

સ્થાનિક ડિરેક્ટરીને પ્લેગ્રાઉન્ડ ફાઇલસિસ્ટમની અંદરના પાથ સાથે સ્પષ્ટ રીતે જોડવા (map) માટે તમે `--mount` નો ઉપયોગ પણ કરી શકો છો:

```bash
npx @wp-playground/cli@latest php \
  --mount=.:/wordpress/wp-content/plugins/MY_PLUGIN \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
## Choosing PHP and WordPress versions
-->

## PHP અને વર્ડપ્રેસ વર્ઝન પસંદ કરવા

<!--
Use the `--php` and `--wp` flags to test against specific versions:
-->

ચોક્કસ વર્ઝન સામે પરીક્ષણ કરવા માટે `--php` અને `--wp` ફ્લેગ્સનો ઉપયોગ કરો:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  --php=8.1 \
  --wp=6.5 \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
Supported PHP versions range from 7.4 to 8.5. For WordPress, you can use a specific version number, `latest`, `nightly`, or `beta`.
-->

સપોર્ટેડ PHP વર્ઝન 7.4 થી 8.5 સુધીના છે. વર્ડપ્રેસ માટે, તમે ચોક્કસ વર્ઝન નંબર, `latest`, `nightly`, અથવા `beta` નો ઉપયોગ કરી શકો છો.

<!--
## Next steps

- [Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference and configuration options
- [E2E Testing with Playwright](/guides/e2e-testing-with-playwright) — browser-based end-to-end testing for WordPress plugins and themes
-->

## આગળનાં પગલાં

- [Playground CLI દસ્તાવેજીકરણ](/developers/local-development/wp-playground-cli) — સંપૂર્ણ CLI સંદર્ભ (reference) અને કન્ફિગરેશન વિકલ્પો
- [Playwright સાથે E2E પરીક્ષણ](/guides/e2e-testing-with-playwright) — વર્ડપ્રેસ પ્લગઇન્સ અને થીમ્સ માટે બ્રાઉઝર-આધારિત એન્ડ-ટુ-એન્ડ (end-to-end) પરીક્ષણ
