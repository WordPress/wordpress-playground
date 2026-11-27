import { __, sprintf } from '@wordpress/i18n';

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
		if (syntaxErrorPosition) {
			return sprintf(
				/* translators: 1: Line number, 2: Character offset. */
				__(
					'ParseError on line %1$d, character %2$d: Incomplete PHP code. Check for a missing semicolon or closing delimiter.',
					'playground-website'
				),
				syntaxErrorPosition.line,
				syntaxErrorPosition.character
			);
		}
		if (incompletePhp[1]) {
			return sprintf(
				/* translators: %s: Line number. */
				__(
					'ParseError on line %s: Incomplete PHP code. Check for a missing semicolon or closing delimiter.',
					'playground-website'
				),
				incompletePhp[1]
			);
		}
		return __(
			'ParseError: Incomplete PHP code. Check for a missing semicolon or closing delimiter.',
			'playground-website'
		);
	}
	if (syntaxErrorPosition && message.startsWith('ParseError:')) {
		return sprintf(
			/* translators: 1: PHP ParseError message, 2: Line number, 3: Character offset. */
			__('%1$s on line %2$d, character %3$d', 'playground-website'),
			message.replace(/ on line \d+$/, ''),
			syntaxErrorPosition.line,
			syntaxErrorPosition.character
		);
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

	return (
		wordpressError?.trim() ||
		__('WordPress encountered a critical error.', 'playground-website')
	);
}
