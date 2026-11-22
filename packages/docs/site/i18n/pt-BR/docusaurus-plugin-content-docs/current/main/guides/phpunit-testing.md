---
title: Executando PHPUnit com o Playground CLI
slug: /guides/phpunit-testing
description: Execute testes PHPUnit para plugins e temas do WordPress usando o Playground CLI — sem precisar de banco de dados e com um ambiente limpo a cada execução.
sidebar_class_name: navbar-build-item
---

<!--
The [Playground CLI](/developers/local-development/wp-playground-cli) includes a `php` subcommand that runs PHP scripts directly inside the Playground environment. By mounting your plugin or theme into the Playground filesystem, you can run PHPUnit without a local database. Every run starts with a clean WordPress installation, so tests are fully isolated.
-->
O [Playground CLI](/developers/local-development/wp-playground-cli) inclui um subcomando `php` que executa scripts PHP diretamente no ambiente do Playground. Ao montar seu plugin ou tema no sistema de arquivos do Playground, você pode executar o PHPUnit sem a necessidade de um banco de dados local. Cada execução começa com uma instalação limpa do WordPress, garantindo que os testes fiquem totalmente isolados.

<div class="callout callout-info">

<!--
This guide assumes your plugin or theme has PHPUnit installed via Composer (`composer require --dev phpunit/phpunit`). The `vendor/bin/phpunit` path used below assumes a standard Composer setup.
-->
Este guia pressupõe que seu plugin ou tema tenha o PHPUnit instalado via Composer (`composer require --dev phpunit/phpunit`). O caminho `vendor/bin/phpunit` utilizado abaixo considera uma configuração padrão do Composer.

</div>

<!-- Running tests -->
## Executando testes

<!--
From your plugin or theme directory, run the following command. Replace `themes/THEME_NAME` with the path to your plugin or theme:
-->
A partir do diretório do seu plugin ou tema, execute o seguinte comando. Substitua `themes/THEME_NAME` pelo caminho para o seu plugin ou tema:

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
A opção `--auto-mount` detecta se o diretório atual é um plugin, um tema ou uma instalação do WordPress e o monta no caminho correto dentro de `/wordpress/wp-content/`. O `--` separa as opções da CLI dos argumentos passados ao interpretador PHP, e você pode fornecer quaisquer argumentos compatíveis com sua configuração do PHPUnit.

<!-- For a plugin, the path would use `plugins/` instead: -->
Para um plugin, o caminho utilizaria `plugins/`:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!-- You can also use `--mount` to explicitly map a local directory to a path inside the Playground filesystem: -->
Você também pode usar `--mount` para mapear explicitamente um diretório local a um caminho dentro do sistema de arquivos do Playground:

```bash
npx @wp-playground/cli@latest php \
  --mount=.:/wordpress/wp-content/plugins/MY_PLUGIN \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!-- Choosing PHP and WordPress versions -->
## Escolha de versões do PHP e do WordPress

<!-- Use the `--php` and `--wp` flags to test against specific versions: -->
Use as opções `--php` e `--wp` para executar testes com versões específicas:

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
As versões suportadas do PHP variam de 7.4 a 8.5. Para o WordPress, você pode utilizar um número de versão específico, `latest`, `nightly` ou `beta`.

<!-- Next steps -->
## Próximos passos

<!-- - [Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference and configuration options -->
- [Documentação da CLI do Playground](/developers/local-development/wp-playground-cli) — referência completa da CLI e opções de configuração
<!-- - [E2E Testing with Playwright](/guides/e2e-testing-with-playwright) — browser-based end-to-end testing for WordPress plugins and themes -->
- [Testes E2E com Playwright](/guides/e2e-testing-with-playwright) — testes de ponta a ponta executados no navegador para plugins e temas do WordPress
