import { PHP, SupportedPHPVersions } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';
const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

describe(`Sodium extension - ${runtimeMode}`, () => {
	describe.each(phpVersions)('PHP %s', (phpVersion) => {
		it('loads and opens a secretbox', async () => {
			using php = new PHP(await loadNodeRuntime(phpVersion as any));
			const result = await php.run({
				code: `<?php
					$loaded = extension_loaded('sodium');
					$hasKeyBytes = defined('SODIUM_CRYPTO_SECRETBOX_KEYBYTES');
					$canSeal = is_callable('sodium_crypto_secretbox');
					$canOpen = is_callable('sodium_crypto_secretbox_open');
					$plaintext = 'missing';
					if ($loaded && $hasKeyBytes && $canSeal && $canOpen) {
						$key = random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
						$nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
						$ciphertext = sodium_crypto_secretbox('secret', $nonce, $key);
						$plaintext = sodium_crypto_secretbox_open($ciphertext, $nonce, $key);
					}
					echo ($loaded ? 'loaded' : 'missing') . ':';
					echo $hasKeyBytes ? SODIUM_CRYPTO_SECRETBOX_KEYBYTES : 'missing';
					echo ':' . ($canSeal ? 'seal' : 'no-seal');
					echo ':' . ($canOpen ? 'open' : 'no-open');
					echo ':' . $plaintext;
				`,
			});

			expect(result.text).toBe('loaded:32:seal:open:secret');
			expect(result.errors).toBeFalsy();
		});
	});
});
