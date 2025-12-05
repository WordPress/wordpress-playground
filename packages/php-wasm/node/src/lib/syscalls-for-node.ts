export class SyscallsForNode {
	/**
	 * Resolve a hostname to an IP address.
	 *
	 * @param hostname The hostname to resolve.
	 * @returns The IP address of the hostname as a string.
	 */
	async gethostbyname(hostname: string): Promise<string> {
		const dns = require('dns').promises;
		const { address } = await dns.lookup(hostname, {
			family: 4,
			verbatim: false,
		});
		return address;
	}
}
