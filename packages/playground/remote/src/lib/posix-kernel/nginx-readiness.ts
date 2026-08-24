import type { HttpRequest, HttpResponse } from './host-bridge';

export async function waitForNginx(
	send: (request: HttpRequest) => Promise<HttpResponse>,
	timeoutMs: number,
	intervalMs = 100
): Promise<void> {
	// dinit's `depends-on = php-fpm` only blocks until the php-fpm
	// process has exec'd, not until it has bound 127.0.0.1:9000. nginx
	// therefore starts (and answers) before its fastcgi upstream is
	// reachable, so every request returns 502 with the nginx body
	// `connect() to 127.0.0.1:9000 failed (111: Connection refused)`.
	// `ensureWordPressInstalled` would then read that 502 as
	// `installRequired=false` and skip the install. Retry while the
	// status indicates a transient upstream failure (502/503/504).
	// Any other status means nginx → fpm → PHP finished a request, so
	// the server stack is up and the caller can proceed (a 500 is a
	// real PHP error and shouldn't be silently retried).
	const deadline = Date.now() + timeoutMs;
	let lastStatus: number | undefined;
	let lastError: unknown;
	const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);
	while (Date.now() < deadline) {
		try {
			const response = await send({
				method: 'GET',
				url: '/',
				headers: {},
				body: null,
			});
			if (response && typeof response.status === 'number') {
				lastStatus = response.status;
				if (!TRANSIENT_UPSTREAM_STATUSES.has(response.status)) {
					return;
				}
			}
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	const reason =
		lastStatus !== undefined
			? `last status was ${lastStatus} (php-fpm upstream still down)`
			: lastError
				? `last error: ${String(lastError)}`
				: 'no response from nginx';
	throw new Error(
		`[posix-kernel] nginx did not become ready within ${timeoutMs}ms; ${reason}`
	);
}
