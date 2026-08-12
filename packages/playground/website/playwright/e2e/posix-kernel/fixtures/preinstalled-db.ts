/**
 * Shared constants for the experimental posix-kernel "install WordPress
 * once, reuse for every test" optimization.
 *
 * Three parties agree on these values:
 *   - the Playwright globalSetup (writer): boots once, drives the
 *     installer, then writes the captured SQLite database into the cache
 *     dir under `playwright/`;
 *   - the posix-kernel Vite dev server (reader): serves that file at
 *     {@link PREINSTALLED_DB_URL_PATH} via a middleware (see
 *     `vite.posix-kernel.config.ts`);
 *   - the Playwright fixtures (deliverer): stash the snapshot URL on a
 *     `window` global (see {@link PREINSTALLED_DB_GLOBAL}) that
 *     `getRemoteUrl` forwards onto each remote iframe so the kernel boot
 *     seeds the snapshot instead of re-running the CPU-heavy installer.
 *
 * The snapshot is regenerated on every `playwright test` invocation, so a
 * WordPress/PHP/SQLite version bump is picked up automatically — there is
 * no stale-fixture window to version-key against.
 *
 * This module intentionally exports only plain strings. It must NOT derive
 * its own filesystem location (via `import.meta.url` / `__dirname`): it is
 * loaded as CommonJS by Playwright (where `import.meta` throws) and inlined
 * by Vite's config bundler (where a module-location reference resolves to
 * the bundle, not the source). Each consumer that needs the on-disk path
 * builds it from its OWN `__dirname` plus the fragments below.
 */

/** Cache directory (relative to the `playwright/` dir) holding the snapshot. */
export const PREINSTALLED_DB_CACHE_DIR = '.posix-kernel-cache';

/** Filename of the captured snapshot inside {@link PREINSTALLED_DB_CACHE_DIR}. */
export const PREINSTALLED_DB_FILENAME = 'preinstalled-wordpress.db';

/**
 * Path the dev server serves the snapshot at. Kept under `/website-server/`
 * (the dev-server base) so it is same-origin with the remote iframe whose
 * worker fetches it — no CORS/COEP complications.
 */
export const PREINSTALLED_DB_URL_PATH =
	'/website-server/posix-kernel-preinstalled-wordpress.db';

/**
 * Name of the env var carrying the absolute snapshot URL from the
 * Playwright config to the test fixtures. Set only by the posix-kernel
 * config, so the fixtures stay a no-op for classic specs.
 */
export const PREINSTALLED_DB_ENV = 'PLAYWRIGHT_POSIX_KERNEL_PREINSTALLED_DB';

/**
 * `window` global the test fixtures set (via `addInitScript`) to carry the
 * snapshot URL to the website app, where `getRemoteUrl` reads it and
 * forwards it onto the remote iframe URL. Delivered as a global rather than
 * a query param because a query param on the top-page root trips the dev
 * server's catch-all proxy → 404.
 */
export const PREINSTALLED_DB_GLOBAL = '__playgroundPreinstalledDbUrl';

/*
 * ---------------------------------------------------------------------------
 * Prebuilt VFS-image snapshot.
 *
 * A strict superset of the DB snapshot above: the whole serialized VFS image
 * (WP core + static assets + SQLite drop-in + configs + the seeded installed
 * DB). The DB snapshot only lets a test skip the ~2–5 s installer POST; this
 * image lets it skip the ~27 s WP-core/static extraction AND the ~5 s VFS
 * serialization too, so a per-test boot drops from 45 s–2 min to ~20–35 s.
 *
 * The image is per-suite identical — the per-site scope is applied at request
 * time via the `x-playground-absolute-url` header, not baked into the image —
 * so globalSetup builds it once and every test boots from it. Same three
 * parties, same plumbing, same "plain strings only" rule as the DB snapshot.
 * ---------------------------------------------------------------------------
 */

/** Filename of the captured VFS image inside {@link PREINSTALLED_DB_CACHE_DIR}. */
export const PREINSTALLED_VFS_FILENAME = 'preinstalled-vfs.img';

/** Path the dev server serves the VFS image at (same `/website-server/` base). */
export const PREINSTALLED_VFS_URL_PATH =
	'/website-server/posix-kernel-preinstalled-vfs.img';

/**
 * Name of the env var carrying the absolute VFS-image URL from the Playwright
 * config to the test fixtures. Sibling of {@link PREINSTALLED_DB_ENV}.
 */
export const PREINSTALLED_VFS_ENV = 'PLAYWRIGHT_POSIX_KERNEL_PREINSTALLED_VFS';

/**
 * `window` global the test fixtures set to carry the VFS-image URL to the
 * website app. Sibling of {@link PREINSTALLED_DB_GLOBAL}.
 */
export const PREINSTALLED_VFS_GLOBAL = '__playgroundPrebuiltVfsImageUrl';
