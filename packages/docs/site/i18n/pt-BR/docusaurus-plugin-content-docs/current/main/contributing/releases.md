---
slug: /contributing/releases
title: Publicação de pacotes
description: Como os pacotes do Playground são publicados no npm e o que fazer ao adicionar novos pacotes.
---

# Publicação de pacotes

<!--
# Releasing packages
 -->

O Playground publica seus pacotes no npm usando workflows automatizados de CI. Esta página explica como o processo de publicação funciona e o que você precisa saber ao adicionar novos pacotes.

<!--
Playground publishes its packages to npm using automated CI workflows. This page explains how the release process works and what you need to know when adding new packages.
 -->

## Publicações automatizadas

<!--
## Automated releases
 -->

Os pacotes npm são publicados automaticamente toda segunda-feira via GitHub Actions, ou manualmente pelos mantenedores usando o workflow dispatch. O workflow incrementa as versões usando [Lerna](https://lerna.js.org/), cria tags para o release e publica todos os pacotes públicos no npm.

<!--
The npm packages are published automatically every Monday via GitHub Actions, or manually by maintainers using the workflow dispatch. The workflow bumps versions using [Lerna](https://lerna.js.org/), tags the release, and publishes all public packages to npm.
 -->

O CI se autentica no npm usando [publicação confiável via OpenID Connect (OIDC)](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions). Isso é mais seguro do que usar tokens npm de longa duração, pois gera credenciais de curta duração para cada execução do workflow e vincula a procedência do pacote diretamente ao repositório do GitHub.

<!--
The CI authenticates with npm using [OpenID Connect (OIDC) trusted publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions). This is more secure than using long-lived npm tokens because it generates short-lived credentials for each workflow run and ties package provenance directly to the GitHub repository.
 -->

## Adicionando um novo pacote

<!--
## Adding a new package
 -->

Quando você adiciona um novo pacote npm ao monorepo, o workflow de publicação automatizada não conseguirá publicá-lo na primeira execução. Isso é um recurso de segurança do npm: a publicação confiável via OIDC só funciona para pacotes que já existem e foram configurados para confiar no repositório do GitHub.

<!--
When you add a new npm package to the monorepo, the automated release workflow won't be able to publish it on the first run. This is an npm security feature: OIDC trusted publishing only works for packages that already exist and have been configured to trust the GitHub repository.
 -->

Aqui está o que você precisa fazer:

<!--
Here's what you need to do:
 -->

### 1. Publique o pacote manualmente

<!--
### 1. Publish the package manually
 -->

Primeiro, autentique-se no npm em sua máquina local:

<!--
First, authenticate with npm on your local machine:
 -->

```bash
npm login
```

Em seguida, publique o pacote pela primeira vez:

<!--
Then publish the package for the first time:
 -->

```bash
cd packages/your-new-package
npm publish --access public
```

Isso cria o pacote no registro do npm sob sua conta.

<!--
This creates the package on the npm registry under your account.
 -->

### 2. Configure a publicação confiável

<!--
### 2. Configure trusted publishing
 -->

Após a publicação inicial, acesse as configurações do pacote em npmjs.com e configure a publicação confiável via OIDC:

<!--
After the initial publish, go to the package's settings on npmjs.com and set up OIDC trusted publishing:
 -->

1. Navegue até seu pacote em [npmjs.com](https://www.npmjs.com)
2. Vá para **Settings** → **Configure Trusted Publishers**
3. Adicione um novo publicador confiável com estas configurações:
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`

<!--
1. Navigate to your package on [npmjs.com](https://www.npmjs.com)
2. Go to **Settings** → **Configure Trusted Publishers**
3. Add a new trusted publisher with these settings:
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`
 -->

![Configurando publicação confiável via OIDC no npm](/img/php-wasm-node-oidc.webp)

### 3. Transfira a propriedade (se necessário)

<!--
### 3. Transfer ownership (if needed)
 -->

Se você publicou sob sua conta pessoal, transfira o pacote para a organização `@aspect` ou garanta que a equipe apropriada tenha acesso de publicação.

<!--
If you published under your personal account, transfer the package to the `@aspect` organization or ensure the appropriate team has publish access.
 -->

Uma vez configurado, as publicações subsequentes funcionarão automaticamente através do workflow de CI.

<!--
Once configured, subsequent releases will work automatically through the CI workflow.
 -->

## Por que o OIDC não pode publicar novos pacotes

<!--
## Why OIDC can't publish new packages
 -->

A implementação de OIDC do npm exige que o pacote já exista antes que um publicador confiável possa ser configurado. Esta é uma situação de "ovo e galinha" por design — ela impede que alguém sequestre um nome de pacote através de um workflow do GitHub antes que o proprietário legítimo possa reivindicá-lo.

<!--
npm's OIDC implementation requires the package to already exist before a trusted publisher can be configured. This is a chicken-and-egg situation by design—it prevents someone from hijacking a package name through a GitHub workflow before the legitimate owner can claim it.
 -->

A primeira publicação manual estabelece a propriedade, e a publicação confiável então fornece autenticação segura e sem token para todas as publicações futuras.

<!--
The manual first publish establishes ownership, and trusted publishing then provides secure, token-free authentication for all future releases.
 -->
