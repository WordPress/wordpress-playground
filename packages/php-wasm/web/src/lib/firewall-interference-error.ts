/**
 * Error thrown when a CORS proxy response appears to have been
 * intercepted by a network firewall or corporate proxy.
 *
 * This is detected when a response from the CORS proxy is missing
 * the X-Playground-Cors-Proxy header that legitimate responses include.
 */
export class FirewallInterferenceError extends Error {
	public readonly url: string;
	public readonly status: number;
	public readonly statusText: string;

	constructor(url: string, status: number, statusText: string) {
		super(
			`Response from ${url} appears intercepted by network firewall (HTTP ${status})`
		);
		this.name = 'FirewallInterferenceError';
		this.url = url;
		this.status = status;
		this.statusText = statusText;
	}
}
