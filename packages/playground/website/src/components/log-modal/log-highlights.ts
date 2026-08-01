/**
 * Splits a log line into plain-text segments, marking `Error:`/`Fatal:` tokens
 * for emphasis. Returning data instead of HTML ensures React escapes log text.
 */
export function splitLogHighlights(
	log: string
): Array<{ text: string; highlight: boolean }> {
	const segments: Array<{ text: string; highlight: boolean }> = [];
	// Only match standalone severity markers, not names such as `ParseError:`.
	const pattern = /Error:|Fatal:/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(log)) !== null) {
		if (match.index > 0 && /\w/.test(log[match.index - 1])) {
			continue;
		}
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
