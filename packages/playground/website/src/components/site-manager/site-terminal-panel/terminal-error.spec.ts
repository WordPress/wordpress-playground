// @vitest-environment jsdom

import { getTerminalErrorMessage } from './terminal-error';

describe('getTerminalErrorMessage', () => {
	it('extracts the message from a WordPress fatal-error document', () => {
		const error = `PHP.run() failed with exit code 255.

=== Stdout ===
<!DOCTYPE html>
<html><body id="error-page"><div class="wp-die-message">
<p>There has been a critical error on this website.</p>
<p><a href="https://wordpress.org/">Learn more.</a></p>
</div></body></html>`;

		expect(getTerminalErrorMessage(error)).toBe(
			'There has been a critical error on this website.'
		);
	});

	it('preserves ordinary PHP errors', () => {
		expect(getTerminalErrorMessage('ParseError: unexpected token')).toBe(
			'ParseError: unexpected token'
		);
	});

	it('explains an incomplete PHP statement', () => {
		expect(
			getTerminalErrorMessage(
				'ParseError: syntax error, unexpected end of file'
			)
		).toBe(
			'Incomplete PHP code. Add a missing semicolon, closing bracket, or brace. Use Shift+Enter to continue on another line.'
		);
	});

	it('extracts the unsupported STDIN message from a PHP stack trace', () => {
		const explanation =
			'This WP-CLI command tried to read from STDIN, but the wp-cli Blueprint step does not support interactive input. Provide all required arguments.';
		expect(
			getTerminalErrorMessage(
				`PHP Fatal error: Uncaught RuntimeException: ${explanation}\nStack trace:\n#0`
			)
		).toBe(explanation);
	});
});
