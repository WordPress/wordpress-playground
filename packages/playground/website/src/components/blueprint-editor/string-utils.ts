/**
 * Unescape a JSON string value to its actual content.
 * Converts escape sequences like \n, \t, \\, \" to their actual characters.
 */
export function unescapeJsonString(jsonString: string): string {
	// Remove surrounding quotes if present
	let str = jsonString;
	if (str.startsWith('"') && str.endsWith('"')) {
		str = str.slice(1, -1);
	}

	// Process escape sequences
	let result = '';
	let i = 0;
	while (i < str.length) {
		if (str[i] === '\\' && i + 1 < str.length) {
			const next = str[i + 1];
			switch (next) {
				case 'n':
					result += '\n';
					i += 2;
					break;
				case 't':
					result += '\t';
					i += 2;
					break;
				case 'r':
					result += '\r';
					i += 2;
					break;
				case '\\':
					result += '\\';
					i += 2;
					break;
				case '"':
					result += '"';
					i += 2;
					break;
				case '/':
					result += '/';
					i += 2;
					break;
				case 'b':
					result += '\b';
					i += 2;
					break;
				case 'f':
					result += '\f';
					i += 2;
					break;
				case 'u':
					// Unicode escape: \uXXXX
					if (i + 5 < str.length) {
						const hex = str.slice(i + 2, i + 6);
						const codePoint = parseInt(hex, 16);
						if (!isNaN(codePoint)) {
							result += String.fromCharCode(codePoint);
							i += 6;
							break;
						}
					}
					result += str[i];
					i++;
					break;
				default:
					result += str[i];
					i++;
			}
		} else {
			result += str[i];
			i++;
		}
	}

	return result;
}

/**
 * Escape a plain string for use as a JSON string value.
 * Converts special characters to their escape sequences.
 */
export function escapeJsonString(plainString: string): string {
	let result = '';
	for (const char of plainString) {
		switch (char) {
			case '\n':
				result += '\\n';
				break;
			case '\t':
				result += '\\t';
				break;
			case '\r':
				result += '\\r';
				break;
			case '\\':
				result += '\\\\';
				break;
			case '"':
				result += '\\"';
				break;
			case '\b':
				result += '\\b';
				break;
			case '\f':
				result += '\\f';
				break;
			default:
				// Handle control characters
				if (char.charCodeAt(0) < 32) {
					result +=
						'\\u' +
						char.charCodeAt(0).toString(16).padStart(4, '0');
				} else {
					result += char;
				}
		}
	}
	return result;
}
