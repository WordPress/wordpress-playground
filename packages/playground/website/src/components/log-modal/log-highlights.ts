/**
 * Splits a log line into plain-text segments, marking `Error:`/`Fatal:` tokens
 * for emphasis. Returns data only — never HTML — so the caller renders each
 * segment as React text (which escapes it), preventing log content from
 * injecting markup or scripts into the Playground window.
 */
export function splitLogHighlights(
	log: string
): Array<{ text: string; highlight: boolean }> {
	const segments: Array<{ text: string; highlight: boolean }> = [];
	// Standalone severity markers only — a leading word boundary keeps it from
	// matching inside class names like `ParseError:` or words like `terror:`.
	const pattern = /(?<![\w])(Error:|Fatal:)/gi;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(log)) !== null) {
		if (match.index > lastIndex) {
			segments.push({
				text: log.slice(lastIndex, match.index),
				highlight: false,
			});
		}
		segments.push({ text: match[0], highlight: true });
		lastIndex = pattern.lastIndex;
	}
	if (lastIndex < log.length) {
		segments.push({ text: log.slice(lastIndex), highlight: false });
	}
	return segments;
}
