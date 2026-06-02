/**
 * Per-playground HTTP cookie store, shared between the SW-driven
 * `KernelPlaygroundWorkerEndpoint.requestStreamed` flow (iframe
 * navigations) and `KernelLimitedPHPApi.request` (blueprint
 * `playground.request(...)` calls).
 *
 * Cookies normally ride a real network response's `Set-Cookie` header
 * into Chrome's cookie jar. The kernel-mode flow returns a *synthetic*
 * `Response` from a service worker, and Chrome's "response" headers
 * guard silently drops `Set-Cookie` from synthetic responses (it is a
 * forbidden response-header name; see
 * https://fetch.spec.whatwg.org/#forbidden-response-header-name).
 * `Headers.append('set-cookie', …)` after construction is also a no-op
 * under the same guard, and the pair-list `HeadersInit` shape goes
 * through the same "fill" path. Empirically verified with a worktree
 * diag (2026-05-20): `inCount: 4` of WP-emitted cookies on a 302
 * redirect arrive at the SW, but `redirectResponse.headers.has
 * ('set-cookie')` reads `false` after both the post-construction
 * `append` path and the pair-list init path.
 *
 * Workaround: keep the cookie state inside the worker. Inject the
 * jar's serialized `Cookie:` header onto every outbound request, ingest
 * `Set-Cookie` off every inbound response, and strip `Set-Cookie` from
 * the response we hand back to the SW. The browser never sees a cookie
 * header, and PHP sees a coherent `$_COOKIE` superglobal across the
 * iframe's redirect chain.
 */

export class CookieJar {
	private readonly entries = new Map<string, string>();

	/**
	 * Render the jar as an HTTP `Cookie:` header value. Returns the
	 * empty string when the jar is empty so callers can skip injection
	 * cleanly.
	 */
	serialize(): string {
		if (this.entries.size === 0) {
			return '';
		}
		return Array.from(this.entries.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	/**
	 * Ingest one raw `Set-Cookie` header value (everything after
	 * `Set-Cookie:` on the wire). Honors `Max-Age <= 0` and a past
	 * `Expires=` as a delete; everything else is treated as an
	 * upsert. Path / Domain / Secure / SameSite / HttpOnly attrs are
	 * intentionally ignored — the jar serves a single playground
	 * instance, so per-attr scoping isn't load-bearing.
	 */
	ingest(raw: string): void {
		const segments = raw.split(';');
		const first = segments[0]?.trim();
		if (!first) {
			return;
		}
		const eq = first.indexOf('=');
		if (eq === -1) {
			return;
		}
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		const isExpired = segments.slice(1).some((seg) => {
			const trimmed = seg.trim().toLowerCase();
			if (trimmed.startsWith('max-age=')) {
				const n = Number(trimmed.slice('max-age='.length));
				return Number.isFinite(n) && n <= 0;
			}
			if (trimmed.startsWith('expires=')) {
				const d = Date.parse(trimmed.slice('expires='.length));
				return Number.isFinite(d) && d <= Date.now();
			}
			return false;
		});
		if (isExpired) {
			this.entries.delete(name);
		} else {
			this.entries.set(name, value);
		}
	}

	/**
	 * Ingest the bridge's `Set-Cookie` field. The HttpBridgeHost folds
	 * repeated `Set-Cookie` headers into a single comma-joined string;
	 * {@link splitSetCookieHeader} re-separates them before each is
	 * fed through {@link ingest}. The kernel-mode worker endpoint also
	 * passes through values that arrived `\n`-joined (the alternate
	 * joiner the bridge uses in some paths) — both shapes are tried.
	 */
	ingestAll(headerValue: string | undefined): string[] {
		const split = splitSetCookieHeader(headerValue);
		for (const raw of split) {
			this.ingest(raw);
		}
		return split;
	}
}

/**
 * Split a comma-joined `Set-Cookie` header value back into individual
 * cookies. Matches the regex Node 24's `Headers.getSetCookie()` uses:
 * a comma is a separator only when followed by a fresh token-pair name
 * (RFC 7230 tchar) and `=`. Plain commas inside `Expires=Wed, 21 Oct
 * 2015 …` are NOT separators because no `=` follows the date token.
 *
 * Also handles the `\n`-joined shape some bridge paths produce: split
 * on `\n` first, then on the safe-comma regex inside each segment, so
 * we never lose individual cookies regardless of joiner.
 */
function splitSetCookieHeader(value: string | undefined): string[] {
	if (!value) {
		return [];
	}
	const out: string[] = [];
	for (const part of value.split('\n')) {
		if (!part) continue;
		for (const c of part.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/)) {
			const trimmed = c.trim();
			if (trimmed.length > 0) {
				out.push(trimmed);
			}
		}
	}
	return out;
}
