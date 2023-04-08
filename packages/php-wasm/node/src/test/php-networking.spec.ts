import express from 'express';
import { getPHPLoaderModule, loadPHPRuntime, PHP, PHP_VERSIONS } from '..';

describe.each(PHP_VERSIONS)(
	'PHP %s',
	(phpVersion) => {
		it('should be able to make a request to a server', async () => {
			const serverUrl = await startServer();
			const php = await startPHP(phpVersion);
			php.setPhpIniEntry('allow_url_fopen', '1');
			php.writeFile(
				'/tmp/test.php',
				`<?php
            echo file_get_contents("${serverUrl}");
            `
			);
			const result = await php.run({
				scriptPath: '/tmp/test.php',
			});
			const text = new TextDecoder().decode(result.body);
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

async function startPHP(version: string) {
	const phpLoaderModule = await getPHPLoaderModule(version);
	const runtimeId = await loadPHPRuntime(phpLoaderModule);
	return new PHP(runtimeId);
}
