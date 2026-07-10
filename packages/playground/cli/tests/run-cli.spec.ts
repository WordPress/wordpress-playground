import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { Worker } from 'node:worker_threads';
import type * as ChildProcess from 'child_process';
import {
	runCLI,
	parseOptionsAndRunCLI,
	internalsKeyForTesting,
	resolveWorkerCount,
} from '../src/run-cli';
import type {
	RunCLIArgs,
	RunCLIServer,
	CLIExitResult,
	CLIServerResult,
} from '../src/run-cli';
import type { MockInstance } from 'vitest';
import { vi } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	writeFileSync,
	symlinkSync,
	unlinkSync,
	existsSync,
	lstatSync,
	rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeZip } from '@php-wasm/stream-compression';
import { PHPMYADMIN_INSTALL_PATH } from '@wp-playground/tools';
import { type Log, logger } from '@php-wasm/logger';

vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof ChildProcess>();
	return {
		...actual,
		exec: vi.fn((_command, callback) => {
			if (typeof callback === 'function') {
				callback(null as any, '' as any, '' as any);
			}
			return {} as any;
		}),
	};
});

const blueprintVersions = [
	{
		version: 1,
		expectedHomePageTitle: 'My WordPress Website',
		suiteCliArgs: {
			'experimental-trace': false,
		},
	},
];

const fullNativeBlueprintV2ModeTest =
	process.platform === 'win32' ? test.skip : test;

describe.each(blueprintVersions)(
	'run-cli with Blueprints v$version',
	({ version, suiteCliArgs, expectedHomePageTitle }) => {
		test('should set PHP version', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				php: '8.0',
				// Let's skip the cost of WordPress setup because it is
				// irrelevant for this test.
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				'<?php echo phpversion(); ?>'
			);
			const versionUrl = new URL('/version.php', cliServer.serverUrl);
			const response = await fetch(versionUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('8.0');
		});

		test('should have Intl extension enabled by default', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				php: '8.0',
				// Let's skip the cost of WordPress setup because it is
				// irrelevant for this test.
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/intl.php',
				`<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`
			);
			const versionUrl = new URL('/intl.php', cliServer.serverUrl);
			const response = await fetch(versionUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('bool(true)\nbool(true)\n');
		});

		test('should define constants via --define flags', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				php: '8.0',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
				define: {
					MY_STRING_CONSTANT: 'test_value',
				},
				'define-bool': {
					MY_BOOL_CONSTANT: true,
					MY_FALSE_CONSTANT: false,
				},
				'define-number': {
					MY_NUMBER_CONSTANT: 42,
				},
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
			const constantsUrl = new URL('/constants.php', cliServer.serverUrl);
			const response = await fetch(constantsUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('STRING: test_value');
			expect(text).toContain('NUMBER: 42');
			expect(text).toContain('BOOL: true');
			expect(text).toContain('FALSE: false');
		});

		test('should use custom site-url when provided', async () => {
			const customSiteUrl = 'https://example.com';
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				'site-url': customSiteUrl,
			});
			await cliServer.playground.writeFile(
				'/wordpress/site-url.php',
				'<?php require_once "/wordpress/wp-load.php"; echo get_option("siteurl"); ?>'
			);
			const siteUrlTestUrl = new URL(
				'/site-url.php',
				cliServer.serverUrl
			);
			const response = await fetch(siteUrlTestUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain(customSiteUrl);
		});

		test('should use default site-url when not provided', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				port: 9500,
				command: 'server',
			});
			await cliServer.playground.writeFile(
				'/wordpress/site-url.php',
				'<?php require_once "/wordpress/wp-load.php"; echo get_option("siteurl"); ?>'
			);
			const siteUrlTestUrl = new URL(
				'/site-url.php',
				cliServer.serverUrl
			);
			const response = await fetch(siteUrlTestUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('http://127.0.0.1:9500');
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
				...suiteCliArgs,
				command: 'server',
				wp: oldestSupportedVersion,
			});
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				`<?php
            require_once '/wordpress/wp-load.php';
            echo get_bloginfo("version");
            ?>`
			);
			const versionUrl = new URL('/version.php', cliServer.serverUrl);
			const response = await fetch(versionUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain(oldestSupportedVersion);
		});

		test('should run blueprint', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				blueprint: {
					steps: [
						{
							step: 'setSiteOptions',
							options: {
								blogname: 'My Blog Name',
							},
						},
					],
				},
			});
			const homeUrl = new URL('/', cliServer.serverUrl);
			const response = await fetch(homeUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('<title>My Blog Name</title>');
		});

		test('should route v2 blueprints to the native v2 handler without the experimental flag', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				workers: 1,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: {
					version: 2,
					additionalStepsAfterExecution: [
						{
							step: 'mkdir',
							path: 'routed-v2',
						},
					],
				},
			});

			await expect(
				cliServer.playground.fileExists('/wordpress/routed-v2')
			).resolves.toBe(true);
		});

		test('should accept --mode with auto-mount disabled and no experimental flag', async () => {
			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
				code?: number | string | null
			) => {
				throw new Error(
					`process.exit unexpectedly called with "${code}"`
				);
			}) as any);

			try {
				await using cliResult = (await parseOptionsAndRunCLI([
					'server',
					'--mode=mount-only',
					'--no-auto-mount',
					'--verbosity=quiet',
					'--port=0',
					'--workers=1',
				])) as CLIServerResult;
				const cliServer = cliResult[internalsKeyForTesting].cliServer;

				expect(
					await cliServer.playground.fileExists(
						'/wordpress/wp-load.php'
					)
				).toBe(false);
			} finally {
				exitSpy.mockRestore();
			}
		});

		test('should reject the retired experimental v2 flag', async () => {
			// The retired flag is now an unknown yargs option: parsing fails,
			// parseOptionsAndRunCLI reports it and returns a { exitCode }
			// result instead of calling process.exit().
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			try {
				const result = await parseOptionsAndRunCLI([
					'server',
					'--experimental-blueprints-v2-runner',
				]);
				expect(result).toHaveProperty('exitCode', 1);
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining('experimental-blueprints-v2-runner')
				);
			} finally {
				consoleErrorSpy.mockRestore();
			}
		});

		test('should accept URL WordPress sources with --mode', async () => {
			const fetchMock = vi.fn(async () => {
				throw new Error('Unexpected WordPress ZIP fetch');
			});
			vi.stubGlobal('fetch', fetchMock);
			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
				code?: number | string | null
			) => {
				throw new Error(
					`process.exit unexpectedly called with "${code}"`
				);
			}) as any);

			try {
				await using cliResult = (await parseOptionsAndRunCLI([
					'server',
					'--mode=mount-only',
					'--wp=https://example.com/wordpress.zip',
					'--verbosity=quiet',
					'--port=0',
					'--workers=1',
				])) as CLIServerResult;
				const cliServer = cliResult[internalsKeyForTesting].cliServer;

				expect(
					await cliServer.playground.fileExists(
						'/wordpress/wp-load.php'
					)
				).toBe(false);
				expect(exitSpy).not.toHaveBeenCalled();
				expect(fetchMock).not.toHaveBeenCalled();
			} finally {
				exitSpy.mockRestore();
				vi.unstubAllGlobals();
			}
		});

		test('should reject --mode with --wordpress-install-mode', async () => {
			// The validation runs during boot and rejects; the clean error
			// message is written to stderr, so suppress it.
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);
			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--mode=mount-only',
						'--wordpress-install-mode=do-not-attempt-installing',
						'--verbosity=quiet',
						'--port=0',
					])
				).rejects.toThrow(
					'The --wordpress-install-mode option cannot be used with the --mode option.'
				);
			} finally {
				stderrSpy.mockRestore();
			}
		});

		test('should reject --mode with SQLite setup disabled', async () => {
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);
			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--mode=mount-only',
						'--skip-sqlite-setup',
						'--verbosity=quiet',
						'--port=0',
					])
				).rejects.toThrow(
					'The --skipSqliteSetup option is not supported in Blueprint V2 mode.'
				);
			} finally {
				stderrSpy.mockRestore();
			}
		});

		test('should reject --mode with auto-mount', async () => {
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);
			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--mode=mount-only',
						'--auto-mount=.',
						'--verbosity=quiet',
						'--port=0',
					])
				).rejects.toThrow(
					'The --mode option cannot be used with --auto-mount because --auto-mount automatically sets the mode.'
				);
			} finally {
				stderrSpy.mockRestore();
			}
		});

		test('should be able to follow external symlinks in primary and secondary PHP instances', async ({
			skip,
		}) => {
			if (os.platform() === 'win32') {
				// @TODO: Find out why this test fails on Windows and fix it.
				// Issue here: https://github.com/WordPress/wordpress-playground/issues/2936
				skip();
			}

			const testArgs: Partial<RunCLIArgs> =
				version === 2
					? { allow: 'follow-symlinks' }
					: { followSymlinks: true };

			// TODO: Make sure test always uses a single worker.
			// TODO: Is there a way to confirm we are testing use of a non-primary PHP instance?
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			writeFileSync(
				path.join(tmpDir, 'sleep.php'),
				'<?php sleep(1); echo "Slept"; '
			);
			const symlinkPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'symlinking',
				'symlinked-script'
			);

			mkdirSync(path.dirname(symlinkPath), { recursive: true });

			try {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
				// TODO: Confirm that symlink target is outside of current working dir tree.
				symlinkSync(
					tmpDir,
					symlinkPath,
					// Use a junction on Windows to avoid elevated permissions requirement.
					os.platform() === 'win32' ? 'junction' : null
				);
				await using cliServer = await runCLI({
					...suiteCliArgs,
					...testArgs,
					debug: true,
					command: 'server',
					'mount-before-install': [
						{
							hostPath: symlinkPath,
							vfsPath: '/wordpress/wp-content/test-script',
						},
					],
				});
				// Make multiple simultaneous requests to force the use of a secondary PHP instance.
				// TODO: Find way to confirm this. Maybe a custom response header that announces the worker.
				const sleepUrl = new URL(
					'/wp-content/test-script/sleep.php',
					cliServer.serverUrl
				);
				const responses = await Promise.all([
					fetch(sleepUrl),
					fetch(sleepUrl),
					// Test a third request to hopefully test more than one secondary instance.
					fetch(sleepUrl),
				]);
				for (const response of responses) {
					expect(response.status).toBe(200);
					const text = await response.text();
					expect(text).toContain('Slept');
				}
			} finally {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
			}
		});

		// This is a sort of smoke test to confirm Blueprint steps run.
		// TODO: Consider testing all resource types here.
		test('should run blueprint including git:resources', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
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
			const response = await cliServer.playground.request({
				method: 'GET',
				url: '/',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toContain('My WordPress Website');
		});

		// Regression test: Playground must not write its own drop-ins
		// (db.php, object-cache.php, advanced-cache.php, sunrise.php)
		// into a user-mounted wp-content. Studio and other consumers
		// mount real wp-content directories into Playground, and any
		// Playground-managed file written at the wp-content root would
		// silently take over the user's external site.
		test('should not drop any new files at the wp-content root when wp-content is mounted', async () => {
			const hostWpContent = await mkdtemp(
				path.join(tmpdir(), 'playground-test-mount-wpcontent-')
			);
			// Minimal wp-content skeleton. `plugins/` and `themes/`
			// stay empty so WP's unzip step fills them in; any file
			// added at the root of hostWpContent after boot must come
			// from Playground itself.
			mkdirSync(path.join(hostWpContent, 'plugins'));
			mkdirSync(path.join(hostWpContent, 'themes'));
			writeFileSync(
				path.join(hostWpContent, 'index.php'),
				'<?php // Silence is golden.\n'
			);
			const filesBefore = new Set(readdirSync(hostWpContent));

			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					'mount-before-install': [
						{
							hostPath: hostWpContent,
							vfsPath: '/wordpress/wp-content',
						},
					],
				});

				// Confirm the site booted so we're actually exercising
				// the full boot → install flow, not a no-op path.
				const homeResponse = await fetch(
					new URL('/', cliServer.serverUrl)
				);
				expect(homeResponse.status).toBe(200);

				// No Playground-managed drop-in should appear at the
				// wp-content root. These four names cover the WP
				// drop-ins that a rogue Playground write could abuse.
				for (const dropIn of [
					'db.php',
					'object-cache.php',
					'advanced-cache.php',
					'sunrise.php',
				]) {
					expect(existsSync(path.join(hostWpContent, dropIn))).toBe(
						false
					);
				}

				// Belt-and-suspenders: any net-new *file* at the
				// wp-content root is a Playground drop-in regression.
				// Directories added by WordPress itself during install
				// (e.g. `database/` for the SQLite DB, `fonts/` for
				// the Fonts API, `upgrade/`) are legitimate and ignored.
				const filesAfter = new Set(readdirSync(hostWpContent));
				const unexpectedNewFiles = [...filesAfter]
					.filter((f) => !filesBefore.has(f))
					.filter(
						(f) =>
							!lstatSync(
								path.join(hostWpContent, f)
							).isDirectory()
					);
				expect(unexpectedNewFiles).toEqual([]);
			} finally {
				rmSync(hostWpContent, { recursive: true, force: true });
			}
		}, 120000);

		// Regression test: mounting files under /tmp (which is already
		// NODEFS-mounted to a shared host directory) used to race
		// across 6 workers and intermittently fail with ErrnoError 20
		// (ENOTDIR) when the concurrent NODEFS placeholder creation
		// collided on the host filesystem.
		test('should mount files under /tmp as post-install mounts without ENOTDIR', async () => {
			const hostTmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-mount-')
			);

			const mounts = [];
			for (let i = 0; i < 5; i++) {
				const hostSubDir = path.join(hostTmpDir, `migration-${i}`);
				mkdirSync(hostSubDir, { recursive: true });
				const hostFilePath = path.join(
					hostSubDir,
					'.import-state.json'
				);
				writeFileSync(hostFilePath, `{"index":${i}}`);
				mounts.push({
					hostPath: hostFilePath,
					vfsPath: `/tmp/migration-${i}/.import-state.json`,
				});
			}

			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					mount: mounts,
				});
				expect(cliServer.serverUrl).toBeTruthy();
			} finally {
				rmSync(hostTmpDir, { recursive: true, force: true });
			}
		});

		// Render a value as a PHP single-quoted string literal. Only
		// backslashes and single quotes need escaping, so the generated
		// code stays valid PHP for any embedded value.
		const phpString = (value: string) =>
			`'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

		// Build a PHP script that runs `scriptPath` in a child PHP process via
		// proc_open() — the code path the regression tests below guard — and
		// echoes `prefix` followed by the child's trimmed stdout. A failed
		// spawn and any stderr output are surfaced in the echoed text so a
		// broken spawn produces actionable test diagnostics. `preamble` runs
		// before the spawn, for tests that need to set the scene first.
		const phpSpawningChildScript = (
			prefix: string,
			scriptPath: string,
			preamble = ''
		) =>
			`<?php
			${preamble}
			$proc = proc_open(
				escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(${phpString(scriptPath)}),
				[1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
				$pipes
			);
			if ($proc === false) {
				echo ${phpString(prefix)} . ':PROC_OPEN_FAILED';
				exit(1);
			}
			$stdout = (string) stream_get_contents($pipes[1]);
			$stderr = (string) stream_get_contents($pipes[2]);
			fclose($pipes[1]);
			fclose($pipes[2]);
			proc_close($proc);
			echo ${phpString(prefix)} . ':' . trim($stdout);
			if ($stderr !== '') {
				echo ' [stderr: ' . trim($stderr) . ']';
			}`;

		// Regression test: files provided via post-install --mount used to be
		// invisible to child PHP processes spawned with proc_open()/system(),
		// because the spawned worker never installs WordPress itself and so
		// skipped applying the post-install mounts.
		test('child processes spawned via proc_open() see post-install --mount files', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-mount-')
			);
			try {
				// A PHP script that exists only inside the mounted host
				// directory. If the spawned child cannot see the mount it
				// cannot even load this file ("Could not open input file").
				writeFileSync(
					path.join(hostDir, 'child.php'),
					`<?php echo 'CHILD_SAW_MOUNT';`
				);

				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					mount: [
						{
							hostPath: hostDir,
							vfsPath: '/wordpress/wp-content/probe',
						},
					],
				});

				// Served by the primary worker (which sees the mount). It
				// spawns a child via proc_open() that runs the PHP file
				// located in the post-install mount.
				await cliServer.playground.writeFile(
					'/wordpress/probe-parent.php',
					phpSpawningChildScript(
						'PARENT',
						'/wordpress/wp-content/probe/child.php'
					)
				);

				const response = await fetch(
					new URL('/probe-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				const text = await response.text();
				// The child could load and run the script from the mount.
				expect(text).toContain('CHILD_SAW_MOUNT');
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// A grandchild is booted by a child worker, which itself never installed
		// WordPress. It learns whether to apply the post-install mounts only by
		// inheriting that state down the spawn chain, so a mount visible to the
		// parent must remain visible two levels down.
		test('grandchild processes spawned via nested proc_open() see post-install --mount files', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-mount-gc-')
			);
			try {
				writeFileSync(
					path.join(hostDir, 'grandchild.php'),
					`<?php echo 'GRANDCHILD_SAW_MOUNT';`
				);

				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					mount: [
						{
							hostPath: hostDir,
							vfsPath: '/wordpress/wp-content/probe',
						},
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/gc-mount-child.php',
					phpSpawningChildScript(
						'CHILD',
						'/wordpress/wp-content/probe/grandchild.php'
					)
				);
				await cliServer.playground.writeFile(
					'/wordpress/gc-mount-parent.php',
					phpSpawningChildScript(
						'PARENT',
						'/wordpress/gc-mount-child.php'
					)
				);

				const response = await fetch(
					new URL('/gc-mount-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				expect(await response.text()).toContain('GRANDCHILD_SAW_MOUNT');
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// Mounting a single file rather than a directory takes a different code
		// path in mountResources(), and it is the shape real tooling uses for
		// state files (see the `.import-state.json` mounts elsewhere in this
		// suite). A child must see the file, not just the directory case.
		test('child processes spawned via proc_open() see single-file post-install --mount', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-mount-file-')
			);
			try {
				writeFileSync(
					path.join(hostDir, 'state.json'),
					JSON.stringify({ marker: 'CHILD_SAW_MOUNTED_FILE' })
				);

				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					mount: [
						{
							hostPath: path.join(hostDir, 'state.json'),
							vfsPath: '/wordpress/wp-content/state.json',
						},
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/file-mount-child.php',
					`<?php
					$raw = @file_get_contents('/wordpress/wp-content/state.json');
					if ($raw === false) {
						echo 'CHILD_COULD_NOT_READ_MOUNTED_FILE';
					} else {
						echo json_decode($raw, true)['marker'];
					}`
				);
				await cliServer.playground.writeFile(
					'/wordpress/file-mount-parent.php',
					phpSpawningChildScript(
						'PARENT',
						'/wordpress/file-mount-child.php'
					)
				);

				const response = await fetch(
					new URL('/file-mount-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				expect(await response.text()).toContain(
					'CHILD_SAW_MOUNTED_FILE'
				);
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// The parent and child mount the same host directory through separate
		// NODEFS mounts in separate workers. A write made by the parent must be
		// visible to the child it then spawns — otherwise tooling that stages a
		// file and shells out to consume it (wp-cli, PHPUnit bootstraps) breaks.
		test('a child process sees writes its parent made through a mount', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-mount-rw-')
			);
			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					mount: [
						{
							hostPath: hostDir,
							vfsPath: '/wordpress/wp-content/shared',
						},
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/rw-child.php',
					`<?php
					$raw = @file_get_contents('/wordpress/wp-content/shared/from-parent.txt');
					echo $raw === false ? 'CHILD_MISSED_PARENT_WRITE' : trim($raw);`
				);
				await cliServer.playground.writeFile(
					'/wordpress/rw-parent.php',
					phpSpawningChildScript(
						'PARENT',
						'/wordpress/rw-child.php',
						`file_put_contents(
							'/wordpress/wp-content/shared/from-parent.txt',
							'CHILD_SAW_PARENT_WRITE'
						);`
					)
				);

				const response = await fetch(
					new URL('/rw-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				expect(await response.text()).toContain(
					'CHILD_SAW_PARENT_WRITE'
				);
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// followSymlinks is part of the platform config a spawning worker
		// forwards to its children. If it were dropped on the way down, a child
		// would refuse to load a script reached through a symlinked mount while
		// the parent loaded it happily.
		test('child processes spawned via proc_open() honour --follow-symlinks in mounts', async ({
			skip,
		}) => {
			if (os.platform() === 'win32') {
				// Same reason as the primary-instance symlink test above.
				// https://github.com/WordPress/wordpress-playground/issues/2936
				skip();
			}

			const targetDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-symlink-')
			);
			const symlinkPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'symlinking',
				'spawned-child-script'
			);
			mkdirSync(path.dirname(symlinkPath), { recursive: true });

			try {
				writeFileSync(
					path.join(targetDir, 'child.php'),
					`<?php echo 'CHILD_FOLLOWED_SYMLINK';`
				);
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
				symlinkSync(targetDir, symlinkPath, null);

				await using cliServer = await runCLI({
					...suiteCliArgs,
					...(version === 2
						? { allow: 'follow-symlinks' }
						: { followSymlinks: true }),
					command: 'server',
					mount: [
						{
							hostPath: symlinkPath,
							vfsPath: '/wordpress/wp-content/linked',
						},
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/symlink-parent.php',
					phpSpawningChildScript(
						'PARENT',
						'/wordpress/wp-content/linked/child.php'
					)
				);

				const response = await fetch(
					new URL('/symlink-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				expect(await response.text()).toContain(
					'CHILD_FOLLOWED_SYMLINK'
				);
			} finally {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
				rmSync(targetDir, { recursive: true, force: true });
			}
		}, 120000);

		// A whole-file flock() cannot tell us whether the child reached the
		// shared lock manager: the native layer implements it with flock(2),
		// whose locks are per open-file-description and therefore already
		// conflict between two worker threads of the same OS process. Only
		// byte-range locks discriminate — the native layer implements those
		// with fcntl(), whose POSIX record locks are per-PROCESS and so never
		// conflict between workers. Cross-worker arbitration of a byte range
		// exists only in the shared (wasm) lock manager.
		//
		// SQLite takes exactly such a byte-range lock for its RESERVED lock,
		// so `BEGIN IMMEDIATE` on a database in a NodeFS mount is a faithful
		// way to reach lockFileByteRange() from PHP.
		//
		// The database lives in a `mount-before-install` mount, which spawned
		// children already receive, so these tests stay independent of the
		// post-install --mount fix above.

		// Take a SQLite RESERVED (byte-range) lock, reporting whether it was
		// granted and how long the attempt took.
		const phpTakeByteRangeLock = (label: string, dbPath: string) =>
			`$t = microtime(true);
			try {
				$pdo = new PDO('sqlite:${dbPath}', null, null, [
					PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
					PDO::ATTR_TIMEOUT => 0,
				]);
				$pdo->exec('BEGIN IMMEDIATE');
				$pdo->exec('INSERT INTO t (v) VALUES (2)');
				$r = '${label}_ACQUIRED';
			} catch (Throwable $e) {
				$r = '${label}_DENIED';
			}
			$ms = (int) round((microtime(true) - $t) * 1000);
			echo $r . " {${label}_MS:{$ms}} ";`;

		// Assert the spawned process was denied the lock *and* was denied it
		// promptly. A child that cannot reach the lock manager at all times out
		// after the 5s comlink-sync deadline, which also surfaces as a denial —
		// so the elapsed time is what separates "arbitrated" from "timed out".
		const expectDeniedPromptly = (text: string, label: string) => {
			expect(text).toContain(`${label}_DENIED`);
			const elapsed = Number(
				text.match(new RegExp(`\\{${label}_MS:(\\d+)\\}`))?.[1]
			);
			expect(elapsed).toBeLessThan(2000);
		};

		// Set up a SQLite database in `hostDir` and take a RESERVED lock on it
		// that is held across the spawn of `scriptPath`.
		const phpHoldLockAndSpawn = (dbPath: string, scriptPath: string) =>
			`<?php
			$pdo = new PDO('sqlite:${dbPath}', null, null, [
				PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			]);
			$pdo->exec('CREATE TABLE IF NOT EXISTS t (v INT)');
			$pdo->exec('BEGIN IMMEDIATE');
			$pdo->exec('INSERT INTO t (v) VALUES (1)');

			$proc = proc_open(
				escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg('${scriptPath}'),
				[1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
				$pipes
			);
			$out = trim((string) stream_get_contents($pipes[1]));
			$err = trim((string) stream_get_contents($pipes[2]));
			fclose($pipes[1]);
			fclose($pipes[2]);
			proc_close($proc);

			try {
				$pdo->exec('COMMIT');
				$commit = 'PARENT_COMMIT_OK';
			} catch (Throwable $e) {
				$commit = 'PARENT_COMMIT_FAILED';
			}
			echo $out . ' ' . $commit;
			if ($err !== '') {
				echo ' [stderr: ' . $err . ']';
			}`;

		// Regression test: a child PHP process spawned via proc_open()/system()
		// was handed the spawning worker's own file-lock-manager *proxy* where a
		// MessagePort was expected. Comlink serialized it into a port backed by
		// an async expose() in the spawning worker, which never answers the
		// synchronous protocol consumeAPISync() speaks. The child therefore
		// either raced past it and booted with a native-only lock manager (no
		// shared broker at all), or bound the broken proxy and timed out after
		// 5s on every call. In the first case the child could steal a byte-range
		// lock the parent held, corrupting the parent's SQLite transaction.
		test('child processes spawned via proc_open() participate in the shared file lock manager', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-lock-')
			);
			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					'mount-before-install': [
						{ hostPath: hostDir, vfsPath: '/tmp/locks' },
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/lock-child.php',
					`<?php ${phpTakeByteRangeLock('CHILD', '/tmp/locks/lock.db')}`
				);
				await cliServer.playground.writeFile(
					'/wordpress/lock-parent.php',
					phpHoldLockAndSpawn(
						'/tmp/locks/lock.db',
						'/wordpress/lock-child.php'
					)
				);

				const response = await fetch(
					new URL('/lock-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				const text = await response.text();

				// The parent holds the RESERVED lock, so the child must be denied.
				expectDeniedPromptly(text, 'CHILD');
				// And the parent's transaction must survive the child's attempt.
				expect(text).toContain('PARENT_COMMIT_OK');
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// Regression test: a spawned child must itself be able to spawn a
		// grandchild (PHP that shells out to PHP that shells out to PHP), and
		// the grandchild must reach the same shared lock manager.
		test('grandchild processes spawned via nested proc_open() participate in the shared file lock manager', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-lock-gc-')
			);
			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					'mount-before-install': [
						{ hostPath: hostDir, vfsPath: '/tmp/locks' },
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/gc.php',
					`<?php ${phpTakeByteRangeLock('GRANDCHILD', '/tmp/locks/lock.db')}`
				);
				await cliServer.playground.writeFile(
					'/wordpress/child.php',
					phpSpawningChildScript('CHILD', '/wordpress/gc.php')
				);
				await cliServer.playground.writeFile(
					'/wordpress/parent.php',
					phpHoldLockAndSpawn(
						'/tmp/locks/lock.db',
						'/wordpress/child.php'
					)
				);

				const response = await fetch(
					new URL('/parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				const text = await response.text();

				expectDeniedPromptly(text, 'GRANDCHILD');
				expect(text).toContain('PARENT_COMMIT_OK');
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// A writer holding SQLite's RESERVED lock must not shut readers out —
		// SQLite lets readers continue until the writer escalates at COMMIT. If
		// the shared lock manager degenerated into a coarse "one process at a
		// time" mutex, the tests above would still pass while real WordPress
		// workloads ground to a halt. This pins the shared/exclusive
		// distinction across the spawn boundary.
		test('a child process can still read while its parent holds a write lock', async () => {
			const hostDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-spawn-lock-shared-')
			);
			try {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					'mount-before-install': [
						{ hostPath: hostDir, vfsPath: '/tmp/locks' },
					],
				});

				await cliServer.playground.writeFile(
					'/wordpress/read-child.php',
					`<?php
					try {
						$pdo = new PDO('sqlite:/tmp/locks/lock.db', null, null, [
							PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
							PDO::ATTR_TIMEOUT => 0,
						]);
						$rows = $pdo->query('SELECT COUNT(*) FROM t')->fetchColumn();
						// The parent's INSERT is uncommitted, so a correctly
						// isolated reader sees zero rows rather than one.
						echo 'CHILD_READ_OK rows=' . $rows;
					} catch (Throwable $e) {
						echo 'CHILD_READ_DENIED';
					}`
				);
				await cliServer.playground.writeFile(
					'/wordpress/read-parent.php',
					phpHoldLockAndSpawn(
						'/tmp/locks/lock.db',
						'/wordpress/read-child.php'
					)
				);

				const response = await fetch(
					new URL('/read-parent.php', cliServer.serverUrl)
				);
				expect(response.status).toBe(200);
				const text = await response.text();

				expect(text).toContain('CHILD_READ_OK rows=0');
				expect(text).toContain('PARENT_COMMIT_OK');
			} finally {
				rmSync(hostDir, { recursive: true, force: true });
			}
		}, 120000);

		// Every spawned child costs a worker thread and three MessagePorts, all
		// held by the main thread until the spawning worker reaps the child. A
		// `playground server` that shells out on every request would exhaust the
		// process if reaping regressed, and nothing else in this suite would
		// notice: the requests would keep succeeding right up until they didn't.
		test('spawning many child processes leaks neither workers nor process ids', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
			});

			const spawnCount = 20;

			// Each child reports its process id. The main thread mints one per
			// child so that two *live* PHP instances can never share OS-level
			// file locks, and returns it to the pool when the worker exits.
			await cliServer.playground.writeFile(
				'/wordpress/pid-child.php',
				`<?php echo getmypid();`
			);
			await cliServer.playground.writeFile(
				'/wordpress/pid-parent.php',
				`<?php
				$pids = [];
				for ($i = 0; $i < ${spawnCount}; $i++) {
					$proc = proc_open(
						escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg('/wordpress/pid-child.php'),
						[1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
						$pipes
					);
					$pids[] = trim((string) stream_get_contents($pipes[1]));
					fclose($pipes[1]);
					fclose($pipes[2]);
					proc_close($proc);
				}
				echo 'PARENT_PID:' . getmypid() . ' CHILD_PIDS:' . implode(',', $pids);`
			);

			const response = await fetch(
				new URL('/pid-parent.php', cliServer.serverUrl)
			);
			expect(response.status).toBe(200);
			const text = await response.text();

			const parentPid = text.match(/PARENT_PID:(\d+)/)?.[1];
			const childPids =
				text.match(/CHILD_PIDS:([\d,]+)/)?.[1].split(',') ?? [];

			expect(childPids).toHaveLength(spawnCount);

			// A child must never run under the process id of a worker that is
			// still alive, or the two would share OS-level file locks.
			expect(childPids).not.toContain(parentPid);

			// Process ids are released back to the pool when a child worker
			// exits, so sequential spawns reuse a handful of them. Seeing all
			// `spawnCount` ids distinct would mean no child ever exited — i.e.
			// the spawning worker stopped reaping them.
			expect(new Set(childPids).size).toBeLessThan(spawnCount);

			// Reaping is fire-and-forget from the spawning worker, so the main
			// thread may still be tearing the last children down.
			await vi.waitFor(
				() => {
					expect(
						cliServer[internalsKeyForTesting].liveChildWorkerCount()
					).toBe(0);
				},
				{ timeout: 10000 }
			);
		}, 180000);

		// When a child worker fails to load, the main thread's spawn helper
		// emits 'error' (rejecting the spawn) and then 'exit'. Its exit handler
		// must not reach for the SpawnedWorker that was never constructed —
		// doing so throws a ReferenceError out of an EventEmitter callback,
		// which is an uncaught exception that takes down the whole CLI rather
		// than failing the one proc_open() that asked for the child.
		test('a child worker that fails to load surfaces an error instead of crashing the CLI', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
			});

			await cliServer.playground.writeFile(
				'/wordpress/spawn.php',
				phpSpawningChildScript('PARENT', '/wordpress/spawn-child.php')
			);
			await cliServer.playground.writeFile(
				'/wordpress/spawn-child.php',
				`<?php echo 'CHILD_RAN';`
			);

			// A failed spawn must reject the caller's promise, never throw out
			// of the worker's 'exit' listener. An exception raised there is an
			// uncaught exception: fatal in the real CLI, and merely reported by
			// the test runner here, so assert on it rather than trusting a pass.
			const uncaughtExceptions: Error[] = [];
			const recordUncaught = (error: Error) =>
				uncaughtExceptions.push(error);
			process.on('uncaughtException', recordUncaught);

			// The primary request workers have already booted from the real
			// worker URL. Point only the *child* spawns at a module that does
			// not exist, so the next proc_open() hits the failed-load path.
			// spawnWorkerThread() reads this global each time it spawns, so the
			// override affects only spawns made while it is in place.
			const workerUrlKey =
				version === 2 ? '__WORKER_V2_URL__' : '__WORKER_V1_URL__';
			const realWorkerUrl = (globalThis as any)[workerUrlKey];
			(globalThis as any)[workerUrlKey] =
				'./worker-thread-that-does-not-exist.ts';

			let textWhileBroken: string;
			try {
				const brokenResponse = await fetch(
					new URL('/spawn.php', cliServer.serverUrl)
				);
				textWhileBroken = await brokenResponse.text();
			} finally {
				(globalThis as any)[workerUrlKey] = realWorkerUrl;
				process.off('uncaughtException', recordUncaught);
			}

			expect(uncaughtExceptions).toEqual([]);

			// The child never ran, and the failure stayed inside the request.
			expect(textWhileBroken).not.toContain('CHILD_RAN');

			// The CLI is still alive and still able to spawn children.
			const recoveredResponse = await fetch(
				new URL('/spawn.php', cliServer.serverUrl)
			);
			expect(recoveredResponse.status).toBe(200);
			expect(await recoveredResponse.text()).toContain('CHILD_RAN');

			// The failed spawn left nothing behind.
			await vi.waitFor(
				() => {
					expect(
						cliServer[internalsKeyForTesting].liveChildWorkerCount()
					).toBe(0);
				},
				{ timeout: 10000 }
			);
		}, 180000);

		// TODO: Test resolving absolute symlinks within a mounted dir with and without follow-symlinks

		describe('auto-mount', () => {
			const getDirectoryChecksum = async (dir: string) => {
				const hash = createHash('sha256');
				for (const file of readdirSync(dir)) {
					hash.update(file);
				}
				return hash.digest('hex');
			};
			const getActiveTheme = async (cliServer: RunCLIServer) => {
				const response = await cliServer.playground.run({
					code: `<?php
					require_once '/wordpress/wp-load.php';
					$theme = wp_get_theme();
					echo $theme->get('Name');
				?>`,
				});
				return response.text;
			};
			afterEach(() => {
				if ((process.cwd as unknown as MockInstance).mockRestore) {
					(process.cwd as unknown as MockInstance).mockRestore();
				}
			});

			test(`should run a plugin project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'plugin')
				);
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const phpResponse = await cliServer.playground.run({
					code: `<?php
					require_once '/wordpress/wp-load.php';
					require_once '/wordpress/wp-admin/includes/plugin.php';
					echo is_plugin_active('plugin/sample-plugin.php') ? '1' : '0';
				?>`,
				});
				expect(phpResponse.text).toBe('1');

				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});
			test(`should run a theme project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'theme')
				);
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});

				expect(await getActiveTheme(cliServer)).toBe('Yolo Theme');

				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});

			test(`should run a wp-content project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(
						import.meta.dirname,
						'mount-examples',
						'wp-content'
					)
				);
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const loginUrl = new URL('/wp-login.php', cliServer.serverUrl);
				const response = await fetch(loginUrl);
				expect(response.status).toBe(200);
			});

			test('should run a php project using --auto-mount', async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'php')
				);
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain('Hello world');
			});

			test('should run a wordpress project using --auto-mount', async ({
				skip,
			}) => {
				if (os.platform() === 'win32') {
					// @TODO: Find out why this test fails on Windows and fix it.
					skip();
				}

				const tmpDir = await mkdtemp(
					path.join(tmpdir(), 'playground-test-')
				);
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(tmpDir, 'wordpress')
				);

				const zip = await fetch('https://wordpress.org/latest.zip');
				const zipPath = path.join(tmpDir, 'wp.zip');
				await writeFile(
					zipPath,
					new Uint8Array(await zip.arrayBuffer())
				);
				await extractZip(zipPath, tmpDir);

				const checksum = await getDirectoryChecksum(tmpDir);

				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);

				/**
				 * Playground should not modify the mounted directory.
				 */
				expect(await getDirectoryChecksum(tmpDir)).toBe(checksum);
			});
		});

		describe('verbosity', () => {
			let output: string[];
			// Track cliServer at describe level for cleanup even if tests timeout
			let cliServer: RunCLIServer | undefined;

			function logToVariable(log: Log, arg?: string) {
				output.push(`${log.message}${arg ? arg : ''}`);
			}

			beforeAll(() => {
				// @ts-ignore
				logger.handlers = [logToVariable];
			});

			beforeEach(() => {
				output = [];
			});

			afterEach(async () => {
				if (cliServer) {
					await cliServer[Symbol.asyncDispose]();
					cliServer = undefined;
				}
			}, 30000);

			test('should start server successfully with default verbosity', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
				});

				// With the new CLIOutput system, most user-facing messages
				// go to stdout via CLIOutput rather than through the logger.
				// Logger is now primarily used for debug information.
				// Just verify the server started successfully.
				expect(cliServer).toBeDefined();
				expect(cliServer.serverUrl).toMatch(
					/^http:\/\/127\.0\.0\.1:\d+$/
				);
			});

			// Skip WordPress setup for verbosity tests - they only check logging behavior.
			// For v1, use wordpressInstallMode. For v2, explicitly set mode.
			const skipWordPressSetup =
				version === 2
					? { mode: 'mount-only' as const }
					: {
							wordpressInstallMode:
								'do-not-attempt-installing' as const,
							skipSqliteSetup: true,
							blueprint: undefined,
						};

			test('should not output debug logs with verbosity option set to normal', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'normal',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).not.toContain(test);
			});

			test('should output debug logs bridge with verbosity option set to debug', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'debug',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).toContain(test);
			});

			test('should not output logs when verbosity option set to quiet', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'quiet',
				});

				expect(output).toEqual([]);
			});
		});

		describe('pathAliases', () => {
			// Skip WordPress setup for pathAliases tests - they only need
			// the server running, not a full WordPress installation.
			const skipWordPressSetupForPathAliases =
				version === 2
					? { mode: 'mount-only' as const }
					: {
							wordpressInstallMode:
								'do-not-attempt-installing' as const,
							skipSqliteSetup: true,
							blueprint: undefined,
						};

			test('should serve static and PHP files from a path alias', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetupForPathAliases,
					command: 'server',
					pathAliases: [
						{
							urlPrefix: '/my-alias',
							fsPath: '/tools/my-alias',
						},
					],
				});

				// Create the aliased directory and populate it with test files
				await cliServer.playground.mkdir('/tools/my-alias');
				await cliServer.playground.writeFile(
					'/tools/my-alias/hello.txt',
					'Hello from alias!'
				);
				await cliServer.playground.writeFile(
					'/tools/my-alias/info.php',
					'<?php echo "PHP works in alias"; ?>'
				);

				// Verify static file is served from the alias
				const staticUrl = new URL(
					'/my-alias/hello.txt',
					cliServer.serverUrl
				);
				const staticResponse = await fetch(staticUrl);
				expect(staticResponse.status).toBe(200);
				expect(await staticResponse.text()).toContain(
					'Hello from alias!'
				);

				// Verify PHP file is executed and served from the alias
				const phpUrl = new URL(
					'/my-alias/info.php',
					cliServer.serverUrl
				);
				const phpResponse = await fetch(phpUrl);
				expect(phpResponse.status).toBe(200);
				expect(await phpResponse.text()).toContain(
					'PHP works in alias'
				);
			});
		});

		describe('phpMyAdmin', () => {
			async function expectPhpMyAdminAlias(
				cliServer: RunCLIServer,
				urlPrefix: string
			) {
				const probeFile = 'playground-alias-check.txt';
				await cliServer.playground.writeFile(
					`${PHPMYADMIN_INSTALL_PATH}/${probeFile}`,
					'phpMyAdmin alias works'
				);

				const probeUrl = new URL(
					`${urlPrefix}/${probeFile}`,
					cliServer.serverUrl
				);
				const response = await fetch(probeUrl);
				expect(response.status).toBe(200);
				expect(await response.text()).toBe('phpMyAdmin alias works');
			}

			test('should install phpMyAdmin when --phpmyadmin flag is set', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: '/phpmyadmin',
				});

				// Verify phpMyAdmin directory was created
				const phpMyAdminExists = await cliServer.playground.isDir(
					PHPMYADMIN_INSTALL_PATH
				);
				expect(phpMyAdminExists).toBe(true);

				// Verify the custom DbiMysqli.php driver was installed
				const dbiMysqliExists = await cliServer.playground.fileExists(
					`${PHPMYADMIN_INSTALL_PATH}/libraries/classes/Dbal/DbiMysqli.php`
				);
				expect(dbiMysqliExists).toBe(true);

				// Verify config.inc.php was installed
				const configExists = await cliServer.playground.fileExists(
					`${PHPMYADMIN_INSTALL_PATH}/config.inc.php`
				);
				expect(configExists).toBe(true);

				// Verify phpMyAdmin is accessible via rewrite rule
				await expectPhpMyAdminAlias(cliServer, '/phpmyadmin');
			}, 120000);

			test('should not install phpMyAdmin when flag is not set', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
				});

				// Verify phpMyAdmin directory was NOT created
				const phpMyAdminExists = await cliServer.playground.isDir(
					PHPMYADMIN_INSTALL_PATH
				);
				expect(phpMyAdminExists).toBe(false);
			}, 120000);

			test('should default to /phpmyadmin path when phpmyadmin is set to true', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: true,
				});

				// When phpmyadmin is true (boolean), it should default to /phpmyadmin
				await expectPhpMyAdminAlias(cliServer, '/phpmyadmin');
			}, 120000);

			test('should install phpMyAdmin at a custom path', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: '/db-admin',
				});

				// Verify phpMyAdmin is accessible at the custom path
				await expectPhpMyAdminAlias(cliServer, '/db-admin');
			}, 120000);
		});
	},
	60_000 * 5
);

test('should execute v2 blueprints through the CLI server', async () => {
	await using cliServer = await runCLI({
		command: 'server',
		workers: 1,
		blueprint: {
			version: 2,
			siteOptions: {
				blogname: 'V2 CLI Smoke',
			},
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'site:v2-cli-smoke.php': {
							filename: 'v2-cli-smoke.php',
							content:
								'<?php require __DIR__ . "/wp-load.php"; echo get_option("blogname");',
						},
					},
				},
			],
		},
	});
	const response = await fetch(
		new URL('/v2-cli-smoke.php', cliServer.serverUrl)
	);

	expect(response.status).toBe(200);
	expect(await response.text()).toBe('V2 CLI Smoke');
}, 120000);

describe('native Blueprint v2 modes', () => {
	fullNativeBlueprintV2ModeTest(
		'should support --mode=create-new-site',
		async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			try {
				await using cliServer = await runCLI({
					command: 'server',
					workers: 1,
					mode: 'create-new-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain('<title>My WordPress Website</title>');
				const wpContentDirPath = path.join(tmpDir, 'wp-content');
				expect(lstatSync(wpContentDirPath)?.isDirectory()).toBe(true);
			} finally {
				rmSync(tmpDir, { recursive: true, force: true });
			}
		}
	);

	fullNativeBlueprintV2ModeTest(
		'should support --mode=apply-to-existing-site',
		async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);

			try {
				await using cliServer = await runCLI({
					command: 'server',
					workers: 1,
					mode: 'create-new-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				// Confirm the new site looks intact with its WP installed.
				const homeUrl = new URL('/', cliServer.serverUrl);
				const setupResponse = await fetch(homeUrl);
				expect(setupResponse.status).toBe(200);
				const setupText = await setupResponse.text();
				expect(setupText).toContain(
					'<title>My WordPress Website</title>'
				);

				// eslint-disable-next-line
				await using existingSiteServer = await runCLI({
					command: 'server',
					workers: 1,
					mode: 'apply-to-existing-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				const existingSiteUrl = new URL(
					'/',
					existingSiteServer.serverUrl
				);
				const redirectResponse = await fetch(existingSiteUrl);
				expect(redirectResponse.status).toBe(200);
				const redirectText = await redirectResponse.text();
				expect(redirectText).toContain(
					'<title>My WordPress Website</title>'
				);
			} finally {
				rmSync(tmpDir, { recursive: true, force: true });
			}
		}
	);
});

describe('start command', () => {
	test('should work with default options', async () => {
		// The start command internally runs as 'server' with auto-mount enabled
		await using cliServer = await runCLI({
			command: 'server',
			// Simulating what 'start' command does:
			// - enables auto-mount with current directory
			// - enables login by default
			// - enables intl
			login: true,
			intl: true,
			// Skip WordPress setup for speed since we're just testing the command structure
			wordpressInstallMode: 'do-not-attempt-installing',
			skipSqliteSetup: true,
			blueprint: undefined,
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
	});

	test('should persist site in home directory', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		await using cliServer = await runCLI({
			command: 'start',
			skipBrowser: true,
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

		// Verify the site directory was created
		expect(existsSync(expectedSitePath)).toBe(true);
		expect(lstatSync(expectedSitePath).isDirectory()).toBe(true);

		// Verify WordPress files exist in the persisted directory
		const wpContentPath = path.join(expectedSitePath, 'wp-content');
		expect(existsSync(wpContentPath)).toBe(true);
		expect(lstatSync(wpContentPath).isDirectory()).toBe(true);

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 120000);

	test('should reuse existing persisted site on subsequent runs', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		// First run - create the site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Add a marker file to verify the site is reused
			await cliServer.playground.writeFile(
				'/wordpress/marker.txt',
				'site-marker'
			);
		}

		// Second run - should reuse the same site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Verify the marker file exists
			const markerExists = await cliServer.playground.fileExists(
				'/wordpress/marker.txt'
			);
			expect(markerExists).toBe(true);

			if (markerExists) {
				const markerContent = await cliServer.playground.readFileAsText(
					'/wordpress/marker.txt'
				);
				expect(markerContent).toBe('site-marker');
			}
		}

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 180000);

	test('should reset site when --reset is provided', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		// First run - create the site with a marker
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Add a marker file
			await cliServer.playground.writeFile(
				'/wordpress/marker.txt',
				'should-be-deleted'
			);
		}

		// Second run with --reset - should delete the old site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
				reset: true,
			});

			// Verify the marker file does not exist
			const markerExists = await cliServer.playground.fileExists(
				'/wordpress/marker.txt'
			);
			expect(markerExists).toBe(false);
		}

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 180000);

	test('resetting an unmanaged site rejects with a descriptive, catchable error', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const wordpressDir = path.join(tmpDir, 'wordpress-custom');
		mkdirSync(wordpressDir, { recursive: true });

		let caught: any;
		try {
			await runCLI({
				command: 'start',
				skipBrowser: true,
				reset: true,
				autoMount: false,
				'mount-before-install': [
					{ hostPath: wordpressDir, vfsPath: '/wordpress' },
				],
			});
		} catch (e) {
			caught = e;
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}

		// A direct library caller receives a meaningful message and exit
		// code, not the validation sentinel's empty-message form.
		expect(caught).toBeDefined();
		expect(caught.message).toContain(
			'This site is not managed by Playground CLI and cannot be reset.'
		);
		expect(caught.exitCode).toBe(1);
	});

	// Colon-delimited --mount can't express a Windows drive-letter host
	// path (C:\...), so this end-to-end CLI check is POSIX-only. The
	// cross-platform coverage is the runCLI test above.
	test.skipIf(process.platform === 'win32')(
		'parseOptionsAndRunCLI exits cleanly (no stack dump) when resetting an unmanaged site',
		async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			const wordpressDir = path.join(tmpDir, 'wordpress-custom');
			mkdirSync(wordpressDir, { recursive: true });
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			try {
				const result = await parseOptionsAndRunCLI([
					'start',
					'--reset',
					'--no-auto-mount',
					'--skip-browser',
					'--mount',
					`${wordpressDir}:/wordpress`,
				]);
				expect('exitCode' in result).toBe(true);
				expect((result as CLIExitResult).exitCode).toBe(1);
				// The expected validation case is converted to a clean exit,
				// not routed through the unexpected-error path that
				// console.error's a full stack trace.
				expect(consoleErrorSpy).not.toHaveBeenCalled();
			} finally {
				consoleErrorSpy.mockRestore();
				rmSync(tmpDir, { recursive: true, force: true });
			}
		}
	);

	test('should not persist when using explicit mount for /wordpress', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const wordpressDir = path.join(tmpDir, 'wordpress-custom');
		mkdirSync(wordpressDir, { recursive: true });

		// When we explicitly mount /wordpress, the site should be stored there,
		// not in ~/.wordpress-playground/sites/
		await using cliServer = await runCLI({
			command: 'start',
			skipBrowser: true,
			'mount-before-install': [
				{
					hostPath: wordpressDir,
					vfsPath: '/wordpress',
				},
			],
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

		// Verify WordPress files are in the explicit mount location
		const wpContentPath = path.join(wordpressDir, 'wp-content');
		expect(existsSync(wpContentPath)).toBe(true);
		expect(lstatSync(wpContentPath).isDirectory()).toBe(true);
	}, 120000);

	test('should accept --no-auto-mount and skip auto-detection', async () => {
		// Regression test: yargs-parser's boolean-negation turns
		// `--no-auto-mount` into `{ autoMount: false }`. When the start
		// command declared a literal `no-auto-mount` option (with no
		// matching `auto-mount`), strictOptions rejected the negated key
		// with `Unknown arguments: auto-mount, autoMount`.
		const tmpDir = await mkdtemp(
			path.join(tmpdir(), 'playground-test-no-auto-mount-')
		);
		const pluginDirName = 'sample-plugin';
		const pluginDir = path.join(tmpDir, pluginDirName);
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			path.join(pluginDir, `${pluginDirName}.php`),
			`<?php\n/*\nPlugin Name: Sample Plugin\n*/\n`
		);

		// Throw instead of no-op so any unexpected `process.exit` during
		// startup fails the test loudly instead of silently continuing in
		// an inconsistent state.
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
			code?: number | string | null
		) => {
			throw new Error(`process.exit unexpectedly called with "${code}"`);
		}) as any);

		try {
			await using cliResult = (await parseOptionsAndRunCLI([
				'start',
				`--path=${pluginDir}`,
				'--no-auto-mount',
				'--skip-browser',
			])) as CLIServerResult;
			const cliServer = cliResult[internalsKeyForTesting].cliServer;

			// Server started → yargs accepted `--no-auto-mount`.
			expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

			// Auto-mount did not fire → the plugin is not present under
			// /wordpress/wp-content/plugins/.
			const autoMountedPluginExists = await cliServer.playground.isDir(
				`/wordpress/wp-content/plugins/${pluginDirName}`
			);
			expect(autoMountedPluginExists).toBe(false);
		} finally {
			exitSpy.mockRestore();
			rmSync(tmpDir, { recursive: true, force: true });
		}
	}, 180000);

	test('does not expose v2 --mode on the start command', async () => {
		const tmpDir = await mkdtemp(
			path.join(tmpdir(), 'playground-test-start-existing-wp-')
		);
		const wordpressDir = path.join(tmpDir, 'wordpress');
		mkdirSync(path.join(wordpressDir, 'wp-admin'), { recursive: true });
		mkdirSync(path.join(wordpressDir, 'wp-content'), { recursive: true });
		mkdirSync(path.join(wordpressDir, 'wp-includes'), { recursive: true });
		const consoleErrorSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});

		try {
			const result = await parseOptionsAndRunCLI([
				'start',
				`--path=${wordpressDir}`,
				'--mode=create-new-site',
				'--skip-browser',
				'--quiet',
				'--port=0',
			]);
			expect('exitCode' in result).toBe(true);
			expect((result as CLIExitResult).exitCode).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Unknown argument: mode')
			);
		} finally {
			consoleErrorSpy.mockRestore();
			rmSync(tmpDir, { recursive: true, force: true });
		}
	}, 180000);
});

describe('php command', () => {
	test('should run a PHP script and capture output', async () => {
		const stdoutChunks: string[] = [];
		const stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation((chunk: any) => {
				stdoutChunks.push(
					typeof chunk === 'string'
						? chunk
						: new TextDecoder().decode(chunk)
				);
				return true;
			});

		try {
			const exitCode = await runCLI({
				command: 'php',
				_: ['php', '-r', 'echo "hello from php";'],
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			expect(exitCode).toBe(0);
			expect(stdoutChunks.join('')).toContain('hello from php');
		} finally {
			stdoutSpy.mockRestore();
		}
	});

	test('should exit with non-zero code on PHP error', async () => {
		const stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);
		const stderrSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation(() => true);

		try {
			const exitCode = await runCLI({
				command: 'php',
				_: ['php', '-r', 'exit(42);'],
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			expect(exitCode).toBe(42);
		} finally {
			stdoutSpy.mockRestore();
			stderrSpy.mockRestore();
		}
	});

	test('should capture stderr output', async () => {
		const stderrChunks: string[] = [];
		const stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);
		const stderrSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation((chunk: any) => {
				stderrChunks.push(
					typeof chunk === 'string'
						? chunk
						: new TextDecoder().decode(chunk)
				);
				return true;
			});

		try {
			const exitCode = await runCLI({
				command: 'php',
				_: ['php', '-r', 'error_log("test error");'],
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			expect(exitCode).toBe(0);
			expect(stderrChunks.join('')).toContain('test error');
		} finally {
			stdoutSpy.mockRestore();
			stderrSpy.mockRestore();
		}
	});

	test('should run wp-cli.phar --version', async () => {
		const tmpDir = await mkdtemp(
			path.join(tmpdir(), 'playground-wpcli-test-')
		);
		copyFileSync(
			path.resolve(import.meta.dirname, 'fixtures/wp-cli.phar'),
			path.join(tmpDir, 'wp-cli.phar')
		);

		const stdoutChunks: string[] = [];
		const stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation((chunk: any) => {
				stdoutChunks.push(
					typeof chunk === 'string'
						? chunk
						: new TextDecoder().decode(chunk)
				);
				return true;
			});
		const stderrSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation(() => true);

		try {
			const exitCode = await runCLI({
				command: 'php',
				_: ['php', '/tools/wp-cli.phar', '--version'],
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
				'mount-before-install': [
					{
						hostPath: tmpDir,
						vfsPath: '/tools',
					},
				],
			});
			expect(exitCode).toBe(0);
			expect(stdoutChunks.join('')).toMatch(/WP-CLI \d+\.\d+/);
		} finally {
			stdoutSpy.mockRestore();
			stderrSpy.mockRestore();
			rmSync(tmpDir, { recursive: true });
		}
	});

	test('should run composer.phar --version', async () => {
		const tmpDir = await mkdtemp(
			path.join(tmpdir(), 'playground-composer-test-')
		);

		try {
			copyFileSync(
				path.resolve(import.meta.dirname, 'fixtures/composer.phar'),
				path.join(tmpDir, 'composer.phar')
			);

			const stdoutChunks: string[] = [];
			const stdoutSpy = vi
				.spyOn(process.stdout, 'write')
				.mockImplementation((chunk: any) => {
					stdoutChunks.push(
						typeof chunk === 'string'
							? chunk
							: new TextDecoder().decode(chunk)
					);
					return true;
				});
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);

			try {
				const exitCode = await runCLI({
					command: 'php',
					_: ['php', '/tools/composer.phar', '--version'],
					wordpressInstallMode: 'do-not-attempt-installing',
					skipSqliteSetup: true,
					blueprint: undefined,
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/tools',
						},
					],
				});
				expect(exitCode).toBe(0);
				expect(stdoutChunks.join('')).toMatch(
					/Composer version \d+\.\d+/
				);
			} finally {
				stdoutSpy.mockRestore();
				stderrSpy.mockRestore();
			}
		} finally {
			rmSync(tmpDir, { recursive: true });
		}
	});
});

describe('other run-cli behaviors', () => {
	describe('auto-login', () => {
		test('should clear old auto-login cookie', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			cliServer.playground.writeFile('/wordpress/dummy.txt', '');
			const dummyUrl = new URL('/dummy.txt', cliServer.serverUrl);
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					// We use http.get() instead of fetch() because fetch() will not
					// expose the contents of redirection responses.
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
	});

	describe('phpMyAdmin CLI argument validation', () => {
		test('should reject invalid WordPress version slugs before startup', async () => {
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);
			try {
				await expect(
					parseOptionsAndRunCLI(['server', '--wp=brazil'])
				).rejects.toThrow('Unrecognized WordPress version');
			} finally {
				stderrSpy.mockRestore();
			}
		});

		test('should reject --phpmyadmin with --skip-sqlite-setup', async () => {
			// The clean error message is written to stderr; suppress it.
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);

			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--phpmyadmin',
						'--skip-sqlite-setup',
					])
				).rejects.toThrow(
					'The --phpmyadmin option requires SQLite setup. Remove --skip-sqlite-setup to use phpMyAdmin.'
				);
			} finally {
				stderrSpy.mockRestore();
			}
		});
	});

	describe('error handling', () => {
		test('should return 500 when the request handler throws an error', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				blueprint: undefined,
			});

			const throwAnError = (() => {
				throw new Error('test error');
			}) as any;
			cliServer.playground.requestStreamed = throwAnError;

			const response = await fetch(new URL('/', cliServer.serverUrl));
			expect(response.status).toBe(500);
		});

		test('disposes spawned workers when boot fails on the non-debug path', async () => {
			// Regression: a boot failure now rejects instead of calling
			// process.exit(), so the non-debug catch must still run
			// disposeCLI() to terminate spawned workers — otherwise they keep
			// a library caller's event loop alive. An invalid Blueprint step
			// fails boot after the worker has spawned.
			const terminateSpy = vi.spyOn(Worker.prototype, 'terminate');
			try {
				await expect(
					runCLI({
						command: 'server',
						wordpressInstallMode: 'do-not-attempt-installing',
						skipSqliteSetup: true,
						verbosity: 'normal',
						workers: 1,
						blueprint: {
							steps: [
								{
									step: 'thisStepDoesNotExistForTesting',
								} as any,
							],
						},
					} as RunCLIArgs & { command: 'server' })
				).rejects.toThrow();
				expect(terminateSpy).toHaveBeenCalled();
			} finally {
				terminateSpy.mockRestore();
			}
		}, 60_000 /* full boot before the failing step; allow Windows headroom */);
	});

	describe('streaming responses', () => {
		test('should handle streaming responses correctly', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// Custom headers are returned in HTTP response
			await cliServer.playground.writeFile(
				'/wordpress/custom-headers.php',
				`<?php
					header('X-Custom-Header: test-value');
					header('X-Another: hello');
					echo 'done';
					`
			);
			const headersResponse = await fetch(
				new URL('/custom-headers.php', cliServer.serverUrl)
			);
			expect(headersResponse.status).toBe(200);
			expect(headersResponse.headers.get('x-custom-header')).toBe(
				'test-value'
			);
			expect(headersResponse.headers.get('x-another')).toBe('hello');
			expect(await headersResponse.text()).toBe('done');

			// Status codes are propagated from PHP
			await cliServer.playground.writeFile(
				'/wordpress/not-found.php',
				`<?php
					http_response_code(404);
					echo 'Not Found';
					`
			);
			const notFoundResponse = await fetch(
				new URL('/not-found.php', cliServer.serverUrl)
			);
			expect(notFoundResponse.status).toBe(404);

			// Large streaming output is returned completely
			await cliServer.playground.writeFile(
				'/wordpress/large-output.php',
				`<?php
					for ($i = 0; $i < 100; $i++) {
						echo "Line $i\\n";
					}
					`
			);
			const largeResponse = await fetch(
				new URL('/large-output.php', cliServer.serverUrl)
			);
			expect(largeResponse.status).toBe(200);
			const largeText = await largeResponse.text();
			expect(largeText).toContain('Line 0');
			expect(largeText).toContain('Line 99');
			expect(largeText.trim().split('\n')).toHaveLength(100);

			// PHP fatal error does not crash the server
			await cliServer.playground.writeFile(
				'/wordpress/fatal.php',
				`<?php
					undefined_function_that_does_not_exist();
					`
			);
			const fatalResponse = await fetch(
				new URL('/fatal.php', cliServer.serverUrl)
			);
			// In streaming mode, headers are sent before exit code
			// is known, so the status may be 200. The key assertion
			// is that the server does not crash.
			expect(fatalResponse.status).toBeLessThan(600);
		}, 60_000);

		test('should handle client disconnect during streaming', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// PHP script that produces a large stream (enough to
			// read a chunk, but finite so the worker is freed)
			await cliServer.playground.writeFile(
				'/wordpress/large-stream.php',
				`<?php
					for ($i = 0; $i < 1000; $i++) {
						echo str_repeat("x", 1024) . "\\n";
						flush();
					}
				`
			);

			const controller = new AbortController();
			const response = await fetch(
				new URL('/large-stream.php', cliServer.serverUrl),
				{ signal: controller.signal }
			);

			// Read at least one chunk to confirm streaming started
			const reader = response.body!.getReader();
			const { done } = await reader.read();
			expect(done).toBe(false);

			// Abort mid-stream
			reader.cancel();
			controller.abort();

			// Wait for the PHP script to finish and free the worker
			await new Promise((r) => setTimeout(r, 2000));

			// Server should still be responsive
			await cliServer.playground.writeFile(
				'/wordpress/health.php',
				`<?php echo 'ok';`
			);
			const healthCheck = await fetch(
				new URL('/health.php', cliServer.serverUrl)
			);
			expect(healthCheck.status).toBe(200);
		}, 60_000);
	});

	describe('internal cookie store', () => {
		test('should persist cookies across requests when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// Write a PHP script that sets a cookie
			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "cookie set"; ?>'
			);
			// Write a PHP script that reads and echoes the cookie
			await cliServer.playground.writeFile(
				'/wordpress/read-cookie.php',
				'<?php echo isset($_COOKIE["test_cookie"]) ? $_COOKIE["test_cookie"] : "no cookie"; ?>'
			);

			// First request: set the cookie
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			const setResponse = await fetch(setUrl);
			expect(setResponse.status).toBe(200);
			expect(await setResponse.text()).toContain('cookie set');

			// Second request: the cookie should be sent by the internal store
			const readUrl = new URL('/read-cookie.php', cliServer.serverUrl);
			const readResponse = await fetch(readUrl);
			expect(readResponse.status).toBe(200);
			expect(await readResponse.text()).toContain('hello');
		});

		test('should strip Set-Cookie headers from responses when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "ok"; ?>'
			);

			const url = new URL('/set-cookie.php', cliServer.serverUrl);
			// Use http.get to inspect raw headers (fetch may hide some)
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					const req = http.get(url, resolve);
					req.on('error', reject);
					req.end();
				}
			);
			// Set-Cookie should be stripped from the response
			expect(res.headers['set-cookie']).toBeUndefined();
		});

		test('should not use internal cookie store when disabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				// internalCookieStore defaults to false
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "cookie set"; ?>'
			);
			await cliServer.playground.writeFile(
				'/wordpress/read-cookie.php',
				'<?php echo isset($_COOKIE["test_cookie"]) ? $_COOKIE["test_cookie"] : "no cookie"; ?>'
			);

			// First request: set the cookie
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			const setResponse = await fetch(setUrl);
			expect(setResponse.status).toBe(200);

			// Second request: cookie should NOT be present (no browser to store it)
			const readUrl = new URL('/read-cookie.php', cliServer.serverUrl);
			const readResponse = await fetch(readUrl);
			expect(readResponse.status).toBe(200);
			expect(await readResponse.text()).toContain('no cookie');
		});

		test('should replace browser-sent cookies with stored cookies when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("internal", "from_store", 0, "/"); echo "ok"; ?>'
			);
			await cliServer.playground.writeFile(
				'/wordpress/read-cookies.php',
				'<?php echo "internal=" . ($_COOKIE["internal"] ?? "none") . ";browser=" . ($_COOKIE["browser"] ?? "none"); ?>'
			);

			// First: set a cookie via the internal store
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			await fetch(setUrl);

			// Second: send a request with a browser cookie — it should be replaced
			const readUrl = new URL('/read-cookies.php', cliServer.serverUrl);
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					const req = http.get(
						readUrl,
						{
							headers: {
								cookie: 'browser=from_browser',
							},
						},
						resolve
					);
					req.on('error', reject);
					req.end();
				}
			);

			const chunks: Uint8Array[] = [];
			for await (const chunk of res) {
				chunks.push(chunk);
			}
			const body = Buffer.concat(chunks).toString();
			// Internal store cookie should be present
			expect(body).toContain('internal=from_store');
			// Browser cookie should be replaced (not present)
			expect(body).toContain('browser=none');
		});
	});

	describe('async dispose', () => {
		test('should clean up the CLI server when disposed', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			await using cliResult = (await parseOptionsAndRunCLI([
				'server',
				'--wordpress-install-mode=do-not-attempt-installing',
				'--skip-sqlite-setup',
				'--verbosity=quiet',
				'--port=0',
			])) as CLIServerResult;
			const cliServer = cliResult[internalsKeyForTesting].cliServer;

			const asyncDisposeSpy = vi
				.spyOn(cliServer, Symbol.asyncDispose)
				.mockImplementation((() => {}) as any);

			try {
				await cliResult[Symbol.asyncDispose]();
				expect(asyncDisposeSpy).toHaveBeenCalled();
			} finally {
				asyncDisposeSpy.mockRestore();
			}
		});
	});

	describe('WP_DEBUG constants', () => {
		async function getConstants(cliArgs: string[]) {
			await using cliResult = (await parseOptionsAndRunCLI([
				'server',
				'--wordpress-install-mode=do-not-attempt-installing',
				'--skip-sqlite-setup',
				'--verbosity=quiet',
				'--port=0',
				'--workers=1',
				...cliArgs,
			])) as CLIServerResult;
			const cliServer = cliResult[internalsKeyForTesting].cliServer;
			await cliServer.playground.writeFile(
				'/wordpress/check-consts.php',
				`<?php
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
		}

		test('should override WP_DEBUG constants via --define-bool', async () => {
			// Confirm default values before confirming they can be overridden.
			const defaultConstants = await getConstants([]);
			expect(defaultConstants.WP_DEBUG).toBe(true);
			expect(defaultConstants.WP_DEBUG_LOG).toBe(true);
			expect(defaultConstants.WP_DEBUG_DISPLAY).toBe(false);

			const constants = await getConstants([
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
			expect(constants.WP_DEBUG).toBe(false);
			expect(constants.WP_DEBUG_LOG).toBe(false);
			expect(constants.WP_DEBUG_DISPLAY).toBe(true);
		});

		test('should override WP_DEBUG constants via --define-number', async () => {
			// Confirm default values before confirming they can be overridden.
			const defaultConstants = await getConstants([]);
			expect(defaultConstants.WP_DEBUG).toBe(true);
			expect(defaultConstants.WP_DEBUG_LOG).toBe(true);
			expect(defaultConstants.WP_DEBUG_DISPLAY).toBe(false);

			const constants = await getConstants([
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
			expect(constants.WP_DEBUG).toBe(0);
			expect(constants.WP_DEBUG_LOG).toBe(0);
			expect(constants.WP_DEBUG_DISPLAY).toBe(1);
		});

		test('should override WP_DEBUG constants via --define', async () => {
			// Confirm default values before confirming they can be overridden.
			const defaultConstants = await getConstants([]);
			expect(defaultConstants.WP_DEBUG).toBe(true);
			expect(defaultConstants.WP_DEBUG_LOG).toBe(true);
			expect(defaultConstants.WP_DEBUG_DISPLAY).toBe(false);

			const constants = await getConstants([
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
			expect(constants.WP_DEBUG).toBe('false');
			expect(constants.WP_DEBUG_LOG).toBe('false');
			expect(constants.WP_DEBUG_DISPLAY).toBe('true');
		});
	});

	describe('return types', () => {
		test('runCLI returns void for run-blueprint command', async () => {
			const result = await runCLI({
				command: 'run-blueprint',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			expect(result).toBeUndefined();
		});

		test('runCLI returns void for build-snapshot command', async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-snapshot-test-')
			);
			const outfile = path.join(tmpDir, 'snapshot.zip');
			try {
				const result = await runCLI({
					command: 'build-snapshot',
					blueprint: undefined,
					outfile,
				});
				expect(result).toBeUndefined();
				expect(existsSync(outfile)).toBe(true);
			} finally {
				rmSync(tmpDir, { recursive: true });
			}
		}, 60_000 /* allow extra time to avoid testing timeouts on Windows */);

		test('runCLI returns RunCLIServer for server command', async () => {
			await using result = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			expect(result).toBeDefined();
			expect(result.serverUrl).toMatch(/^http:\/\//);
			expect(result[Symbol.asyncDispose]).toBeTypeOf('function');
		});

		test('runCLI returns exit code for php command', async () => {
			const stdoutSpy = vi
				.spyOn(process.stdout, 'write')
				.mockImplementation(() => true);
			try {
				const exitCode = await runCLI({
					command: 'php',
					_: ['php', '-r', 'echo 1;'],
					wordpressInstallMode: 'do-not-attempt-installing',
					skipSqliteSetup: true,
					blueprint: undefined,
				});
				expect(exitCode).toBeTypeOf('number');
				expect(exitCode).toBe(0);
			} finally {
				stdoutSpy.mockRestore();
			}
		});

		test('parseOptionsAndRunCLI returns CLIExitResult for run-blueprint', async () => {
			const result = await parseOptionsAndRunCLI([
				'run-blueprint',
				'--wordpress-install-mode=do-not-attempt-installing',
				'--skip-sqlite-setup',
				'--verbosity=quiet',
			]);
			expect('exitCode' in result).toBe(true);
			expect((result as CLIExitResult).exitCode).toBe(0);
		});

		test('parseOptionsAndRunCLI returns CLIServerResult for server', async () => {
			await using result = (await parseOptionsAndRunCLI([
				'server',
				'--wordpress-install-mode=do-not-attempt-installing',
				'--skip-sqlite-setup',
				'--verbosity=quiet',
				'--port=0',
			])) as CLIServerResult;
			expect(Symbol.asyncDispose in result).toBe(true);
			expect('exitCode' in result).toBe(false);
		});

		test('parseOptionsAndRunCLI returns CLIExitResult for build-snapshot', async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-snapshot-test-')
			);
			const outfile = path.join(tmpDir, 'snapshot.zip');
			try {
				const result = await parseOptionsAndRunCLI([
					'build-snapshot',
					`--outfile=${outfile}`,
					'--verbosity=quiet',
				]);
				expect('exitCode' in result).toBe(true);
				expect((result as CLIExitResult).exitCode).toBe(0);
			} finally {
				rmSync(tmpDir, { recursive: true });
			}
		}, 60_000 /* allow extra time to avoid testing timeouts on Windows */);

		test('parseOptionsAndRunCLI returns CLIExitResult for php command', async () => {
			const stdoutSpy = vi
				.spyOn(process.stdout, 'write')
				.mockImplementation(() => true);
			try {
				const result = await parseOptionsAndRunCLI([
					'php',
					'--wordpress-install-mode=do-not-attempt-installing',
					'--skip-sqlite-setup',
					'--verbosity=quiet',
					'--',
					'-r',
					'echo 1;',
				]);
				expect('exitCode' in result).toBe(true);
				expect((result as CLIExitResult).exitCode).toBe(0);
			} finally {
				stdoutSpy.mockRestore();
			}
		});

		test('parseOptionsAndRunCLI returns CLIExitResult for invalid command', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			try {
				const result = await parseOptionsAndRunCLI([
					'not-a-real-command',
				]);
				expect(result).toHaveProperty('exitCode', 1);
			} finally {
				consoleSpy.mockRestore();
			}
		});

		test('parseOptionsAndRunCLI returns CLIExitResult for missing command', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			try {
				const result = await parseOptionsAndRunCLI([]);
				expect(result).toHaveProperty('exitCode', 1);
			} finally {
				consoleSpy.mockRestore();
			}
		});

		test('parseOptionsAndRunCLI throws for unexpected errors', async () => {
			const stderrSpy = vi
				.spyOn(process.stderr, 'write')
				.mockImplementation(() => true);
			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--phpmyadmin',
						'--skip-sqlite-setup',
					])
				).rejects.toThrow(
					'The --phpmyadmin option requires SQLite setup. Remove --skip-sqlite-setup to use phpMyAdmin.'
				);
			} finally {
				stderrSpy.mockRestore();
			}
		});
	});

	describe('worker count', () => {
		async function getWorkerCount(cliArgs: string[]) {
			const exitSpy = vi
				.spyOn(process, 'exit')
				.mockImplementation((() => {}) as any);
			try {
				await using cliResult = (await parseOptionsAndRunCLI([
					'server',
					'--wordpress-install-mode=do-not-attempt-installing',
					'--skip-sqlite-setup',
					'--verbosity=quiet',
					'--port=0',
					...cliArgs,
				])) as CLIServerResult;
				const cliServer = cliResult[internalsKeyForTesting].cliServer;
				return cliServer[internalsKeyForTesting].workerThreadCount;
			} finally {
				exitSpy.mockRestore();
			}
		}

		const defaultExpected = Math.min(6, Math.max(1, os.cpus().length - 1));
		const autoExpected = Math.max(1, os.cpus().length - 1);

		test('defaults to min(6, cpus-1) when --workers is not set', async () => {
			expect(await getWorkerCount([])).toBe(defaultExpected);
		});

		test('honors an explicit --workers=3', async () => {
			expect(await getWorkerCount(['--workers=3'])).toBe(3);
		});

		test('honors --workers=1 (single-worker bootstrap path)', async () => {
			expect(await getWorkerCount(['--workers=1'])).toBe(1);
		});

		test('--workers=auto uses max(1, cpus-1)', async () => {
			expect(await getWorkerCount(['--workers=auto'])).toBe(autoExpected);
		});

		async function expectInvalidWorkersValue(value: string) {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--wordpress-install-mode=do-not-attempt-installing',
						'--skip-sqlite-setup',
						'--verbosity=quiet',
						'--port=0',
						`--workers=${value}`,
					])
				).rejects.toThrow(`Invalid --workers value "${value}"`);
			} finally {
				consoleErrorSpy.mockRestore();
			}
		}

		test('--workers=0 fails with a clear error', async () => {
			await expectInvalidWorkersValue('0');
		});

		test('--workers=abc fails with a clear error', async () => {
			await expectInvalidWorkersValue('abc');
		});

		async function getWarnCallsForWorkersArgs(
			cliArgs: string[],
			cpuCount: number
		) {
			const cpusStub = vi
				.spyOn(os, 'cpus')
				.mockReturnValue(new Array(cpuCount).fill({}) as os.CpuInfo[]);
			const warnSpy = vi
				.spyOn(logger, 'warn')
				.mockImplementation(() => {});
			try {
				await getWorkerCount(cliArgs);
				return warnSpy.mock.calls
					.map((call) => call.join(' '))
					.join('\n');
			} finally {
				warnSpy.mockRestore();
				cpusStub.mockRestore();
			}
		}

		test('does not warn when the default worker count is 6 on a large host', async () => {
			const warnCalls = await getWarnCallsForWorkersArgs([], 8);
			expect(warnCalls).not.toMatch(/below the recommended threshold/);
			expect(warnCalls).not.toMatch(
				/default worker count has been reduced/
			);
		});

		test('warns that the default was CPU-reduced on a small host', async () => {
			const warnCalls = await getWarnCallsForWorkersArgs([], 4);
			expect(warnCalls).toMatch(
				/default worker count has been reduced to 3 because this machine has only 4 CPU\(s\)/
			);
		});

		test('warns when the user explicitly sets --workers below 6', async () => {
			const warnCalls = await getWarnCallsForWorkersArgs(
				['--workers=3'],
				8
			);
			expect(warnCalls).toMatch(
				/Worker count \(3\) is below the recommended threshold \(6\)/
			);
			expect(warnCalls).not.toMatch(
				/default worker count has been reduced/
			);
		});

		test('warns when --workers=auto resolves below 6 on small hosts', async () => {
			const warnCalls = await getWarnCallsForWorkersArgs(
				['--workers=auto'],
				4
			);
			expect(warnCalls).toMatch(
				/Worker count \(3\) is below the recommended threshold \(6\)/
			);
		});

		test('does not warn when --workers is set to 6 or above', async () => {
			const warnCalls = await getWarnCallsForWorkersArgs(
				['--workers=6'],
				8
			);
			expect(warnCalls).not.toMatch(/below the recommended threshold/);
			expect(warnCalls).not.toMatch(
				/default worker count has been reduced/
			);
		});

		test('--experimental-multi-worker warns and still starts', async () => {
			const warnSpy = vi
				.spyOn(logger, 'warn')
				.mockImplementation(() => {});
			try {
				const count = await getWorkerCount([
					'--experimental-multi-worker=4',
				]);
				// Value is ignored; default applies.
				expect(count).toBe(defaultExpected);
				const warnCalls = warnSpy.mock.calls
					.map((call) => call.join(' '))
					.join('\n');
				expect(warnCalls).toMatch(/--experimental-multi-worker/);
				expect(warnCalls).toMatch(/--workers/);
			} finally {
				warnSpy.mockRestore();
			}
		});
	});

	describe('port in use', () => {
		test('should error when explicit port is already in use', async () => {
			const port = 12345;
			const blockingServer = http.createServer();
			await new Promise<void>((resolve) => {
				blockingServer.listen(port, () => resolve());
			});

			try {
				await expect(
					runCLI({
						command: 'server',
						port,
					})
				).rejects.toThrow(`EADDRINUSE`);
			} finally {
				blockingServer.close();
			}
		});

		test('should use a random port when default port is already in use', async () => {
			const port = 12345;
			const blockingServer = http.createServer();
			await new Promise<void>((resolve) => {
				blockingServer.listen(port, () => resolve());
			});

			try {
				await using cliServer = await runCLI({
					command: 'server',
					wordpressInstallMode: 'do-not-attempt-installing',
					skipSqliteSetup: true,
					blueprint: undefined,
				});

				const assignedPort = new URL(cliServer.serverUrl).port;
				expect(Number(assignedPort)).not.toBe(port);
				expect(Number(assignedPort)).toBeGreaterThan(0);
			} finally {
				blockingServer.close();
			}
		});
	});
});

describe('resolveWorkerCount', () => {
	function withCpus<T>(count: number, fn: () => T): T {
		const stub = vi
			.spyOn(os, 'cpus')
			.mockReturnValue(new Array(count).fill({}) as os.CpuInfo[]);
		try {
			return fn();
		} finally {
			stub.mockRestore();
		}
	}

	test('default caps at 6 on large hosts', () => {
		withCpus(16, () => {
			expect(resolveWorkerCount(undefined)).toBe(6);
		});
	});

	test('default shrinks to cpus-1 on small hosts', () => {
		withCpus(4, () => {
			expect(resolveWorkerCount(undefined)).toBe(3);
		});
	});

	test('default is at least 1 on single-core hosts', () => {
		withCpus(1, () => {
			expect(resolveWorkerCount(undefined)).toBe(1);
		});
	});

	test('default is at least 1 when os.cpus() returns an empty array', () => {
		withCpus(0, () => {
			expect(resolveWorkerCount(undefined)).toBe(1);
		});
	});

	test('auto returns cpus-1 without the 6 cap', () => {
		withCpus(16, () => {
			expect(resolveWorkerCount('auto')).toBe(15);
		});
	});

	test('auto is at least 1 on single-core hosts', () => {
		withCpus(1, () => {
			expect(resolveWorkerCount('auto')).toBe(1);
		});
	});

	test('explicit number is honored verbatim', () => {
		withCpus(2, () => {
			expect(resolveWorkerCount(32)).toBe(32);
			expect(resolveWorkerCount(1)).toBe(1);
		});
	});
});

async function extractZip(zipPath: string, extractTo: string) {
	const extractRoot = path.resolve(extractTo);
	const zipStream = decodeZip(new Blob([await readFile(zipPath)]).stream());
	for await (const file of zipStream) {
		const target = path.resolve(extractRoot, file.name);
		if (
			target !== extractRoot &&
			!target.startsWith(`${extractRoot}${path.sep}`)
		) {
			throw new Error(
				`Refusing to extract ZIP entry outside target: ${file.name}`
			);
		}
		if (file.type === 'directory' || file.name.endsWith('/')) {
			await mkdir(target, { recursive: true });
			continue;
		}
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, new Uint8Array(await file.arrayBuffer()));
	}
}
