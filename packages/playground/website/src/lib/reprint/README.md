# Reprint transfer preview

Open **Dev Tools → Push / Pull** in a browser-stored Playground with networking
enabled and PHP 8.1 or newer. Enter the live site URL and choose **Check site**.
If Reprint is not detected, the panel provides the v0.10.10 zip and a direct link
to that site's plugin upload screen. Install and activate it, then check again.
For an existing setup, open the linked **Tools → Reprint Server** page and copy
its connection token. A fresh install needs a key: generate one in Playground,
copy it to that settings page, save it, and confirm that it was saved.
Transfer controls appear after entering a key, or reuse the key remembered in
this browser tab. Each step focuses its input; a compact step trail keeps the
completed choices visible without retaining the old forms. Transfer buttons
include their overwrite warnings and start directly, without another modal.
Enable Reprint's push
permission on the live site when needed.

Detection uses an unauthenticated request, not the supplied key. A blocked or
unexpected reply does not prove that the plugin is missing; users can continue
with an existing key. The installer link can be changed to the official plugin's
wp-admin listing when its WordPress.org slug is available.
The client PHAR is pinned to v0.10.10 and checked against its SHA-256 digest.
A cached older client is replaced by a verified download on the next transfer;
connection keys are retained.

## What changes

- **Pull full site** writes source files directly into the Playground directory.
  Reprint mirrors the selected paths, imports SQL into a separate SQLite file,
  and applies database URL rewriting. Once SQL import succeeds, the local
  database is replaced. There is no site ZIP creation or extraction.
  Production is not changed.
  Source server configuration and database/cache drop-ins are replaced with the
  Playground runtime. Reprint excludes known host-specific plugins.
- **Push files** sends only `wp-content/plugins`, `wp-content/themes`, and
  `wp-content/uploads`. It never sends database rows, core, `wp-config.php`, or
  MU plugins. Posts, settings, theme activation, and editor-saved templates do
  not get published. URLs embedded in files are sent as-is.
- A new Playground can push without first pulling. Its first push sends all
  selected local files, but does not remove remote-only paths.
- After a pull or push, the next push sends local additions, edits, and deletions
  against that saved copy. It does not merge remote changes. Replacing or
  deleting a remote path can discard later production edits. Deleting a
  directory can also remove files added there on production.

Back up the destination first. This is an experimental transfer tool, not a
production deployment system with rollback or conflict review. Use a disposable
site for initial testing. Pull uses Reprint's reported WordPress paths and maps
content, plugins, MU plugins, and uploads into the local `wp-content` layout.
Preflight resolves these mappings before mirroring. If core also contains a
bundled `wp-content` while the active content lives elsewhere, the bundled
copy is kept under `.reprint-source-files/<remote-path>`, not mapped over the
active content. The same rule covers detached plugins and uploads, including
content nested inside a bundled directory. Older interrupted file plans are
rebuilt automatically so Retry does not repeat the old mapping collision.
There is no up-front rejection based on directory layout or multisite status.
This does not establish that every multisite network will run unchanged locally;
the generated Playground configuration is still a single-site configuration.
Push maps local content files back to the live site's reported directories.
Reprint v0.10.10's push API only writes beneath its document root; a source with
content outside that root can still be pulled. Pull follows remote symbolic links, as the CLI does. Linked content becomes
normal files before saving because OPFS cannot store symbolic links. The adapter
uses the canonical targets from Reprint’s index, rather than relative links
through host-specific aliases. File download and local link setup are separate
stages: a setup failure resumes setup without downloading again. Push
snapshots read links only within transferred content; directory loops report
an error instead of recursing forever.
The destination must already run WordPress and Reprint Server.

## Saved state and retries

A clone downloads into a temporary Playground and nothing is written to
browser storage until the pull completes; the site is then autosaved in the
background while it is already usable. Reprint's working state stays in `/tmp`
for the session, so a failed batch or stage can be retried in place, but a
reload or crash discards the unfinished pull. The
connection setting contains only the URL. The supplied token is passed through
the PHP process environment, not saved in the setting or generated PHP code.
The panel remembers the key in tab-scoped session storage, tied to the
Playground and live URL. It survives panel changes, transfers, retries, and
reloads in that tab, but is not included in site exports. A different live URL
does not reuse that key.
The downloaded site itself can contain passwords, personal data, and plugin
secrets. Do not share it as a public Playground without cleaning it first.

Keep the tab open. After an error, use Retry to resume the same direction
with the retained key. Go back to the key step if the key itself needs changing. After reopening, an unfinished stage can run again
from the start. Do not edit files during a transfer. Reprint push
uses a fixed snapshot, so edits made after staging need another push. Reprint
may restart its upload plan after reopening a saved Playground. A completed
pull logs in as the first existing administrator and opens the dashboard. It
does not change passwords or create an account. A temporary, randomly named
local login script is removed after the session cookie is verified, including
on failure. The imported administrator’s username is saved for Playground’s
auto-login after reopening. Reload Playground if needed to boot the imported
WordPress version.

Files change in place during pull; replacement is not atomic. Paths inside the
current mirror selection match the remote index, including removing local
files absent from that index. Local runtime, config, database, and connection
paths are excluded, including `wp-runtime.json` and `blueprint-bundle`, which
identify and reopen the saved Playground. An interrupted pull must be retried. There is
no cancel/reset UI yet. A tab crash during browser-storage writes may require
starting over in a new Playground. Very large sites need enough browser memory
and storage for the site, SQL, SQLite database, and push snapshot.

The pull bar covers the whole operation: files, SQL download, SQL import,
local configuration, administrator login, and saving. Phase
weights estimate the work, not elapsed time, and the UI labels the overall
percentage as an estimate. Within each phase it uses measured progress: selected
file bytes and applied SQL offsets. SQL download shows written bytes without a
denominator: remote table sizes do not measure SQL dump size. SQL import has
an exact dump size and shows a separate measured bar alongside overall
progress. The PHP worker yields briefly between SQL progress updates so they
reach the page before import finishes. Unknown totals hold the bar at
the phase boundary rather than advancing on a timer. Within a running transfer,
resumed batches never move the bar backward. Only a successful
final storage flush reaches 100%.

The generated local WordPress config enables error logging without displaying
errors in HTML. After login, a homepage request checks for HTTP errors or an
empty response. Theme caches and source theme-root options are cleared, and
the active theme is checked without switching to a different theme. Missing
themes produce their actual WordPress error in the panel and Logs, even when
the homepage returns nonempty HTML. These warnings do not discard a
successful import. A page containing HTML but rendered blank by CSS or a theme
still needs inspection. Replacing or truncating `debug.log` during an import no
longer leaves the log reader waiting for the old file length to be exceeded.

## Checks

### Download performance

PHP's `select()` yields to JavaScript between socket reads. Emscripten's
zero-delay timer used to add a browser timer delay on each yield. The browser
loaders now use `scheduler.postTask()` for zero-delay sleeps, while preserving
timed sleeps and the timer fallback when that API is unavailable. This changes
the JavaScript loader only; the WASM binaries are unchanged.

Chrome / PHP 8.3 measurements on 2026-09-23, using curl's default receive buffer:

| Download                                       | Before |   After | Browser fetch |
| ---------------------------------------------- | -----: | ------: | ------------: |
| Local HTTP, 16 MiB                             | 10.9 s | 0.036 s |       0.119 s |
| WordPress 6.8 zip over HTTPS, 28,551,129 bytes | 44.8 s |  1.45 s |       0.777 s |

The before/after columns use the Playground worker. Browser fetch uses the same
CORS proxy for HTTPS. An Asyncify runtime also downloaded the HTTPS file in
1.24 s. Downloading it into a PHP file took 1.38 s and matched the native curl
SHA-256. These are download benchmarks, not full-site import times; file
processing and database import still add work.

Run `npm exec -- nx test php-wasm-compile` for scheduling checks against the
compiler source and every checked-in browser loader. For a manual speed check,
time PHP curl downloading a fixed-size local response and the public WordPress
zip into `/tmp`, then compare against browser fetch and native curl. Use a fresh
Playground runtime after changing the loader. Check both JSPI and Asyncify, and
verify that `usleep(125000)` still waits at least 125 ms.

### Transfer behavior

Run the website `reprint.spec.ts` tests through Nx. They cover URL validation,
the PHAR digest, token redaction, and the import/persist/baseline sequence.

For the PHP adapter, put the pinned release at `/tmp/playground-reprint.phar`
and run `php packages/playground/website/src/lib/reprint/bridge-test.php` from
the repository root. This uses Reprint's real planner to check first push,
unchanged files after timestamp changes, same-size edits, deletions, and scope.

For an end-to-end check, use a disposable WordPress site with Reprint Server:

1. Create a source post containing an HTML link and image with absolute URLs,
   and a file in uploads. Reprint rewrites URL attributes; a URL written as
   ordinary prose in a post can stay unchanged.
2. Pull from the panel, reload the saved Playground, and check the post, URL,
   and file. Use a source table prefix other than `wp_`.
3. Change a local upload, add another, and delete a previously pulled file.
   Change an unrelated production file after the pull.
4. Push and check the expected file changes. The unrelated production edit,
   production post content, core, configuration, and database must remain.
5. Repeat after reloading Playground. Then push from a fresh Playground which
   has never pulled; remote-only files must not be removed.
