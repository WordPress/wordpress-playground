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
- Experimental shared PHP runtime across tabs, with full client access in every tab
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

Personal WP explicitly opts into an experimental SharedWorker runtime. Every tab connects to
one PHP runtime per site, and closing the first tab does not interrupt the others. The
ServiceWorker sends HTTP requests directly to the runtime through a MessagePort; requests
are not broadcast to tabs. The main Playground website keeps its dedicated-worker approach.

Each newly opened document checks `personal-wp-version.json` once with caching disabled.
There is no periodic deployment polling. If the deployed version differs from the running
worker, the shared runtime stops accepting operations, drains active PHP work, and flushes
OPFS before shutting down. Existing tabs display a reload prompt on their next runtime
operation or HTTP request. The reload button waits until saving and shutdown finish. A failed
version check permits offline startup.

If saving fails during retirement, the runtime keeps ownership and blocks new
operations. Opening another tab retries retirement, allowing saving and shutdown
to finish after the storage problem is resolved.

A runtime ownership Web Lock prevents concurrent writers and detects tabs from the older
implementation. Those legacy tabs must be closed before the shared runtime can boot.

### WordPress Page Relay Messages

WordPress pages running inside Personal Playground can send supported relay messages to
the parent window. Messages must use `type: 'relay'` and are only accepted from the
active Playground iframe tree.

#### Install Blueprint

Use `install-blueprint` to ask Personal Playground to install a blueprint into the
current site. Personal Playground confirms the action with the user before applying
the blueprint. Installation and navigation use the shared runtime from the requesting tab.

```js
window.parent.postMessage(
	{
		type: 'relay',
		relayType: 'install-blueprint',
		blueprintUrl: 'https://example.com/blueprint.json',
		requestId,
	},
	'*'
);
```

Response:

```ts
{
	type: 'relay';
	relayType: 'install-blueprint-result';
	blueprintUrl: string;
	requestId?: string;
	status: 'success' | 'error' | 'cancelled';
	error?: string;
}
```

Blueprint URLs must be `https:`, `data:`, or local `http:` URLs.

#### Backup Site

Use `backup-site` to ask Personal Playground to zip the current site and hand the
file to the browser's downloader — the same backup the Site Tools panel produces.
The download appears in the requesting tab.

```js
window.parent.postMessage(
	{
		type: 'relay',
		relayType: 'backup-site',
		requestId,
	},
	'*'
);
```

Response:

```ts
{
	type: 'relay';
	relayType: 'backup-site-result';
	requestId?: string;
	status: 'started' | 'success' | 'error';
	error?: string;
}
```

`started` is sent as soon as the request is accepted, before the site is zipped.
Waiting for it lets a page tell a slow backup apart from an older Personal
Playground that ignores the message, so it can fall back to pointing at Site
Tools. `success` or `error` follows once the zip is done.

A request that arrives before the site has finished coming up waits for it, up
to 15 seconds, rather than being refused — the page doing the asking was served
by that site, so it is generally the shell's state that is behind.

No confirmation dialog is shown: the file only reaches the user's own disk, the
requesting page never gets to read it, and a browser download is visible anyway.
Only one backup runs at a time; a request that arrives while one is in flight
comes back as an error.

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

### Verify the SharedWorker in Chrome DevTools

Open two Personal WP tabs on the same origin in the same browser profile, and wait
for both sites to finish loading. Different origins, including the two deployment
hostnames, have separate workers and storage.

1. Open `chrome://inspect/#workers`. There should be one Personal WP SharedWorker
   named `personal-wp:default` for the default site. Click **Inspect** to open its
   debugger. Close the first application tab and verify the second still works.
   Close the worker inspector when checking whether the last tab releases the worker.
2. In each application's DevTools Console, select the top-level page context.
   Write a marker from the first tab:

    ```js
    await window.playground.writeFile('/shared-worker-devtools-test', 'from tab A');
    ```

    Read it from the second tab, including after closing the first:

    ```js
    await window.playground.readFileAsText('/shared-worker-devtools-test');
    ```

    The result should be `from tab A`. This file is outside the persisted WordPress
    directory, so it verifies shared runtime memory rather than shared OPFS storage.
    Remove it afterward with `await window.playground.unlink('/shared-worker-devtools-test')`.

3. In **Application → Service Workers**, inspect the registered ServiceWorker URL.
   It should include `experimental-shared-worker=1`. This worker remains the HTTP
   gateway; PHP executes in the SharedWorker. In the SharedWorker debugger, set a
   breakpoint in `SharedRuntime.handleServiceWorkerRequest` to inspect direct HTTP
   routing. `SharedRuntime.beginBoot` and `SharedRuntime.retire` are useful for
   inspecting startup and shutdown.
4. In **Network**, filter for `personal-wp-version.json` and reload the page.
   Expect one version check for that document and no periodic checks while idle.

To verify a deployment update, keep an old tab open, deploy a new build, and open
a new tab. The new tab detects the version mismatch and retires the old runtime.
An old tab should show the reload prompt on its next API call or WordPress HTTP
request. Reload becomes available after active work drains and OPFS is saved.
After reloading, verify that site data persists and the new runtime accepts requests.
The version is derived from the build's Git commit; restarting the dev server
without changing that version does not simulate a deployment update.

For a shutdown-only check, run `await window.playground.shutdownSharedRuntime()`
in the application console, then try another API call in the other tab. It should
require a reload. This verifies retirement, but does not exercise the server version check.
Avoid the inspector's **Terminate** action for this check because it bypasses graceful saving.

See Chromium's [worker debugging documentation](https://blog.chromium.org/2012/04/debugging-web-workers-with-chrome.html)
for the separate SharedWorker inspector.

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
4. Applies the update with `website-deployment/my-wordpress-net/apply-update.sh`

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
