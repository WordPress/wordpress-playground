# Hosting playground.wordpress.net on WP Cloud

This document covers our setup to host playground.wordpress.net on WP Cloud.

## Web server configuration

The WP Cloud platform is primarily focused on hosting WordPress. Since playground.wordpress.net is not a WordPress site and has some Playground-specific requirements, we had to do a number of things to get the site running as desired.

WP Cloud uses Nginx which does not support the .htaccess files we used previously for:

- rewriting URLs
- redirecting requests
- customizing response headers

In order to customize these aspects for static files on WP Cloud, we did the following:

- Configured the WP Cloud site to delegate requests for non-existent files to WordPress.
- Provided a `__wp__/index.php` file as a default target for Nginx. - Even though this is not a WordPress site, we can provide a `__wp__/index.php` file that Nginx will run as a fallback for non-existent files. The `__wp__/index.php` file is empty and simply exists so Nginx will invoke PHP.
- Added a `custom-redirects.php` file to implement special request handling. - WP Cloud invokes `<web-root>/custom-redirects.php` (if it exists) at the beginning of every PHP run in order to provide custom request handling. We added this file to implement the rewrites, redirects, and custom headers that we used to get via htaccess.
- Keep the main website's complete build behind a server-level deny rule under
  `<web-root>/.playground-releases/`. Nginx must not find a public copy of app
  HTML or assets on the WordPress sandbox host. Otherwise it would serve those
  files before PHP can check the hostname. The deployed `custom-redirects.php`
  selects a private build and calls `playground_handle_request()` in
  `custom-redirects-lib.php`. That library contains all host and path rules.

## Deployment notes

New website builds are pushed to the WP Cloud site via SSH.

The main Playground site uses `apply-update.sh`. The My WordPress site uses
`my-wordpress-net/apply-update.sh` so its endpoint deployment and schema
updates do not affect the main Playground deployment path.

The main deployment workflow builds for `wasm.wordpress.net` and uploads the
normal merged website. `apply-update.sh` checks both hosts, installs a private
release, moves old public files to a rollback backup, and replaces the public
entry file. See the [two-host deployment guide](wordpress-frame/README.md) for
required WP Cloud settings, the Nginx preflight checks, and rollback.

Personal WP retains the previous file placement: its deployment consults
`custom-redirects-lib.php` about each file and moves files needing custom headers
or routing under `<web-root>/static-files-to-serve-via-php/`, with their relative
paths preserved. Its no-argument `playground_handle_request()` call keeps that
existing handler. The main website's two-host routing does not change Personal
WP's endpoint deployment or database updates.

At the end of the deployment process, the WP Cloud edge cache is purged.

## Secrets

Secrets are provided by a "Persistent Data" feature of WP Cloud and are set manually via a WP Cloud API. Once set, the secrets are synched to the site in an encrypted form which is accessed by `custom-redirects-lib.php` via the `Atomic_Persistent_Data`. Here is an [example of retrieving Slack-related secrets](https://github.com/WordPress/wordpress-playground/blob/776e8bbddecdde287ae7bb1d42d711dedf71f138/packages/playground/website-deployment/custom-redirects-lib.php#L186-L192).

The Personal WP usage stats dashboard is protected by GitHub OAuth. Configure
`MYWP_EVENT_DASHBOARD_GITHUB_USERS` as a comma-separated list of allowed GitHub
logins. It can use `MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_ID` and
`MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_SECRET`; when those are absent, it falls back
to `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. The OAuth app callback
URL must allow `https://my.wordpress.net/mywp-event-dashboard.php`.
