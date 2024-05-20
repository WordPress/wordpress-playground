import { NodePHP } from '..';
import { SupportedPHPVersions, setPhpIniEntries } from '@php-wasm/universal';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

describe.each(phpVersions)('PHP %s – memory allocation', (phpVersion) => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion as any);
		await setPhpIniEntries(php, { allow_url_fopen: 1, memory_limit: '1G' });
	});

	it('can concat large string out of many small strings without reaching Out-of-memory condition', async () => {
		const code = `<?php
            $data = '';
            $tail = str_repeat('a', 64 * 1024); // Increase string size by 64KB in each iteration
            for ($counter = 0; $counter < 1000; $counter++) {
                $data .= $tail;
            }
        `;

		const result = await php.run({ code });

		expect(result).toBeTruthy();
		expect(result.exitCode).toBe(0);
		expect(result.errors).toBeFalsy();
	});
});
