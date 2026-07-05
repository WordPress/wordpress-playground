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
	// Standalone severity markers only — the prefix keeps it from matching
	// inside class names like `ParseError:` or words like `terror:`. Avoid
	// regular-expression lookbehind here; older WebKit builds still reject it at
	// parse time, which would break the Logs pane before it renders.
	const pattern = /(^|[^\w])(Error:|Fatal:)/gi;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(log)) !== null) {
		const markerStart = match.index + match[1].length;
		if (markerStart > lastIndex) {
			segments.push({
				text: log.slice(lastIndex, markerStart),
				highlight: false,
			});
		}
		segments.push({ text: match[2], highlight: true });
		lastIndex = markerStart + match[2].length;
	}
	if (lastIndex < log.length) {
		segments.push({ text: log.slice(lastIndex), highlight: false });
	}
	return segments;
}
