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
		expect(
			getTerminalErrorMessage('ParseError: unexpected token on line 1', {
				line: 1,
				character: 7,
			})
		).toBe('ParseError: unexpected token on line 1, character 7');
	});

	it('explains an incomplete PHP statement', () => {
		expect(
			getTerminalErrorMessage(
				'ParseError: syntax error, unexpected end of file, expecting "," or ";" on line 3',
				{ line: 2, character: 14 }
			)
		).toBe(
			'ParseError on line 2, character 14: Incomplete PHP code. Check for a missing semicolon or closing delimiter.'
		);
	});

	it('extracts the exception message from a PHP stack trace', () => {
		const explanation =
			'This WP-CLI command tried to read from STDIN, but the wp-cli Blueprint step does not support interactive input.';
		expect(
			getTerminalErrorMessage(
				`PHP Fatal error: Uncaught RuntimeException: ${explanation}\nStack trace:\n#0 {main}\n  thrown in /wordpress/run-cli.php on line 12`
			)
		).toBe(explanation);
	});
});
