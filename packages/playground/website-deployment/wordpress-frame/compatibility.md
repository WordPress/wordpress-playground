# Compatibility removal checklist

Updated as of **2026-11-18**, for PR #4613 and the root-only layout's asset index. Search for the code markers below before
removing an allowance. These describe different transitions; "legacy" alone is
not a removal condition. Here, the **old root-only production layout** means
builds that load assets from `/assets/` and `/wp-<version>/`, do not report a
`releaseBase`, and use root bridge URLs rather than `/releases/<id>/` URLs.

## Temporary support for the old root-only production layout

| Code marker                      | Allowance and locations                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Remove when                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRE_RELEASE_ASSETS_COMPAT`      | A PHP runtime can omit `releaseBase` and report `wp-6.8` instead of `releases/<id>/wp-6.8`. `remote/src/lib/wordpress-static-assets.ts` and `remote/service-worker.ts` then use the app-host alias and CORS. `custom-redirects-lib.php` supplies headers for those aliases. App workers also leave root `/assets/` downloads to HTTP during rollback, covered by `app-worker-upgrade.spec.ts`. WordPress asset resolution is covered by `wordpress-static-assets.spec.ts`.                      | Runtimes from the old root-only production layout are no longer supported, including already-open tabs, and rollback to those builds is no longer required. Force old tabs to reload before dropping their support. Preserve explicit `releaseBase: '/'` for portable builds. |
| `PRE_RELEASE_BRIDGE_URL_COMPAT`  | `custom-redirects-lib.php` accepts `/wordpress-bridge.html` and `/wordpress-bridge-<buildVersion>.html` for clients loaded from the old root-only production layout. Managed releases now use `/releases/<id>/wordpress-bridge.html`. Covered by router and wordpress-bridge-upgrade tests.                                                                                                                                                                                                     | No supported client or rollback build requests these production aliases. Keep bridge aliases on development and portable hosts that still generate them.                                                                                                                      |
| `PRE_RELEASE_ASSET_INDEX_COMPAT` | `apply-update.php` indexes hashed scripts, styles, WebAssembly and extension files from live builds of the old root-only layout in `.playground-releases/release.XXXXXXXX/files/`. `custom-redirects-lib.php` serves those paths on the app host for missing files, such as the `/wordpress-bridge-<hash>.js` named by old WordPress workers. Covered by router tests, the preview's fixture release in `wordpress-bridge-upgrade.spec.ts`, and the opt-in `e2e:root-layout-transition` target. | Clients from the old root-only production layout are no longer supported, including old WordPress workers that have not updated. Then delete those directories and the index.                                                                                                 |
| `PRE_RELEASE_ROOT_COMPAT`        | `apply-update.php` accepts a missing root `release.json`, snapshots the old entry files, and can restore the PHP-served layout. Covered by installer tests and the staging rollback rehearsal.                                                                                                                                                                                                                                                                                                  | Every managed site has migrated and the first-deployment rollback window is closed. A fresh installation still needs to work without an existing manifest.                                                                                                                    |
| `UNTRACKED_RELEASE_COMPAT`       | The installer skips old directories that have no lifecycle metadata instead of guessing their age or deleting a rollback target. Covered by the `Untracked release retention` contract in `test-router.mjs`.                                                                                                                                                                                                                                                                                    | `PRE_RELEASE_ASSET_INDEX_COMPAT` is removed. Until then, the root-only layout's `release.XXXXXXXX` directories serve old clients and must stay.                                                                                                                               |

Closing the rollback window alone is insufficient for browser compatibility:
old tabs may remain open or return after being offline. The 30-day retention
window does not apply to tabs loaded from the old root-only production layout:
those builds have no managed release ID.

## Compatibility that continues across future releases

| Code marker                      | Allowance and locations                                                                                                                                                                                           | Remove when                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RELEASE_BRIDGE_PROTOCOL_COMPAT` | A WordPress bridge iframe from retained release A can talk to worker B. Message fields and response-body ports stay compatible; a saved v1 WordPress bridge tests this. See `remote/src/lib/wordpress-bridge.ts`. | All supported and protected releases use a replacement protocol, with a versioned handshake or forced reload for older clients. Passing the first-deployment rollback window does not end release overlap. |

## Supported layouts and older migrations

- **Portable and development builds:** `/` as the asset base, root worker URLs,
  build-version bridge aliases, and the no-argument Personal WP PHP entry are
  supported configurations, not temporary migration code. Do not remove them
  when cleaning up support for the old root-only production layout.
- **Shared runtime discovery:** `SHARED_WORKER_NAME_COMPAT` in
  `connect-shared-runtime.ts` probes the old unversioned Personal WP worker name.
  This supports Personal WP workers whose name was `playground:<scope>` rather
  than `playground:<scope>:<version>`. Remove it only after those generations are no
  longer supported. Root worker locations remain valid for Personal WP; looking
  in a different retained release remains necessary for managed deployments.
- **Old CDN worker responses:** `PRE_SANDBOX_CDN_COMPAT` in `wordpress-bridge.ts`
  adds the app build version to `/sw.js`. This was added in [#4526](https://github.com/WordPress/wordpress-playground/pull/4526)
  for the move from app-host WordPress to `wpsandbox.wordpress.net`, before release
  directories. A cached single-origin worker routes sandbox requests incorrectly. Remove only after
  both hostnames' old worker responses are purged or expired and returning-client
  tests show the unqualified URL updates correctly.
- **Reviewed upstream document defects:** Lists of reviewed hashes per WordPress-relative path
  remain until the upstream files are fixed or removed. They are not allowances
  for older Playground clients. Matching bytes at the same path in new WordPress
  versions are accepted automatically. Multiple reviewed variants can share a path;
  other malformed bytes or paths require review.
  The fixed SVG font DTD declaration is also an
  upstream file format allowance, not a client migration. See
  `static-document-exceptions.json` and `validate-static-documents.mjs`.
