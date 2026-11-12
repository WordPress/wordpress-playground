import { loadNodeRuntime } from '@php-wasm/node';
import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';

/**
 * Builds a phar with the alias WP-CLI's releases use, for tests of the wp-cli step.
 */
export async function buildTestPhar(
	files: Record<string, string>
): Promise<Uint8Array> {
	// phar.readonly is only read when PHP starts, so this takes a fresh runtime.
	const pharBuilder = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	await setPhpIniEntries(pharBuilder, { 'phar.readonly': '0' });
	await pharBuilder.run({
		code: `<?php
			$phar = new Phar('/tmp/built.phar', 0, 'wp-cli.phar');
			foreach (${phpVar(files)} as $path => $content) {
				$phar->addFromString($path, $content);
			}
			$phar->setStub('<?php __HALT_COMPILER();');
		`,
	});
	const pharBytes = pharBuilder.readFileAsBuffer('/tmp/built.phar');
	pharBuilder.exit();
	return pharBytes;
}
