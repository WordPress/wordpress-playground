/**
 * Prevents WordPress fatal-error documents and PHP stack traces from flooding
 * the terminal.
 */
export function getTerminalErrorMessage(message: string) {
	const uncaughtException = message.match(
		/Uncaught [\w\\]+: ([\s\S]*?)\n\s*Stack trace:/
	);
	if (uncaughtException) {
		return uncaughtException[1].trim();
	}

	if (
		message.startsWith('ParseError: syntax error, unexpected end of file')
	) {
		return 'Incomplete PHP code. Add a missing semicolon, closing bracket, or brace. Use Shift+Enter to continue on another line.';
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
