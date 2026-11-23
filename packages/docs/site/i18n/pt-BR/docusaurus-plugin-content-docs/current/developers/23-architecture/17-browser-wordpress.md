---
title: Empacotando o WordPress para o navegador
description: Como o Dockerfile do empacotador web transforma um WordPress padrão em um WordPress otimizado para o navegador.
---

<!-- # Bundling WordPress for the browser -->

# Empacotando o WordPress para o navegador

<!--
The [web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) turns a vanilla WordPress into a browser-optimized one:
-->

O [Dockerfile do empacotador web](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) transforma um WordPress padrão em um WordPress otimizado para o navegador:

<!--
-   Makes WordPress run on SQLite using the [official drop-in plugin](https://github.com/WordPress/sqlite-database-integration) as MySQL is unsupported in the browser.
-   Reduces the WordPress website size from about 70MB to about 10MB, or 5MB compressed.
-   Runs the WordPress installation wizard.
-   Bundles WordPress as a minified zip file.
-->

-   Faz o WordPress rodar no SQLite usando o [plugin drop-in oficial](https://github.com/WordPress/sqlite-database-integration), já que o MySQL não é suportado no navegador.
-   Reduz o tamanho do site WordPress de cerca de 70 MB para cerca de 10 MB, ou 5 MB comprimido.
-   Executa o assistente de instalação do WordPress.
-   Empacota o WordPress como um arquivo zip minificado.

<!-- Build a new bundle with `nx bundle-wordpress playground-wordpress-builds --wp-version=<version>`, e.g.: -->

Gere um novo pacote com `nx bundle-wordpress playground-wordpress-builds --wp-version=<version>`, por exemplo:

```
nx bundle-wordpress playground-wordpress-builds --wp-version=6.1
```

<!-- The bundler outputs: -->

O empacotador gera:

<!--
-   `packages/playground/wordpress-builds/public/wp-6.1.zip` – zipped WordPress files
-   `packages/playground/wordpress-builds/public/wp-6.1/` – a directory with static assets for the specified WordPress versions
-->

-   `packages/playground/wordpress-builds/public/wp-6.1.zip`: os arquivos do WordPress compactados
-   `packages/playground/wordpress-builds/public/wp-6.1/`: um diretório com os arquivos estáticos da versão do WordPress especificada

<!--
Consult [the web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) for more details (like the list of supported WordPress versions) and modify it to customize the default WordPress installation.
-->

Consulte [o Dockerfile do empacotador web](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) para mais detalhes (como a lista de versões suportadas do WordPress) e modifique-o para personalizar a instalação padrão do WordPress.
