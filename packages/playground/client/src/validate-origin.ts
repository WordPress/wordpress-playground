/**
 * Assert that a string is a canonical origin: an `http://` or `https://`
 * scheme followed by a host (with an optional non-default port) and
 * nothing else — no userinfo, no path, no query, no fragment.
 *
 * Used by both the build-time `ADDITIONAL_REMOTE_ORIGINS` env-var seam
 * (see `vite.config.ts`) and the runtime `addRemoteOrigin` API
 * (see `runtime-remote-origins.ts`) so the two paths stay in lockstep.
 *
 * @throws if the input is not a canonical origin. The thrown message
 *  includes a short reason so build-time misconfigurations are easy to
 *  diagnose from a CI log.
 *
 * @internal
 */
export function validateOrigin(origin: string): void {
	let url: URL;
	try {
		url = new URL(origin);
	} catch {
		throw invalidOriginError(origin, 'not a valid URL');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw invalidOriginError(origin, 'must use http:// or https://');
	}
	if (url.username !== '' || url.password !== '') {
		throw invalidOriginError(
			origin,
			'must not include username or password'
		);
	}
	// Round-trip check rejects any input that the URL parser had to
	// normalize: paths, queries, fragments, trailing slashes, uppercase
	// schemes, and ports that match the scheme's default.
	if (url.href !== `${origin}/`) {
		throw invalidOriginError(
			origin,
			'must be a canonical http(s) origin with no path, query, fragment, trailing slash, or default port'
		);
	}
}

function invalidOriginError(origin: string, reason: string): Error {
	return new Error(`Invalid origin: '${origin}' (${reason})`);
}
