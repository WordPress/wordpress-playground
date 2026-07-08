/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split
 * into `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 * Also preserves empty quoted arguments, which sendmail uses for values such
 * as `-f ""`.
 *
 * @param command
 * @returns
 */
export function splitShellCommand(command: string) {
	const MODE_UNQUOTED = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_UNQUOTED;
	let quote: '"' | "'" | undefined;

	const parts: string[] = [];
	// `null` means no argument is active. `''` means an active empty argument,
	// which preserves quoted values such as `sendmail -f "" -t`.
	let currentPart: string | null = null;

	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '\\') {
			// Escaped quotes are treated as normal characters.
			// This is a very naive approach to escaping, but it's good enough for
			// now. @TODO: Iterate on this later, perhaps using bun shell.
			// @see https://github.com/WordPress/wordpress-playground/issues/1062
			if (command[i + 1] === '"' || command[i + 1] === "'") {
				i++;
			}
			currentPart = (currentPart ?? '') + command[i];
		} else if (mode === MODE_UNQUOTED) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
				// Starting a quote opens an argument even if the quote is empty.
				currentPart ??= '';
			} else if (/\s/.test(char)) {
				// Whitespace only ends an active argument. Repeated whitespace
				// outside quotes is ignored.
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
				quote = undefined;
				// Keep the current argument open after a closing quote. The next
				// unquoted or quoted segment may continue the same shell argument,
				// e.g. `php -r 'require '\''vendor/autoload.php'\''`.
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
