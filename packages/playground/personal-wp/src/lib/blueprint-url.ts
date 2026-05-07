export function isAllowedBlueprintUrl(
	blueprintUrl: unknown
): blueprintUrl is string {
	if (typeof blueprintUrl !== 'string') {
		return false;
	}
	try {
		const url = new URL(blueprintUrl);
		return (
			url.protocol === 'https:' ||
			url.protocol === 'data:' ||
			(url.protocol === 'http:' && isLocalhost(url.hostname))
		);
	} catch {
		return false;
	}
}

function isLocalhost(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '::1' ||
		hostname === '[::1]'
	);
}
