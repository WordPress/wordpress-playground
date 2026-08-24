/**
 * `fetch` that rides out the cold-worker gateway race in posix-kernel tests.
 *
 * The kernel-built nginx starts accepting connections before an FPM worker is
 * warm, and under the suite's parallel kernels a freshly-booted server can
 * return a transient 502/503/504 on the first request(s) until a worker comes
 * up. Production already retries these in `prepare-wordpress`'s
 * `requestAwaitingReadiness`; tests that assert the steady-state 200 do the
 * same instead of asserting against the readiness race.
 */
const TRANSIENT_GATEWAY_STATUSES = new Set([502, 503, 504]);

export async function fetchWhenReady(
	input: URL | string,
	init?: RequestInit,
	{
		attempts = 10,
		backoffMs = 300,
	}: { attempts?: number; backoffMs?: number } = {}
): Promise<Response> {
	let response = await fetch(input, init);
	for (
		let attempt = 1;
		attempt < attempts && TRANSIENT_GATEWAY_STATUSES.has(response.status);
		attempt++
	) {
		await new Promise((resolve) => setTimeout(resolve, backoffMs));
		response = await fetch(input, init);
	}
	return response;
}
