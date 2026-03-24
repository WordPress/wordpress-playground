---
slug: /contributing/releases
title: Releasing packages
description: How Playground packages are released to npm, and what to do when adding new packages.
---

# Releasing packages

Playground publishes its packages to npm using automated CI workflows. This page explains how the release process works and what you need to know when adding new packages.

## Automated releases

The npm packages are published automatically every Monday via GitHub Actions, or manually by maintainers using the workflow dispatch. The workflow bumps versions using [Lerna](https://lerna.js.org/), tags the release, and publishes all public packages to npm.

The CI authenticates with npm using [OpenID Connect (OIDC) trusted publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions). This is more secure than using long-lived npm tokens because it generates short-lived credentials for each workflow run and ties package provenance directly to the GitHub repository.

## Adding a new package

When you add a new npm package to the monorepo, the automated release workflow won't be able to publish it on the first run. This is an npm security feature: OIDC trusted publishing only works for packages that already exist and have been configured to trust the GitHub repository.

Here's what you need to do:

### 1. Publish the package manually

First, authenticate with npm on your local machine:

```bash
npm login
```

Then publish the package for the first time:

```bash
cd packages/your-new-package
npm publish --access public
```

This creates the package on the npm registry under your account.

### 2. Configure trusted publishing

After the initial publish, go to the package's settings on npmjs.com and set up OIDC trusted publishing:

1. Navigate to your package on [npmjs.com](https://www.npmjs.com)
2. Go to **Settings** → **Configure Trusted Publishers**
3. Add a new trusted publisher with these settings:
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`

![Setting up OIDC trusted publishing on npm](/img/php-wasm-node-oidc.webp)

### 3. Transfer ownership (if needed)

If you published under your personal account, transfer the package to the `@aspect` organization or ensure the appropriate team has publish access.

Once configured, subsequent releases will work automatically through the CI workflow.

## Why OIDC can't publish new packages

npm's OIDC implementation requires the package to already exist before a trusted publisher can be configured. This is a chicken-and-egg situation by design—it prevents someone from hijacking a package name through a GitHub workflow before the legitimate owner can claim it.

The manual first publish establishes ownership, and trusted publishing then provides secure, token-free authentication for all future releases.
