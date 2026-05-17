/**
 * Re-run a curated subset of `tests/run-cli.spec.ts` under
 * `--experimental-posix-kernel`. Each test re-uses the classic test's
 * body where possible, swapping only the `runCLI` invocation.
 *
 * Tests deliberately NOT mirrored:
 *   - PHP-version, custom --site-url, multi-instance symlinks, /tmp
 *     post-install mounts: kernel mode does not honor these flags yet.
 *   - auto-mount, verbosity, pathAliases, phpMyAdmin: not yet wired
 *     through kernel mode.
 *   - error handling (requestStreamed override): the classic test
 *     mechanism does not translate to nginx + FPM.
 *   - streaming responses: would mirror classic; medium value.
 *   - signal handling, worker count: classic worker pool concepts.
 */

import http from 'node:http';
import {
	parseOptionsAndRunCLI,
	internalsKeyForTesting,
	runCLI,
} from '../../src/run-cli';
import { describe, expect, test, vi } from 'vitest';

describe(
	'run-cli with --experimental-posix-kernel',
	() => {
		test('should define constants via --define flags', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
				define: { MY_STRING_CONSTANT: 'test_value' },
				'define-bool': {
					MY_BOOL_CONSTANT: true,
					MY_FALSE_CONSTANT: false,
				},
				'define-number': { MY_NUMBER_CONSTANT: 42 },
			});

			await cliServer.playground.writeFile(
				'/wordpress/constants.php',
				`<?php
					echo "STRING: " . MY_STRING_CONSTANT . "\\n";
					echo "NUMBER: " . MY_NUMBER_CONSTANT . "\\n";
					echo "BOOL: " . (MY_BOOL_CONSTANT ? 'true' : 'false') . "\\n";
					echo "FALSE: " . (MY_FALSE_CONSTANT ? 'true' : 'false') . "\\n";
					`
			);
			const response = await fetch(
				new URL('/constants.php', cliServer.serverUrl)
			);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('STRING: test_value');
			expect(text).toContain('NUMBER: 42');
			expect(text).toContain('BOOL: true');
			expect(text).toContain('FALSE: false');
		});

		test('should set WordPress version', async () => {
			const { MinifiedWordPressVersionsList } =
				await import('@wp-playground/wordpress-builds');
			// Use the oldest non-legacy version. Legacy versions
			// (< 5.0) require legacy PHP and can't boot on modern PHP.
			const oldestSupportedVersion = MinifiedWordPressVersionsList.filter(
				(v) => parseFloat(v) >= 5
			).pop()!;
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
				wp: oldestSupportedVersion,
			});
			// The classic spec embeds a literal `/wordpress/wp-load.php`
			// because in classic mode the VFS doc root really is
			// `/wordpress`. Under the kernel handler nginx + FPM serve
			// straight off the host filesystem with no VFS, so the
			// hardcoded `/wordpress` prefix doesn't resolve. Interpolate
			// the live `documentRoot` (the host path) instead.
			const docRoot = cliServer.playground.documentRoot;
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				`<?php
					require_once '${docRoot}/wp-load.php';
					echo get_bloginfo("version");
					?>`
			);
			const response = await fetch(
				new URL('/version.php', cliServer.serverUrl)
			);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain(oldestSupportedVersion);
		});

		test('should run blueprint', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
				blueprint: {
					steps: [
						{
							step: 'setSiteOptions',
							options: { blogname: 'My Blog Name' },
						},
					],
				},
			});
			const response = await fetch(new URL('/', cliServer.serverUrl));
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('<title>My Blog Name</title>');
		});

		test('should run blueprint including git:resources', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
				blueprint: {
					steps: [
						{
							step: 'installPlugin',
							options: {
								activate: true,
								targetFolderName: 'blocky-formats',
							},
							pluginData: {
								resource: 'git:directory',
								url: 'https://github.com/dmsnell/blocky-formats.git',
								ref: 'HEAD',
								path: '/',
							},
						},
					],
				},
			});
			const response = await fetch(new URL('/', cliServer.serverUrl));
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('My WordPress Website');
		});

		test('should use default site-url when not provided', async () => {
			// Use port: 0 to dodge contention with the sibling
			// tests/run-cli.spec.ts test that also wants 9500 — under
			// vitest's file parallelism the two can race on Windows.
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
			});
			const docRoot = cliServer.playground.documentRoot;
			await cliServer.playground.writeFile(
				'/wordpress/site-url.php',
				`<?php require_once '${docRoot}/wp-load.php'; echo get_option("siteurl"); ?>`
			);
			const response = await fetch(
				new URL('/site-url.php', cliServer.serverUrl)
			);
			expect(response.status).toBe(200);
			const text = await response.text();
			const expectedOrigin = new URL(cliServer.serverUrl).origin;
			expect(text).toContain(expectedOrigin);
		});
	},
	60_000 * 5
);

describe(
	'--experimental-posix-kernel WP_DEBUG constants',
	() => {
		async function getConstants(cliArgs: string[]) {
			const exitSpy = vi
				.spyOn(process, 'exit')
				.mockImplementation((() => {}) as any);
			try {
				await using cliResult = await parseOptionsAndRunCLI([
					'server',
					'--experimental-posix-kernel',
					'--port=0',
					'--verbosity=quiet',
					...cliArgs,
				]);
				const cliServer = cliResult[internalsKeyForTesting].cliServer;
				const docRoot = cliServer.playground.documentRoot;
				await cliServer.playground.writeFile(
					'/wordpress/check-consts.php',
					`<?php
					require_once '${docRoot}/wp-load.php';
					echo json_encode([
						'WP_DEBUG' => defined('WP_DEBUG') ? WP_DEBUG : '__UNDEFINED__',
						'WP_DEBUG_LOG' => defined('WP_DEBUG_LOG') ? WP_DEBUG_LOG : '__UNDEFINED__',
						'WP_DEBUG_DISPLAY' => defined('WP_DEBUG_DISPLAY') ? WP_DEBUG_DISPLAY : '__UNDEFINED__',
					]);
					`
				);
				const response = await fetch(
					new URL('/check-consts.php', cliServer.serverUrl)
				);
				return JSON.parse(await response.text());
			} finally {
				exitSpy.mockRestore();
			}
		}

		test('should override WP_DEBUG constants via --define-bool', async () => {
			const defaults = await getConstants([]);
			expect(defaults.WP_DEBUG).toBe('true');
			expect(defaults.WP_DEBUG_LOG).toBe('true');
			expect(defaults.WP_DEBUG_DISPLAY).toBe('false');

			const overridden = await getConstants([
				'--define-bool',
				'WP_DEBUG',
				'false',
				'--define-bool',
				'WP_DEBUG_LOG',
				'false',
				'--define-bool',
				'WP_DEBUG_DISPLAY',
				'true',
			]);
			expect(overridden.WP_DEBUG).toBe(false);
			expect(overridden.WP_DEBUG_LOG).toBe(false);
			expect(overridden.WP_DEBUG_DISPLAY).toBe(true);
		});

		test('should override WP_DEBUG constants via --define-number', async () => {
			const defaults = await getConstants([]);
			expect(defaults.WP_DEBUG).toBe('true');
			expect(defaults.WP_DEBUG_LOG).toBe('true');
			expect(defaults.WP_DEBUG_DISPLAY).toBe('false');

			const overridden = await getConstants([
				'--define-number',
				'WP_DEBUG',
				'0',
				'--define-number',
				'WP_DEBUG_LOG',
				'0',
				'--define-number',
				'WP_DEBUG_DISPLAY',
				'1',
			]);
			expect(overridden.WP_DEBUG).toBe(0);
			expect(overridden.WP_DEBUG_LOG).toBe(0);
			expect(overridden.WP_DEBUG_DISPLAY).toBe(1);
		});

		test('should override WP_DEBUG constants via --define', async () => {
			const defaults = await getConstants([]);
			expect(defaults.WP_DEBUG).toBe('true');
			expect(defaults.WP_DEBUG_LOG).toBe('true');
			expect(defaults.WP_DEBUG_DISPLAY).toBe('false');

			const overridden = await getConstants([
				'--define',
				'WP_DEBUG',
				'false',
				'--define',
				'WP_DEBUG_LOG',
				'false',
				'--define',
				'WP_DEBUG_DISPLAY',
				'true',
			]);
			expect(overridden.WP_DEBUG).toBe('false');
			expect(overridden.WP_DEBUG_LOG).toBe('false');
			expect(overridden.WP_DEBUG_DISPLAY).toBe('true');
		});
	},
	60_000 * 5
);

describe(
	'--experimental-posix-kernel auto-login',
	() => {
		test('should clear old auto-login cookie', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
			});
			cliServer.playground.writeFile('/wordpress/dummy.txt', '');
			const dummyUrl = new URL('/dummy.txt', cliServer.serverUrl);
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					// Use http.get instead of fetch so the redirect body
					// (and Set-Cookie headers) are visible without auto-
					// follow.
					const req = http.get(
						dummyUrl,
						{
							headers: {
								cookie: 'playground_auto_login_already_happened=1',
							},
						},
						resolve
					);
					req.on('error', reject);
					req.end();
				}
			);
			expect(res.statusCode).toBe(302);
			expect(res.headers['set-cookie']).toContain(
				'playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'
			);
		});
	},
	60_000 * 5
);

describe(
	'--experimental-posix-kernel internal cookie store',
	() => {
		test('persists cookies across api.request() calls', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				'experimental-posix-kernel': true,
				port: 0,
			});

			// The classic test uses `fetch()` and relies on Express
			// middleware to maintain a server-side cookie jar. Under
			// kernel mode every fetch() goes straight to nginx, so the
			// cookie jar lives on KernelLimitedPHPApi.request() instead.
			// Verify it persists Set-Cookie across two programmatic
			// requests, mirroring the classic surface from a different
			// angle.
			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "cookie set"; ?>'
			);
			await cliServer.playground.writeFile(
				'/wordpress/read-cookie.php',
				'<?php echo isset($_COOKIE["test_cookie"]) ? $_COOKIE["test_cookie"] : "no cookie"; ?>'
			);

			const setResponse = await cliServer.playground.request({
				method: 'GET',
				url: '/set-cookie.php',
			});
			expect(setResponse.httpStatusCode).toBe(200);
			expect(setResponse.text).toContain('cookie set');

			const readResponse = await cliServer.playground.request({
				method: 'GET',
				url: '/read-cookie.php',
			});
			expect(readResponse.httpStatusCode).toBe(200);
			expect(readResponse.text).toContain('hello');
		});
	},
	60_000 * 5
);

describe(
	'--experimental-posix-kernel port in use',
	() => {
		test('uses a free port when the requested port is already taken', async () => {
			const blockedPort = 12346;
			const blockingServer = http.createServer();
			await new Promise<void>((resolve) => {
				blockingServer.listen(blockedPort, () => resolve());
			});

			try {
				// Classic mode errors out on EADDRINUSE; kernel mode
				// silently falls back to a free port via reserveFreePort().
				// Verify the silent-fallback behavior — picks a different,
				// usable port and the server is reachable on it.
				await using cliServer = await runCLI({
					command: 'server',
					'experimental-posix-kernel': true,
					port: blockedPort,
				});

				const assignedPort = Number(new URL(cliServer.serverUrl).port);
				expect(assignedPort).not.toBe(blockedPort);
				expect(assignedPort).toBeGreaterThan(0);

				const response = await fetch(cliServer.serverUrl);
				expect(response.status).toBe(200);
			} finally {
				blockingServer.close();
			}
		});
	},
	60_000 * 5
);
