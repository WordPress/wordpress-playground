# Clone a live WordPress site

Open **New Playground → Clone a live site**. Enter the live URL. The panel links
to the site's plugin upload page and the pinned Reprint Server zip when setup
is needed. When Reprint answers, open its settings page, copy the connection
token, and submit it. The source site stays unchanged.

## Import

The clone boots a new temporary Playground with PHP 8.3 and networking enabled.
The current Playground stays unchanged while collecting the URL and key.
Reprint writes core and content files directly into the new site directory.
There is no site archive, extraction, or second copy of ordinary files.

Preflight maps active content, plugin, MU plugin, and upload directories into
Playground's `wp-content` layout. Bundled copies use separate paths under
`.reprint-source-files`. Canonical indexed link targets become ordinary local
files because OPFS cannot store symlinks. Runtime configuration, SQLite,
Playground MU plugins, and connection metadata stay outside mirror writes and
deletions. Paths inside today's mirror scope match today's remote index;
remote-absent local paths there are removed.

SQL is applied to a separate SQLite file, then installed at the path selected
by the local SQLite driver. Reprint rewrites stored URLs. The local config keeps
the source table prefix and enables error logging without displaying errors.
The clone signs in as the first existing administrator, verifies the cookie,
and removes its temporary login endpoint even on failure. A missing theme or
blank homepage produces a warning without discarding the completed import.

The imported username is kept for auto-login after reopening. The completed
clone is autosaved in the background. The address bar reports that save.
The initial UI offers cloning only: no push or refresh-pull action.

## Size and progress

The limit is 2 GiB (2,147,483,648 bytes) of selected files plus the SQL dump.
The full mapped file index is checked before mirror deletions or downloads,
including retries past indexing. Excluded paths do not count. SQL has no known
dump size up front, so written SQL bytes are checked as each chunk arrives.
This limits import data, not total memory or storage use. SQLite and runtime
files need additional space. Use the Reprint CLI for larger sites.

The overall bar estimates work across files, SQL download, SQL import,
configuration, and login. File counters measure written bytes, including partial
files. SQL download reports actual bytes and table counters without a guessed
byte denominator. SQL import reports exact dump offsets and statement counts.
Unknown totals hold the bar at the phase boundary. Only completion reaches 100%.

## Keys and retries

The PHAR is pinned to v0.10.13 and verified against its SHA-256 digest before
execution. The saved connection contains the URL only. The key is passed to PHP
through its process environment, not written into generated scripts or exports.
The panel remembers it in tab-scoped session storage beside its live-site URL.
Changing the live URL does not reuse the old key.

Keep the tab open. Failed stages retain their in-memory Reprint checkpoints.
**Try resuming** reuses the key and downloaded bytes; local link setup can resume
without downloading again. **Stop** waits for the current PHP stage to return.
Reloading or crashing discards an unfinished temporary clone. No partial clone
is saved to browser storage. Files change in place, so an interrupted pull is
not an atomic replacement and must be resumed or restarted.

The header menu provides a transfer log. Reads have a ten-second deadline and
return any records received before a stalled worker. Tokens are redacted before
log tails are copied. Downloaded site data can still contain passwords, personal
data, and plugin secrets. Clean it before sharing a public Playground.

## Checks

The JavaScript tests cover probing, URL identity, verified PHAR replacement,
streamed progress, login, and setup races. CI also downloads the same verified
PHAR and runs `bridge-test.php` with native PHP. Those checks use Reprint's real
mapper, writer, size checks, and stage checkpoints.

`playwright/reprint-site/serve.sh` provisions a disposable WordPress site on
SQLite with Reprint Server. The dedicated `reprint-import` CI lane clones it
through the UI, checks files and rewritten database values, verifies admin
login, and reloads the saved clone. The source uses generated thumbnails,
non-ASCII paths, escaped shortcode URLs, serialized values, and a custom table.
Reprint's own tests cover MySQL sources; this fixture covers Playground.
