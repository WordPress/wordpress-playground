import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '..';
import {
	PHP,
	PHPRequestHandler,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { createSpawnHandler } from '@php-wasm/util';

describe.each(SupportedPHPVersions)(
	'[PHP %s] PHPRequestHandler – PHP_SELF',
	(phpVersion) => {
		let handler: PHPRequestHandler;
		beforeEach(async () => {
			handler = new PHPRequestHandler({
				phpFactory: async () =>
					new PHP(await loadNodeRuntime(phpVersion)),
				documentRoot: '/var/www',
				maxPhpInstances: 1,
			});
			const php = await handler.getPrimaryPhp();
			php.mkdirTree('/var/www');
		});

		it.each([
			['/index.php', '/index.php'],
			['/index.php?foo=bar', '/index.php'],
			['/index.php?foo=bar&baz=qux', '/index.php'],
			['/', '/index.php'],
		])(
			'Should assign the correct PHP_SELF for %s',
			async (url: string, expected: string) => {
				const php = await handler.getPrimaryPhp();
				php.writeFile(
					'/var/www/index.php',
					`<?php echo $_SERVER['PHP_SELF'];`
				);
				const response = await handler.request({
					url,
				});
				expect(response.text).toEqual(expected);
			}
		);

		it('should assign the correct PHP_SELF (file in subdirectory, query string present)', async () => {
			const php = await handler.getPrimaryPhp();
			php.mkdirTree('/var/www/subdir');
			php.writeFile(
				'/var/www/subdir/index.php',
				`<?php echo $_SERVER['PHP_SELF'];`
			);
			const response = await handler.request({
				url: '/subdir/?foo=bar',
			});
			expect(response.text).toEqual('/subdir/index.php');
		});
	}
);

describe('PHPRequestHandler – Loopback call', () => {
	let handler: PHPRequestHandler;

	it('Spawn: exec() can spawn another PHP before the previous run() concludes', async () => {
		async function createPHP() {
			const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi, options) {
					if (args[0] !== 'php') {
						throw new Error(
							`Unexpected command: ${args.join(' ')}`
						);
					}
					const { php, reap } =
						await handler.processManager.acquirePHPInstance();
					const result = await php.run({
						scriptPath: args[1],
						env: options.env,
					});
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					processApi.exit(result.exitCode);
					reap();
				})
			);
			php.writeFile(
				'/first.php',
				`<?php echo 'Starting: '; echo exec("php /second.php", $output, $return_var); echo ' Done';`
			);
			php.writeFile('/second.php', `<?php echo 'Ran second.php!'; `);
			return php;
		}
		handler = new PHPRequestHandler({
			documentRoot: '/',
			phpFactory: createPHP,
			maxPhpInstances: 2,
		});
		const response = await handler.request({
			url: '/first.php',
		});
		expect(response.text).toEqual('Starting: Ran second.php! Done');
	});

	it('Loopback: handler.request() can be called before the previous call concludes', async () => {
		async function createPHP() {
			const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi) {
					const result = await handler.request({
						url: '/second.php',
					});
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					processApi.exit(result.exitCode);
				})
			);
			php.writeFile(
				'/first.php',
				`<?php echo 'Starting: '; echo exec("php /second.php", $output, $return_var); echo ' Done';`
			);
			php.writeFile('/second.php', `<?php echo 'Ran second.php!'; `);
			return php;
		}
		handler = new PHPRequestHandler({
			documentRoot: '/',
			phpFactory: createPHP,
			maxPhpInstances: 2,
		});
		const response = await handler.request({
			url: '/first.php',
		});
		expect(response.text).toEqual('Starting: Ran second.php! Done');
	});
});
