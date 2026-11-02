/**
 * Splits text into plain and highlighted segments around every
 * case-insensitive occurrence of the search term. Returning data instead of
 * HTML ensures React escapes log text.
 */
export function splitSearchHighlights(
	text: string,
	term: string
): Array<{ text: string; highlight: boolean }> {
	if (!term) {
		return [{ text, highlight: false }];
	}
	const segments: Array<{ text: string; highlight: boolean }> = [];
	const haystack = text.toLowerCase();
	const needle = term.toLowerCase();
	let lastIndex = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		if (index > lastIndex) {
			segments.push({
				text: text.slice(lastIndex, index),
				highlight: false,
			});
		}
		segments.push({
			text: text.slice(index, index + term.length),
			highlight: true,
		});
		lastIndex = index + term.length;
		index = haystack.indexOf(needle, lastIndex);
	}
	if (lastIndex < text.length) {
		segments.push({ text: text.slice(lastIndex), highlight: false });
	}
	return segments;
}
