/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split
 * into `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 *
 * @param command
 * @returns
 */
export function splitShellCommand(command: string) {
	const MODE_UNQUOTED = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_UNQUOTED;
	let quote = '';

	const parts: string[] = [];
	let currentPart: string | null = null;
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '\\') {
			// Escaped quotes are treated as normal characters
			// This is a very naive approach to escaping, but it's good enough for
			// now. @TODO: Iterate on this later, perhaps using bun shell. @see https://github.com/WordPress/wordpress-playground/issues/1062
			if (command[i + 1] === '"' || command[i + 1] === "'") {
				i++;
			}
			currentPart = (currentPart ?? '') + command[i];
		} else if (mode === MODE_UNQUOTED) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
				currentPart ??= '';
			} else if (char.match(/\s/)) {
				if (currentPart !== null) {
					parts.push(currentPart);
				}
				currentPart = null;
			} else {
				currentPart = (currentPart ?? '') + char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === quote) {
				mode = MODE_UNQUOTED;
				quote = '';
			} else {
				currentPart = (currentPart ?? '') + char;
			}
		}
	}
	if (currentPart !== null) {
		parts.push(currentPart);
	}
	return parts;
}
