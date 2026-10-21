/** Reads a handoff URL from plain text, including Spacefast's copied setup prompt. */
export function extractSpacefastHandoffUrl(text: string): string | undefined {
	const candidates = text.match(/https?:\/\/[^\s<>"'`]+/g) || [];
	for (const candidate of candidates) {
		try {
			const url = new URL(candidate.replace(/[.,;:!?)\]}]+$/, ''));
			if (
				['https://api.spacefast.com', 'https://spacefast.com'].includes(
					url.origin
				) &&
				// Match Spacefast's published BROWSER_HANDOFF_TOKEN_PATTERN.
				/^\/handoffs\/[A-Za-z0-9_-]{16,512}$/.test(url.pathname) &&
				!url.search &&
				!url.hash &&
				!url.username &&
				!url.password
			) {
				return url.href;
			}
		} catch {
			// Ignore unrelated or malformed URLs in the surrounding prompt.
		}
	}
	return undefined;
}
