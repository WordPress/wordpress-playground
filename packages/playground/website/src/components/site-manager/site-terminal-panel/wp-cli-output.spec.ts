import { formatWpCliOutput } from './wp-cli-output';

describe('formatWpCliOutput', () => {
	it('removes the PHAR header and terminal color codes', () => {
		const output = `#!/usr/bin/env php
[32;1mSuccess:[0m Updated 'blogname' option.`;

		expect(formatWpCliOutput(output)).toBe(
			"Success: Updated 'blogname' option."
		);
	});
});
