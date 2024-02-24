/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split into
 * `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 *
 * @param command
 * @returns
 */
export function splitShellCommand(command: string) {
	const MODE_NORMAL = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_NORMAL;
	let quote = '';

	const parts: string[] = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '\\') {
			// @TODO more reliable parsing, this is vary naive
			if (command[i + 1] === '"' || command[i + 1] === "'") {
				i++;
			}
			currentPart += command[i];
		} else if (mode === MODE_NORMAL) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				parts.push(currentPart);
				currentPart = '';
			} else if (parts.length && !currentPart) {
				// We just closed a quote to continue the same
				// argument with different escaping style, e.g.:
				// php -r 'require '\''vendor/autoload.php'\''
				currentPart = parts.pop()! + char;
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === quote) {
				mode = MODE_NORMAL;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart);
	}
	return parts;
}
