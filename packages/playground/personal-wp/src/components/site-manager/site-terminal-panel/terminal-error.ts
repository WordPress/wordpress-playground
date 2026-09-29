/**
 * Prevents WordPress fatal-error documents and PHP stack traces from flooding
 * the terminal.
 */
export function getTerminalErrorMessage(
	message: string,
	syntaxErrorPosition?: { line: number; character: number }
) {
	const uncaughtException = message.match(
		/Uncaught [\w\\]+: ([\s\S]*?)\n\s*Stack trace:/
	);
	if (uncaughtException) {
		return uncaughtException[1].trim();
	}

	const incompletePhp = message.match(
		/^ParseError: (?:syntax error, )?(?:unexpected end of file|Unclosed\b).*?(?: on line (\d+))?$/
	);
	if (incompletePhp) {
		const location = syntaxErrorPosition
			? ` on line ${syntaxErrorPosition.line}, character ${syntaxErrorPosition.character}`
			: incompletePhp[1]
				? ` on line ${incompletePhp[1]}`
				: '';
		return `ParseError${location}: Incomplete PHP code. Check for a missing semicolon or closing delimiter.`;
	}
	if (syntaxErrorPosition && message.startsWith('ParseError:')) {
		return `${message.replace(/ on line \d+$/, '')} on line ${syntaxErrorPosition.line}, character ${syntaxErrorPosition.character}`;
	}

	const htmlStart = message.indexOf('<!DOCTYPE html>');
	if (htmlStart === -1) {
		return message;
	}

	const document = new DOMParser().parseFromString(
		message.slice(htmlStart),
		'text/html'
	);
	const wordpressError = document.querySelector(
		'.wp-die-message > p:first-child'
	)?.textContent;

	return wordpressError?.trim() || 'WordPress encountered a critical error.';
}
