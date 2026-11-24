---
title: Como funciona?
description: Saiba como o WordPress Playground converte consultas MySQL para SQLite para executar o WordPress no navegador.
---

<!-- ## Database is supported via MySQL\<\-\>SQLite translation layer -->

## O banco de dados é suportado por uma camada de tradução MySQL\<\-\>SQLite {#database-is-supported-via-mysql-sqlite-translation-layer}

<!--
WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground therefore ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.
-->

O WordPress exige MySQL. Porém, não existe uma versão do MySQL em WebAssembly que você possa rodar no navegador. Por isso, o WordPress Playground distribui o PHP com o [driver nativo do SQLite](https://www.php.net/manual/en/ref.pdo-sqlite.php) e usa o SQLite.

<!-- But how can WordPress run on a different database? -->

Mas como o WordPress consegue rodar em um banco de dados diferente?

<!--
Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The 2.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.
-->

Nos bastidores, o plugin oficial [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) intercepta todas as consultas MySQL e as reescreve no dialeto do SQLite. A versão 2.0 traz [uma nova camada de tradução, criada com base na experiência do WordPress Playground](https://github.com/WordPress/sqlite-database-integration/pull/9), que permite ao WordPress com SQLite passar em 99% da suíte de testes unitários do WordPress.
