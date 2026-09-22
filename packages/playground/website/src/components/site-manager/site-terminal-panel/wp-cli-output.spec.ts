import { formatWpCliOutput } from './wp-cli-output';

describe('formatWpCliOutput', () => {
	it('removes the PHAR header and terminal color codes', () => {
		const output = `#!/usr/bin/env php
\u001b[32;1mSuccess:\u001b[0m Updated 'blogname' option.`;

		expect(formatWpCliOutput(output)).toBe(
			"Success: Updated 'blogname' option."
		);
	});

	it('keeps bracketed text that is not preceded by an escape byte', () => {
		expect(formatWpCliOutput('Post title: [2m dashes')).toBe(
			'Post title: [2m dashes'
		);
	});
});
