import { validateOrigin } from './validate-origin';

// Origins added at runtime via `addRemoteOrigin`. Kept separate from the
// build-time `additionalRemoteOrigins` array (see `additional-remote-origins.ts`)
// because the vite plugin in this package's `vite.config.ts` rewrites the
// source of that file when `ADDITIONAL_REMOTE_ORIGINS` is set, and would
// otherwise clobber any runtime registrations colocated with it.
const runtimeRemoteOrigins: string[] = [];

/**
 * Returns the origins registered at runtime via {@link addRemoteOrigin}.
 *
 * @internal — exposed for use by the assertion in `index.ts` and by tests.
 *  Not part of the public package API.
 */
export function getRuntimeRemoteOrigins(): readonly string[] {
	return runtimeRemoteOrigins;
}

/**
 * Register an additional origin that is a valid host for Playground's
 * `remote.html` iframe.
 *
 * Use this when embedding Playground from an origin that isn't part of
 * the built-in allowlist (`playground.wordpress.net`, `wasm.wordpress.net`,
 * the embedding page's own origin, or `localhost`/`127.0.0.1` on the
 * default dev port). Call this before the `startPlaygroundWeb()`
 * invocation that should see the new origin. Multiple calls accumulate:
 * each call appends an entry, and duplicate origins are preserved (they
 * are not deduplicated or treated as a no-op).
 *
 * The origin must be in canonical form: an `http://` or `https://` scheme,
 * a lowercase ASCII (or punycode) host, an optional non-default port, and
 * nothing else. No userinfo, path, query, fragment, or trailing slash.
 * Invalid input throws and the registration is rejected.
 *
 * @example
 *   import { addRemoteOrigin, startPlaygroundWeb } from '@wp-playground/client';
 *
 *   addRemoteOrigin('https://playground.example.com');
 *   await startPlaygroundWeb({ ... });
 */
export function addRemoteOrigin(origin: string): void {
	validateOrigin(origin);
	runtimeRemoteOrigins.push(origin);
}
