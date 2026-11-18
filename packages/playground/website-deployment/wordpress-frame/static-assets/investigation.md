# November 18 bridge compatibility investigation

This change is independent of startup PR [#4632](https://github.com/WordPress/wordpress-playground/pull/4632).
No production deployment or restoration was performed.

## Live observations

Read-only requests on November 18, 2026, at approximately 21:51–22:10 UTC:

| Request                                                                                                                                    | Observed response                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [Obsolete root bridge script](https://playground.wordpress.net/wordpress-bridge-Cmo7aZBy.js)                                               | 404, `text/html`, no `Access-Control-Allow-Origin`                                           |
| [Sandbox bridge document](https://wpsandbox.wordpress.net/wordpress-bridge.html)                                                           | 200; references `/releases/20261118-174939-6ae629de715f/assets/wordpress-bridge-brpI_Ye9.js` |
| [Current bridge loader module](https://playground.wordpress.net/releases/20261118-174939-6ae629de715f/assets/wordpress-bridge-brpI_Ye9.js) | 200, `application/javascript`, `Access-Control-Allow-Origin: *`                              |
| `/sw.js` on both production hosts                                                                                                          | 200, `application/javascript`; imports `/releases/20261118-174939-6ae629de715f/sw.js`        |
| `/sw.js?build-version=ada3b06ce0d85550b55ef3d818460a806ca4f220` on both hosts                                                              | 200, same loader bytes as unqualified URL                                                    |
| The imported release worker on both hosts                                                                                                  | 200, `application/javascript`, matching SHA-256 between hosts                                |

The root worker responses had long cache lifetimes: `max-age=31536000`
unqualified, and `max-age=315360000` for the old build query. CDN cache policy
should be investigated separately. Successful HTTP responses do not establish that
Chrome can start or update the worker in the reporter's profile.

[Chromium's status mapping](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/common/service_worker/service_worker_status_code.cc)
associates the reported wording with `kErrorStartWorkerFailed`. Network, security,
script-evaluation, and disk-cache failures have separate status strings. The
reported wording alone does not identify a missing resource or a specific cause.

Chromium maps this wording to its generic `kErrorStartWorkerFailed` status, with
separate statuses for network and script-evaluation failures in its
[status-code implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/common/service_worker/service_worker_status_code.cc).
The wording alone does not identify the failing resource or underlying cause.

These are independent observations from this investigation, not the reporter's
Network trace. Their request could have received a different 404, challenge, 403,
or another response. A missing CORS header can mask a missing resource; it does not
prove that their exact request returned 404.

## Source of the obsolete URL

The trusted November 10 artifact contains both the exact obsolete bridge module
and the service worker that generates HTML referencing it. Its worker bundles
`/wordpress-bridge-Cmo7aZBy.js` and answers its own
`/wordpress-bridge-ada3b06ce0d85550b55ef3d818460a806ca4f220.html` alias with a
module script on the app host. The app document chooses the bridge HTML alias;
the installed sandbox worker chooses the obsolete script URL. The old network
bridge document also has a loader module leading to that same script.

After the actual installer switches to release directories, the local artifact
rehearsal observes the obsolete URL in the browser's generated bridge HTML while a
direct HTTP request returns the current bridge. Chromium also reports
`fromServiceWorker() === true`; the installed Firefox BiDi transport reports that
flag as false, so the portable assertion compares the two document bodies. With
cold caches, the original script then fails to load until restored. A warm HTTP cache can already supply the original module despite its missing server URL.
The currently served network bridge document points to a retained release path,
so fetching only that network document cannot diagnose an installed old worker.

The old `connect-wordpress-origin.ts` timeout says “WordPress request transport did
not start.” Current code says “WordPress bridge did not start.” This supports an
older-code hypothesis; it does not identify the reporter's exact worker version.

The `7.1`/`latest` warning comes from a literal comparison of requested and loaded
WordPress versions in `playground-worker-endpoint.ts`. It does not explain the
bridge script failure.

## Validation and limits

See [the restoration guide](README.md) for the immutable file inventory, exact
operator command, artifact rehearsal commands, and broader follow-up plan.

Local validation on November 18, 2026:

- Six actual old-app transition cases passed without retries: cold and warm caches
  in Chromium, installed Firefox 160, and WebKit. Each checks worker-generated
  bridge HTML, real WordPress transport, restored bytes/MIME/CORS on both hosts,
  deferred module loading, another deployment, and rollback both to the first
  managed release and to the historical private layout.
- All six existing bridge-upgrade/protocol cases passed across the same engines.
- The two-origin preview build, default installer/HTTP contracts (including shipped
  assets, collisions, path/link restrictions, retention and rollback), website lint,
  and website type checks passed. PHP and shell syntax checks passed.

The bundled Firefox timed out before launching on this Mac. Firefox validation
used the existing staging channel override, `moz-firefox`, with installed Firefox 160. This local launch issue is independent of the deployment failure.

The tests deliberately publish an invalid worker script to exercise an update
failure while an old worker remains installed. This is a simulated fault, separate
from the naturally missing script in the reproduced deployment transition. The
Chrome “ServiceWorker cannot be started” condition has not been independently
reproduced without fault injection. Investigating it needs the affected Chrome
version, registration/worker console diagnostics, and the actual worker/module
Network responses from that browser.

The restoration is limited to this reviewed bridge dependency graph. It does not
provide complete retention of every pre-migration application's deferred assets,
automatic recovery for an already-timed-out app, or recovery after managed-release
expiry. The browser rehearsal retries the hidden iframe while preserving the old
app document. It never clears saved-site storage.

Historical server `.playground-releases` and `website-backups` availability was not
verified. The exact assets are recovered and included from the trusted deployment
artifact, so an operator need not assume those backups still exist.
