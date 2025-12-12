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
			`Could not fetch ${url} – your network appears to be blocking this request (HTTP ${status}). ` +
				`This often happens on school, university, or corporate networks. ` +
				`Try switching to a different network, using a VPN, or asking your IT administrator to allow requests to playground.wordpress.net.`
		);
		this.name = 'FirewallInterferenceError';
		this.url = url;
		this.status = status;
		this.statusText = statusText;
	}
}
