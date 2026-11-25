import { LatestSupportedPHPVersion, PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import {
	DEFAULT_OPENSSL_CONF_CONTENT,
	DEFAULT_OPENSSL_CONF_PATH,
} from '../lib/openssl-config';

describe('PHP OpenSSL configuration', () => {
	it.each([LatestSupportedPHPVersion, '7.4'] as const)(
		'generates RSA keys and signs data on PHP %s without explicit config',
		async (phpVersion) => {
			const php = new PHP(await loadNodeRuntime(phpVersion));
			try {
				const result = await php.run({
					code: `<?php
						$key = openssl_pkey_new(array(
							'private_key_bits' => 2048,
							'private_key_type' => OPENSSL_KEYTYPE_RSA,
						));
						$pem = '';
						$exported = $key !== false ? openssl_pkey_export($key, $pem) : false;
						$details = $key !== false ? openssl_pkey_get_details($key) : false;
						$signature = '';
						$signed = $key !== false ? openssl_sign('playground', $signature, $key, OPENSSL_ALGO_SHA256) : false;
						$verified = ($signed && is_array($details))
							? openssl_verify('playground', $signature, $details['key'], OPENSSL_ALGO_SHA256)
							: -1;
						$errors = array();
						while ($err = openssl_error_string()) {
							$errors[] = $err;
						}
						echo json_encode(array(
							'hasKey' => $key !== false,
							'exported' => $exported,
							'hasPemHeader' => strpos($pem, 'BEGIN') !== false,
							'verified' => $verified,
							'opensslConf' => getenv('OPENSSL_CONF'),
							'errors' => $errors,
						));
					`,
				});

				expect(result.errors).toBe('');
				const parsed = JSON.parse(result.text);
				expect(parsed).toMatchObject({
					hasKey: true,
					exported: true,
					hasPemHeader: true,
					verified: 1,
					opensslConf: DEFAULT_OPENSSL_CONF_PATH,
				});
				expect(
					parsed.errors.filter((error: string) =>
						/configuration file|BIO_new_file|def_load/i.test(error)
					)
				).toEqual([]);
			} finally {
				php.exit();
			}
		}
	);

	it('generates a CSR and self-signed certificate with default OpenSSL config', async () => {
		const php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
		try {
			const result = await php.run({
				code: `<?php
					$key = openssl_pkey_new(array(
						'private_key_bits' => 2048,
						'private_key_type' => OPENSSL_KEYTYPE_RSA,
					));
					$csr = openssl_csr_new(array('commonName' => 'playground.test'), $key);
					$cert = $csr !== false ? openssl_csr_sign($csr, null, $key, 1) : false;
					$certPem = '';
					$exported = $cert !== false ? openssl_x509_export($cert, $certPem) : false;
					echo json_encode(array(
						'hasCsr' => $csr !== false,
						'hasCert' => $cert !== false,
						'exported' => $exported,
						'hasCertHeader' => strpos($certPem, 'BEGIN CERTIFICATE') !== false,
					));
				`,
			});

			expect(result.errors).toBe('');
			expect(JSON.parse(result.text)).toEqual({
				hasCsr: true,
				hasCert: true,
				exported: true,
				hasCertHeader: true,
			});
		} finally {
			php.exit();
		}
	});

	it('preserves caller-provided OPENSSL_CONF env and preRun config overrides', async () => {
		const customConfigPath = '/tmp/custom-openssl.cnf';
		const customConfigContent =
			'# custom openssl config\n' + DEFAULT_OPENSSL_CONF_CONTENT;

		const php = new PHP(
			await loadNodeRuntime(LatestSupportedPHPVersion, {
				emscriptenOptions: {
					ENV: {
						OPENSSL_CONF: customConfigPath,
					},
					preRun: [
						(module: {
							FS: {
								writeFile: (
									path: string,
									content: string
								) => void;
							};
						}) => {
							module.FS.writeFile(
								customConfigPath,
								customConfigContent
							);
							module.FS.writeFile(
								DEFAULT_OPENSSL_CONF_PATH,
								'# overwritten by caller preRun\n'
							);
						},
					],
				},
			})
		);
		try {
			const result = await php.run({
				code: `<?php
					$key = openssl_pkey_new(array(
						'private_key_bits' => 2048,
						'private_key_type' => OPENSSL_KEYTYPE_RSA,
					));
					echo json_encode(array(
						'opensslConf' => getenv('OPENSSL_CONF'),
						'defaultFile' => file_get_contents(${JSON.stringify(DEFAULT_OPENSSL_CONF_PATH)}),
						'hasKey' => $key !== false,
					));
				`,
			});

			expect(result.errors).toBe('');
			expect(JSON.parse(result.text)).toEqual({
				opensslConf: customConfigPath,
				defaultFile: '# overwritten by caller preRun\n',
				hasKey: true,
			});
		} finally {
			php.exit();
		}
	});
});
