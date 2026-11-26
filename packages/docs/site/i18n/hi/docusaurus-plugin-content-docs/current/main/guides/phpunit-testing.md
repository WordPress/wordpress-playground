---
title: Playground CLI से PHPUnit चलाना
slug: /guides/phpunit-testing
description: Playground CLI से WordPress प्लगइन और थीम के लिए PHPUnit परीक्षण चलाएँ। डेटाबेस की ज़रूरत नहीं, और हर रन पर साफ़ एनवायरनमेंट।
sidebar_class_name: navbar-build-item
---

<!-- The [Playground CLI](/developers/local-development/wp-playground-cli) includes a `php` subcommand that runs PHP scripts directly inside the Playground environment. By mounting your plugin or theme into the Playground filesystem, you can run PHPUnit without a local database. Every run starts with a clean WordPress installation. Your mounted plugin or theme directory is the real folder on your disk, so files a test writes there remain after the run. -->

[Playground CLI](/developers/local-development/wp-playground-cli) में एक `php` सबकमांड है, जो PHP स्क्रिप्ट को सीधे Playground एनवायरनमेंट के अंदर चलाता है। अपने प्लगइन या थीम को Playground फ़ाइल सिस्टम में माउंट करके, आप लोकल डेटाबेस के बिना PHPUnit चला सकते हैं। हर रन एक साफ़ WordPress इंस्टॉलेशन से शुरू होता है। माउंट की गई प्लगइन या थीम डायरेक्टरी आपकी डिस्क का असली फ़ोल्डर होती है, इसलिए कोई परीक्षण उसमें जो फ़ाइलें लिखता है, वे रन के बाद भी बनी रहती हैं।

<div class="callout callout-info">

<!-- This guide assumes your plugin or theme has PHPUnit installed via Composer (`composer require --dev phpunit/phpunit`). The `vendor/bin/phpunit` path used below assumes a standard Composer setup. -->

यह गाइड मानकर चलती है कि आपके प्लगइन या थीम में Composer के ज़रिए PHPUnit स्थापित है (`composer require --dev phpunit/phpunit`)। नीचे उपयोग किया गया `vendor/bin/phpunit` पाथ एक सामान्य Composer सेटअप मानकर चलता है।

</div>

<!-- ## Running tests -->

## परीक्षण चलाना {#running-tests}

<!-- From your plugin or theme directory, run the following command. Replace `themes/THEME_NAME` with the path to your plugin or theme: -->

अपने प्लगइन या थीम की डायरेक्टरी से नीचे दी गई कमांड चलाएँ। `themes/THEME_NAME` की जगह अपने प्लगइन या थीम का पाथ लिखें:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/themes/THEME_NAME/vendor/bin/phpunit \
  -c /wordpress/wp-content/themes/THEME_NAME/phpunit.xml.dist
```

<!-- The `--auto-mount` flag detects whether the current directory is a plugin, theme, or WordPress installation and mounts it at the matching path under `/wordpress/`. The `--` separates CLI flags from arguments passed to the PHP interpreter, and you can pass any arguments supported by your PHPUnit configuration. -->

फ़्लैग `--auto-mount` पहचानता है कि मौजूदा डायरेक्टरी प्लगइन है, थीम है या WordPress इंस्टॉलेशन, और उसे `/wordpress/` के अंदर उससे मेल खाते पाथ पर माउंट करता है। `--` CLI फ़्लैग को उन आर्गुमेंट से अलग करता है जो PHP इंटरप्रेटर को भेजे जाते हैं, और आप अपने PHPUnit कॉन्फ़िगरेशन में समर्थित कोई भी आर्गुमेंट दे सकते हैं।

<!-- For a plugin, the path would use `plugins/` instead: -->

प्लगइन के लिए, पाथ में इसकी जगह `plugins/` होगा:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!-- You can also use `--mount` to explicitly map a local directory to a path inside the Playground filesystem: -->

किसी लोकल डायरेक्टरी को Playground फ़ाइल सिस्टम के अंदर किसी पाथ से साफ़ तौर पर जोड़ने के लिए, आप `--mount` का भी उपयोग कर सकते हैं:

```bash
npx @wp-playground/cli@latest php \
  --mount=.:/wordpress/wp-content/plugins/MY_PLUGIN \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!-- ## Choosing PHP and WordPress versions -->

## PHP और WordPress संस्करण चुनना {#choosing-php-and-wordpress-versions}

<!-- Use the `--php` and `--wp` flags to test against specific versions: -->

किसी ख़ास संस्करण पर परीक्षण करने के लिए `--php` और `--wp` फ़्लैग उपयोग करें:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  --php=8.1 \
  --wp=6.5 \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!-- Supported PHP versions range from 7.4 to 8.5. For WordPress, you can use a specific version number, `latest`, `nightly`, or `beta`. -->

समर्थित PHP संस्करण 7.4 से 8.5 तक हैं। WordPress के लिए आप कोई ख़ास संस्करण नंबर, `latest`, `nightly` या `beta` उपयोग कर सकते हैं।

<!-- ## Next steps -->

## आगे क्या करें {#next-steps}

<!--
- [Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference and configuration options
- [E2E Testing with Playwright](/guides/e2e-testing-with-playwright) — browser-based end-to-end testing for WordPress plugins and themes
-->

- [Playground CLI दस्तावेज़](/developers/local-development/wp-playground-cli): CLI का पूरा संदर्भ और कॉन्फ़िगरेशन विकल्प
- [Playwright के साथ E2E परीक्षण](/guides/e2e-testing-with-playwright): WordPress प्लगइन और थीम के लिए ब्राउज़र पर आधारित एंड-टू-एंड परीक्षण
