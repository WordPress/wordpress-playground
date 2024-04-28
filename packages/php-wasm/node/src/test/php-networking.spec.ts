import { SupportedPHPVersions } from '@php-wasm/universal';
import express from 'express';
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
