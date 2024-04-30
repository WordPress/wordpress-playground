import { SupportedPHPVersions } from '@php-wasm/universal';
import express from 'express';
import { rootCertificates } from 'tls';
import { NodePHP } from '..';

describe.each(['8.0'])(
	'PHP %s',
	(phpVersion) => {
		it('should be able to make a request to a server', async () => {
			const serverUrl = await startServer();
			const php = await NodePHP.load(phpVersion);
			php.setPhpIniEntry('allow_url_fopen', '1');
			php.writeFile(
				'/tmp/test.php',
				`<?php
            echo file_get_contents("${serverUrl}");
            `
			);
			const { text } = await php.run({
				scriptPath: '/tmp/test.php',
			});
			expect(text).toEqual('response from express');
		});

		describe('cURL', () => {
			it('should support single handle requests', async () => {
				const serverUrl = await startServer();
				const php = await NodePHP.load(phpVersion);
				php.setPhpIniEntry('disable_functions', '');
				php.writeFile(
					'/tmp/test.php',
					`<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "${serverUrl}");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					echo curl_exec($ch);
					curl_close($ch);
			`
				);
				const { text } = await php.run({
					scriptPath: '/tmp/test.php',
				});
				expect(text).toEqual('response from express');
			});

			it('should support multi handle requests', async () => {
				const serverUrl = await startServer();
				const php = await NodePHP.load(phpVersion);
				php.setPhpIniEntry('disable_functions', '');
				php.writeFile(
					'/tmp/test.php',
					`<?php
					$ch1 = curl_init();
					curl_setopt($ch1, CURLOPT_URL, "${serverUrl}");
					curl_setopt($ch1, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch1, CURLOPT_RETURNTRANSFER, 1);
					$ch2 = curl_init();
					curl_setopt($ch2, CURLOPT_URL, "${serverUrl}");
					curl_setopt($ch2, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch2, CURLOPT_RETURNTRANSFER, 1);
					$mh = curl_multi_init();
					curl_multi_add_handle($mh, $ch1);
					curl_multi_add_handle($mh, $ch2);
					do {
						curl_multi_exec($mh, $running);
						curl_multi_select($mh);
					} while ($running > 0);
					echo curl_multi_getcontent($ch1)."\\n";
					echo curl_multi_getcontent($ch2);
					curl_multi_remove_handle($mh, $ch1);
					curl_multi_remove_handle($mh, $ch2);
					curl_multi_close($mh);
					curl_close($ch1);
					curl_close($ch2);
			`
				);
				const { text } = await php.run({
					scriptPath: '/tmp/test.php',
				});
				expect(text).toEqual(
					'response from express\nresponse from express'
				);
			});

			it('should follow redirects', async () => {
				const serverUrl = await startServer();
				const php = await NodePHP.load(phpVersion);
				php.setPhpIniEntry('disable_functions', '');
				php.writeFile(
					'/tmp/test.php',
					`<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "${serverUrl}/redirect");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					echo curl_exec($ch);
					curl_close($ch);
			`
				);
				const { text } = await php.run({
					scriptPath: '/tmp/test.php',
				});
				expect(text).toEqual('response from express');
			});

			it('should support HTTPS requests', async () => {
				const php = await NodePHP.load(phpVersion);
				php.setPhpIniEntry('disable_functions', '');
				php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
				php.writeFile(
					'/tmp/ca-bundle.crt',
					rootCertificates.join('\n')
				);
				const { text } = await php.run({
					code: `<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://api.wordpress.org/stats/php/1.0/");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					$result = curl_exec($ch);
					curl_close($ch);
					$json = json_decode($result, true);
					var_dump(array_key_exists('8.3', $json));
					`,
				});
				expect(text).toContain('bool(true)');
			});

			it('should support HTTPS requests when certificate verification is disabled', async () => {
				const php = await NodePHP.load(phpVersion);
				php.setPhpIniEntry('disable_functions', '');
				const { text } = await php.run({
					code: `<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://api.wordpress.org/stats/php/1.0/");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
					curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
					$result = curl_exec($ch);
					curl_close($ch);
					$json = json_decode($result, true);
					var_dump(array_key_exists('8.3', $json));
					`,
				});
				console.log(text);
				expect(text).toContain('bool(true)');
			});
		});
	},
	1000
);

async function startServer() {
	const app = express();
	app.use('/', async (req: any, res: any) => {
		res.end('response from express');
	});

	app.use('/redirect', async (req: any, res: any) => {
		res.redirect('/');
	});

	const server = await new Promise<any>((resolve) => {
		const _server = app.listen(() => {
			resolve(_server);
		});
	});
	return 'http://127.0.0.1:' + server.address().port;
}
