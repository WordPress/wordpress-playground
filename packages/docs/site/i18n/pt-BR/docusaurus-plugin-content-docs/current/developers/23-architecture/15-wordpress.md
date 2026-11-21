---
slug: /developers/architecture/wordpress
---

<!-- # WordPress support -->

# Suporte ao WordPress

<!-- WordPress, as a PHP application, can run on PHP WebAssembly. However, there are a few caveats. -->

O WordPress, por ser uma aplicação PHP, pode rodar no PHP WebAssembly. Porém, há algumas ressalvas.

<!-- ## SQLite -->

## SQLite {#sqlite}

<!--
First, WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground, therefore, ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.
-->

Primeiro, o WordPress exige MySQL. Porém, não existe uma versão do MySQL em WebAssembly que você possa rodar no navegador. Por isso, o WordPress Playground distribui o PHP com o [driver nativo do SQLite](https://www.php.net/manual/en/ref.pdo-sqlite.php) e usa o SQLite.

<!-- But how can WordPress run on a different database? -->

Mas como o WordPress consegue rodar em um banco de dados diferente?

<!--
Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The x.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.
-->

Nos bastidores, o plugin oficial [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) intercepta todas as consultas MySQL e as reescreve no dialeto do SQLite. A versão x.0 traz [uma nova camada de tradução, criada com base na experiência do WordPress Playground](https://github.com/WordPress/sqlite-database-integration/pull/9), que permite ao WordPress com SQLite passar em 99% da suíte de testes unitários do WordPress.

<!-- ## WordPress in the browser -->

## WordPress no navegador {#wordpress-in-the-browser}

<!--
You can use any WordPress build in the browser. For convenience and to reduce the data transfer size, WordPress Playground ships a few [minified WordPress releases](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/wordpress-builds) that you can use in the browser.
-->

Você pode usar qualquer build do WordPress no navegador. Por conveniência e para reduzir o volume de dados transferidos, o WordPress Playground distribui algumas [versões minificadas do WordPress](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/wordpress-builds) que você pode usar no navegador.

<!-- ## WordPress in Node.js -->

## WordPress no Node.js {#wordpress-in-nodejs}

<!--
In Node.js, you'll typically want to [mount WordPress](/developers/architecture/wasm-php-filesystem) from a disk directory.
-->

No Node.js, normalmente você vai querer [montar o WordPress](/developers/architecture/wasm-php-filesystem) a partir de um diretório no disco.
