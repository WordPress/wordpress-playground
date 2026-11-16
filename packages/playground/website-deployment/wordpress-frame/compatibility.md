# Compatibility removal checklist

Updated as of **2026-11-16**, for PR #4613. Search for the code markers below before
removing an allowance. These describe different transitions; "legacy" alone is
not a removal condition.

## Temporary support for the layout before this PR

| Code marker                     | Allowance and locations                                                                                                                                                                                                                                                                                                   | Remove when                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRE_RELEASE_ASSETS_COMPAT`     | A PHP runtime can omit `releaseBase` and report `wp-6.8` instead of `releases/<id>/wp-6.8`. `remote/src/lib/wordpress-static-assets.ts` and `remote/service-worker.ts` then use the app-host alias and CORS. `custom-redirects-lib.php` supplies headers for those aliases. Covered by `wordpress-static-assets.spec.ts`. | Pre-PR runtimes are no longer supported, including already-open tabs, and rollback to those builds is no longer required. Force old tabs to reload before dropping their support. Preserve explicit `releaseBase: '/'` for portable builds. |
| `PRE_RELEASE_HELPER_URL_COMPAT` | `custom-redirects-lib.php` accepts `/wordpress-bridge.html` and `/wordpress-bridge-<buildVersion>.html` for pre-PR clients. Managed releases now use `/releases/<id>/wordpress-bridge.html`. Covered by router and helper-upgrade tests.                                                                                  | No supported client or rollback build requests these production aliases. Keep helper aliases on development and portable hosts that still generate them.                                                                                    |
| `PRE_RELEASE_ROOT_COMPAT`       | `apply-update.php` accepts a missing root `release.json`, snapshots the old entry files, and can restore the PHP-served layout. Covered by installer tests and the staging rollback rehearsal.                                                                                                                            | Every managed site has migrated and the first-deployment rollback window is closed. A fresh installation still needs to work without an existing manifest.                                                                                  |
| `UNTRACKED_RELEASE_COMPAT`      | The installer skips old directories that have no lifecycle metadata instead of guessing their age or deleting a rollback target.                                                                                                                                                                                          | An operator has audited and removed all such directories and their unused backups. Keep any files still needed for rollback until that rollback window closes.                                                                              |

Closing the rollback window alone is insufficient for browser compatibility:
old tabs may remain open or return after being offline. The 30-day retention
window does not apply to those pre-PR tabs, which have no managed release ID.

## Compatibility that continues across future releases

| Code marker                      | Allowance and locations                                                                                                                                                                        | Remove when                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RELEASE_HELPER_PROTOCOL_COMPAT` | A helper iframe from retained release A can talk to worker B. Message fields and response-body ports stay compatible; a frozen v1 helper tests this. See `remote/src/lib/wordpress-bridge.ts`. | All supported and protected releases use a replacement protocol, with a versioned handshake or forced reload for older clients. Passing the first-deployment rollback window does not end release overlap. |

## Existing support that this PR preserves

- **Portable and development builds:** `/` as the asset base, root worker URLs,
  build-version helper aliases, and the no-argument Personal WP PHP entry are
  supported configurations, not temporary migration code. Do not remove them
  when cleaning up pre-PR production support.
- **Shared runtime discovery:** `SHARED_WORKER_NAME_COMPAT` in
  `connect-shared-runtime.ts` probes the old unversioned Personal WP worker name.
  This predates the PR. Remove it only after those worker generations are no
  longer supported. Root worker locations remain valid for Personal WP; looking
  in a different retained release remains necessary for managed deployments.
- **Old CDN worker responses:** `PRE_SANDBOX_CDN_COMPAT` in `wordpress-bridge.ts`
  adds the app build version to `/sw.js`. This predates the PR. Remove only after
  both hostnames' old worker responses are purged or expired and returning-client
  tests show the unqualified URL updates correctly.
- **Reviewed upstream document defects:** exact path/hash scanner exceptions
  remain until the upstream files are fixed or removed. They are not allowances
  for older Playground clients. The fixed SVG font DTD declaration is also an
  upstream file format allowance, not a client migration. See
  `static-document-exceptions.json` and `validate-static-documents.mjs`.
