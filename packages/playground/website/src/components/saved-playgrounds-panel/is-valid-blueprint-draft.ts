/**
 * Whether a "Write a Blueprint" draft is something we can boot a Playground
 * from. A Blueprint must be a JSON object — valid JSON that parses to a string,
 * number, boolean, null, or array would pass `JSON.parse` but crash the boot
 * resolver, so those must not enable the Create button.
 */
export function isValidBlueprintDraft(text: string): boolean {
	if (text.trim().length === 0) {
		return false;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return false;
	}
	return (
		typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
	);
}
