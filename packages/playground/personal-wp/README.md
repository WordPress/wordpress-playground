# @wp-playground/personal-wp

A user-focused WordPress Playground application for running a personal WordPress site in the browser. This package powers [my.wordpress.net](https://my.wordpress.net).

## Overview

Personal Playground is a streamlined, end-user focused version of WordPress Playground. While [playground.wordpress.net](https://playground.wordpress.net) targets developers with features like blueprint galleries, GitHub integration, and temporary sites, Personal Playground provides a simpler experience for users who want their own persistent WordPress site.

### Key Differences from playground.wordpress.net

**Removed:**

- Blueprint gallery and site list (replaced with a tailored welcome experience)
- Import from file/URL/GitHub UI
- Temporary site creation
- Multiple saved sites management

**Added:**

- Single persistent site stored in OPFS by default
- Welcome plugin with guided onboarding
- Automatic language detection from browser settings
- App catalog with pre-configured blueprints to install
- Backup reminder system with history
- Health Check integration for crash recovery
- Multi-tab coordination (one worker per site, dependent tabs, takeover protocol)
- Cross-tab sync for backup status

## Features

### Persistent Storage

Your WordPress site is automatically saved in the browser's Origin Private File System (OPFS). No setup required - just start using WordPress and your data persists across sessions.

### Welcome & Onboarding

A welcome plugin guides new users through the initial setup, making it easy to get started with WordPress.

### App Catalog

Browse and install apps from a curated catalog of pre-configured blueprints. Each app is a one-click install that extends your WordPress site with new functionality.

### Backup System

Automatic backup reminders help you keep your data safe. View backup history and export your site data when needed.

### Crash Recovery

Health Check integration detects and recovers from site crashes automatically, ensuring you never lose access to your WordPress site.

### Multi-Tab Support

Sophisticated tab coordination ensures only one worker runs per site. Dependent tabs connect automatically, and a takeover protocol handles tab conflicts gracefully.

### Offline Support

Works as a Progressive Web App (PWA) for offline use. Install it on your device for a native app-like experience.

## Development

```bash
# Start the development server (runs on port 5401)
npx nx dev playground-personal-wp

# Build for production
npx nx build playground-personal-wp

# Run tests
npx nx test playground-personal-wp

# Type checking
npx nx typecheck playground-personal-wp

# Linting
npx nx lint playground-personal-wp
```

## Build Output

The build process combines `playground-remote` and `playground-personal-wp` into a single deployable package at `dist/packages/playground/my-wordpress-net/`.

Build targets:

- `build` - Full build (runs `build:my-wordpress-net`)
- `build:my-wordpress-net` - Combines remote + personal-wp into deployable package
- `build:standalone` - Builds only personal-wp without combining

The combined output includes:

- `index.html` - Main entry point
- `manifest.json` - PWA manifest
- `blueprints/boot.json` - Default blueprint (auto-login to wp-admin)
- `assets/` - Bundled JavaScript, CSS, and source maps
- `remote.html` - The iframe that runs PHP (from playground-remote)

## Deployment

Personal Playground is deployed to my.wordpress.net via the `deploy-my-wordpress-net.yml` GitHub Actions workflow. The deployment:

1. Builds the package with `npx nx build playground-personal-wp`
2. Uploads the build as an artifact
3. Deploys to WP Cloud hosting via rsync/SSH
4. Uses the shared `website-deployment/` scripts for server configuration

### Required Secrets

The deployment requires these GitHub secrets in the `my-wordpress-net-wp-cloud` environment:

- `DEPLOY_MY_WORDPRESS_NET_HOST_KEY` - SSH host key
- `DEPLOY_MY_WORDPRESS_NET_PRIVATE_KEY` - SSH private key
- `DEPLOY_MY_WORDPRESS_NET_USER` - SSH username
- `DEPLOY_MY_WORDPRESS_NET_HOST` - SSH hostname

The deployment also requires these GitHub variables in the `my-wordpress-net-wp-cloud` environment:

- `CORS_PROXY_URL` - The URL prefix to use for CORS proxy requests, like `https://<cors-proxy-domain>/?`.
- `GIT_REF_TO_DEPLOY` - The Git ref to deploy. Specify "trunk" to deploy the latest from the `trunk` branch.

## Architecture

```
personal-wp/
├── src/
│   ├── main.tsx                 # Application entry point
│   ├── components/
│   │   ├── layout/              # Main application layout
│   │   ├── site-manager/        # Site info, files, and database panels
│   │   ├── browser-chrome/      # Browser-like UI chrome
│   │   ├── playground-viewport/ # WordPress iframe container
│   │   └── ...
│   └── lib/
│       ├── state/
│       │   ├── redux/           # Redux store and slices
│       │   ├── opfs/            # OPFS storage utilities
│       │   └── url/             # URL routing
│       ├── health-check-recovery.ts
│       └── ...
├── public/
│   └── blueprints/
│       └── boot.json            # Default boot blueprint
└── index.html                   # HTML entry point
```

## Tracking

Personal Playground uses Google Analytics to understand usage patterns. No personal information is tracked or stored.

## Related Packages

- `@wp-playground/client` - JavaScript API for embedding Playground
- `@wp-playground/remote` - The iframe application that runs PHP
- `@wp-playground/blueprints` - Blueprint execution engine
- `@php-wasm/web` - Browser-based PHP runtime
