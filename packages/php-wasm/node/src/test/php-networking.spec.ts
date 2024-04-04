import { SupportedPHPVersions } from '@php-wasm/universal';
import express from 'express';
import { NodePHP } from '..';

describe.each(['8.0'])(
	'PHP %s',
	(phpVersion) => {
		it.only('should be able to use CURL', async () => {
			const php = await NodePHP.load(phpVersion);
			php.setPhpIniEntry('disable_functions', '');
			php.setPhpIniEntry('allow_url_fopen', 'On');
			php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
			php.writeFile(
				'/tmp/test.php',
				`<?php
				$ch = curl_init();
				curl_setopt( $ch, CURLOPT_URL, 'http://wordpress.org' );
				curl_setopt($ch, CURLOPT_VERBOSE, 1);
				curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
				curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
				curl_setopt($ch, CURLOPT_TIMEOUT, 2);
				curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
				$streamVerboseHandle = fopen('php://stdout', 'w+');
				curl_setopt($ch, CURLOPT_STDERR, $streamVerboseHandle);
				echo "Before curl_exec\n\n";
				
				$output = curl_exec($ch);
				echo "\n\nAfter curl_exec\n";
				var_dump($output);
				var_dump(curl_error($ch));
				curl_close($ch);
			`
			);
			const { text } = await php.run({
				scriptPath: '/tmp/test.php',
			});
			expect(text).toContain('WordPress');
		}, 5000);

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
	},
	1000
);

async function startServer() {
	const app = express();
	app.use('/', async (req: any, res: any) => {
		res.end('response from express');
	});

	const server = await new Promise<any>((resolve) => {
		const _server = app.listen(() => {
			resolve(_server);
		});
	});
	return 'http://127.0.0.1:' + server.address().port;
}
