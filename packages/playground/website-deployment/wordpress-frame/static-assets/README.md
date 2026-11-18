# Restore the pre-migration WordPress bridge

This inventory restores three original static files from the successful
[November 10 deployment](https://github.com/WordPress/wordpress-playground/actions/runs/42856256223),
commit `ada3b06ce0d85550b55ef3d818460a806ca4f220`. They were extracted from the
`playground-website` artifact's `wasm-wordpress-net.tar.gz`, under
`dist/packages/playground/wasm-wordpress-net/`. `inventory.json` records SHA-256
values and the complete runtime dependency graph of this bridge:

- `assets/wordpress-bridge-CRsvYt8i.js` imports the preload polyfill and appends the
  original root `wordpress-bridge-Cmo7aZBy.js` module.
- `assets/modulepreload-polyfill-B5Qt9EMX.js` has no runtime dependencies.
- `wordpress-bridge-Cmo7aZBy.js` is self-contained. Its `import.meta.url` determines
  the app origin; its service-worker registration remains same-origin with the
  sandbox document. Source maps are debugging metadata, not runtime dependencies.

Do not format, rebuild, rename, or replace these files with current code. They
retain their original bytes, including the original source-map comments. The
formatter excludes them. No historical HTML, PHP, or entire release is published.

## Operator restoration

Ship the updated `website-deployment/` directory to the server using the existing
deployment process. It lives outside the public web root. Then invoke the existing
installer's static restoration mode on the server (with the normal WP Cloud PHP
and edge-purge environment):

```sh
PLAYGROUND_RESTORE_STATIC_ASSETS="$HOME/website-deployment/wordpress-frame/static-assets/inventory.json" \
  "$HOME/website-deployment/apply-update.sh" \
  https://playground.wordpress.net https://wpsandbox.wordpress.net \
  "$HOME/website-deployment/wordpress-frame/static-assets"
```

This does not activate a release. It holds the same deployment lock, checks all
source hashes, dependency inventory entries, safe source resolution, destination
links and collisions before copying. Identical existing files are accepted;
different bytes at the same URL are refused. Only root or `assets/` hashed JS/CSS
paths are allowed. Restored files are independent of root entry snapshots and
release pruning, so later deployments and rollback retain them. A partial copy can
be retried safely. Do not run an older pre-migration installer afterward: that
installer moves all public files into its backup.

The installer purges both hosts and then checks every original URL for HTTP 200,
exact bytes, JavaScript/CSS MIME, and `Access-Control-Allow-Origin: *`, without
following redirects. Existing files are served by Nginx; PHP cannot supply their
headers. The observed production Nginx JavaScript policy already supplies these
headers. If verification fails, correct the server/CDN policy and repeat the
restoration. A failed purge is recovered with the existing
`PLAYGROUND_PURGE_ONLY=1` mode before retrying. Do not copy whole historical source
directories into htdocs, expose old PHP/HTML, or redirect hashed URLs to current code.

No production restoration was performed while preparing this change. Actual server
backups and private release directories were not inspected; the source here is the
trusted GitHub deployment artifact, not an assumption about those directories.

## Rehearsal

The installer/HTTP contracts run with:

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
```

For the actual old-app transition, download and extract the pinned artifact into a
private directory. This requires GitHub artifact access and approximately 2 GB.
The fixture is intentionally opt-in, outside the ordinary browser suite:

```sh
git fetch origin ada3b06ce0d85550b55ef3d818460a806ca4f220 --no-tags
gh run download 42856256223 --name playground-website --dir .context/pre-migration-artifact
mkdir -p .context/pre-migration-build
tar -xzf .context/pre-migration-artifact/wasm-wordpress-net.tar.gz \
  -C .context/pre-migration-build --strip-components=4
npm exec -- nx run playground-website:build:wordpress-frame
PLAYGROUND_PRE_RELEASE_BUILD="$PWD/.context/pre-migration-build" \
  npm exec -- nx run playground-website:e2e:pre-release-transition
```

The rehearsal verifies the original asset hashes, runs the historical installer
and current installer against the two-origin loopback preview, and holds an actual
old document before its hidden bridge navigates. The historical app's literal
production origins are replaced with loopback origins. The frozen historical
installer's HTTPS-only check is changed to HTTP in the test copy; network probes
and edge purging are stubbed. File installation and browser WordPress transport are
real. Restored assets remain byte-for-byte original.

If the bundled Firefox cannot launch locally, set
`PLAYGROUND_STAGING_FIREFOX_CHANNEL=moz-firefox` to use installed Firefox, as in
the existing staging rehearsal.

The worker-update fault is deliberately injected by publishing an invalid worker
script after deployment. It does not establish why the reporter's Chrome worker
could not start. With cold caches, the bridge is retried in the existing app document after restoring
assets; this is a test action, not an automatic user recovery feature. Saved-site
storage is never cleared.

## Broader follow-up

1. Retain each supported app's entire immutable dependency closure, including lazy
   imports, worker entry points, WASM, WordPress builds and response-body helpers.
   Migrate reviewed pre-release assets to a durable inventory with an explicit
   support/removal policy, independent of managed-release age.
2. Version app/bridge/worker protocol handshakes and test overlapping releases,
   including old apps creating new bridges while worker updates fail. Keep app and
   sandbox workers compatible across their independent update schedules.
3. Add explicit recovery when a release expires: recognize a missing release,
   explain what happened, and reload safely while preserving saved files and OPFS.
   Coordinate startup reporting with #4632 without duplicating that PR here.
4. Promote the artifact transition into staging checks with warm/cold caches,
   interrupted updates, two deployments, rollback, delayed imports, real transport,
   and all three browser engines. Add a separate investigation of naturally failing
   Chrome worker startup and CDN/script responses.

This preliminary inventory restores this known bridge generation. It does not
restore every old app's deferred dependencies or fix service-worker startup itself.
