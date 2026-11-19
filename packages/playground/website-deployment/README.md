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
- Serve the main website's static files directly from public, immutable
  `<web-root>/releases/<id>/` directories on both hostnames. Each build's asset
  URLs name its release, so open tabs keep loading their own files after a later
  deployment. Native PHP endpoints stay under the Nginx-denied
  `<web-root>/.playground-releases/<id>/`. The deployed `custom-redirects.php`
  selects the active release and calls `playground_handle_request()` in
  `custom-redirects-lib.php`, which contains all host and path rules for missing files.

## Deployment notes

New website builds are pushed to the WP Cloud site via SSH.

The main Playground site uses `apply-update.sh`. The My WordPress site uses
`my-wordpress-net/apply-update.sh` so its endpoint deployment and schema
updates do not affect the main Playground deployment path.

The main deployment workflow runs `deploy-website.sh` with
`https://playground.wordpress.net` as the app origin and
`https://wpsandbox.wordpress.net` as the WordPress origin. That script chooses a
unique `PLAYGROUND_RELEASE_ID`, builds the website for those values, uploads the
build and this directory over SSH, and runs the single `apply-update.sh` script. `apply-update.sh` checks both hosts and the build, installs the public and
private release directories, backs up the root files it replaces, replaces the PHP
entry, copies the entry pages, and installs the root `/sw.js` worker before purging
the edge. Its PHP steps live in `apply-update.php`, which receives values only as
arguments. See the [two-host deployment guide](wordpress-frame/README.md)
for required WP Cloud settings, the Nginx preflight checks, and rollback.

`PLAYGROUND_APP_ORIGIN` remains the app-origin build setting. Vite explicitly
embeds that value in browser code and uses it for the page guards, so existing
build scripts keep the same variable name.

Personal WP retains the previous file placement: its deployment consults
`custom-redirects-lib.php` about each file and moves files needing custom headers
or routing under `<web-root>/static-files-to-serve-via-php/`, with their relative
paths preserved. Its no-argument `playground_handle_request()` call keeps that
existing handler. The main website's two-host routing does not change Personal
WP's endpoint deployment or database updates.

At the end of the deployment process, the WP Cloud edge cache is purged.

## Rolling back

Run the installer already on the server; a rollback needs no build or origins and
finishes in seconds:

```sh
ssh -tt <user@host> PLAYGROUND_ROLLBACK=previous website-deployment/apply-update.sh
```

`previous` restores whatever was live before the current release; repeat it to step
further back, or pass a release ID to undo that deployment.
`https://playground.wordpress.net/release.json` names the live and previous releases.
Deployment and rollback take the same host lock. If the edge purge fails, finish it
without changing the live files again:

```sh
ssh -tt <user@host> PLAYGROUND_PURGE_ONLY=1 website-deployment/apply-update.sh
```

The installer keeps the hostnames in `~/website-backups/pending-edge-purge` until
both purges succeed, including when rollback removes `release.json`. A pending purge
must finish before another deployment or rollback can start.
See the [two-host deployment guide](wordpress-frame/README.md#verify-and-roll-back)
for details.

## Testing a deployment on a staging site

Use a disposable WP Cloud site with two HTTPS hostnames, set up like production
(see the [two-host deployment guide](wordpress-frame/README.md)), and an SSH key
for it. From the repository root:

```sh
PLAYGROUND_STAGING_CONFIRM=user@staging-host \
  packages/playground/website-deployment/test-staging-deployment.sh \
  user@staging-host https://app.staging.example https://wp.staging.example
```

It deploys two releases with `deploy-website.sh`, the script the workflow uses,
then rolls back, checks that a broken upload is refused, and expires a release
early. `check-deployment.sh` verifies each active release over HTTP. Set
`PLAYGROUND_STAGING_FROM_TRUNK=1` to deploy `origin/trunk` first and rehearse the
transition from the current production layout. Add `PLAYGROUND_STAGING_BROWSER=1` to
finish with `test-staging-upgrade.mjs`: Chromium, Firefox and WebKit sessions stay
open while the site upgrades from trunk to two releases, then rolls back to the first
release and from it to trunk. It checks open tabs, reloads, fresh tabs and a site saved
in browser storage. The test overwrites the site and refuses the production hostnames.
It ends with a short list of browser checks.
The trunk rehearsal also forces a failed edge purge after rollback and tests purge-only
recovery without a release manifest. Browser errors include their phase and request URLs;
reloads before the first upgrade provide a trunk-only comparison.
If bundled Firefox cannot launch locally, set
`PLAYGROUND_STAGING_FIREFOX_CHANNEL=moz-firefox` to use installed Firefox.

WP Cloud's edge cache purge clears only the primary domain unless a domain is
named, so `apply-update.sh` purges each hostname. Nginx lets the edge cache `.js`
files, including the root `/sw.js` worker, for a year, so both purges are needed.
The purge returns before every edge node drops its copies; the checks wait for both
hosts' root files to name the new release.

`check-deployment.sh` only reads, so it can also check production after a deploy:

```sh
packages/playground/website-deployment/check-deployment.sh \
  https://playground.wordpress.net https://wpsandbox.wordpress.net
```

## Static-file ranges

PHP-served files support `Range: bytes=<start>-` and `bytes=<start>-<end>` on GET,
so interrupted runtime downloads can resume with HTTP 206. Multiple ranges,
suffix ranges, unrecognized syntax/units, and requests with `If-Range` get the
normal full response. A supported range outside the file returns 416. HEAD
ignores Range and returns the full content length without a body. No multipart
response handling or validator matching is added.

Run `npm exec -- nx run playground-website:test:static-file-ranges` with Node 24
and PHP to check the real HTTP responses. This does not change hostname routing
or the deployment file layout.

## Secrets

Secrets are provided by a "Persistent Data" feature of WP Cloud and are set manually via a WP Cloud API. Once set, the secrets are synched to the site in an encrypted form which is accessed by `custom-redirects-lib.php` via the `Atomic_Persistent_Data`. Here is an [example of retrieving Slack-related secrets](https://github.com/WordPress/wordpress-playground/blob/776e8bbddecdde287ae7bb1d42d711dedf71f138/packages/playground/website-deployment/custom-redirects-lib.php#L186-L192).

The Personal WP usage stats dashboard is protected by GitHub OAuth. Configure
`MYWP_EVENT_DASHBOARD_GITHUB_USERS` as a comma-separated list of allowed GitHub
logins. It can use `MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_ID` and
`MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_SECRET`; when those are absent, it falls back
to `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. The OAuth app callback
URL must allow `https://my.wordpress.net/mywp-event-dashboard.php`.
