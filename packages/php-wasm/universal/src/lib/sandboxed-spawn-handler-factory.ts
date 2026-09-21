import {
	createSpawnHandler,
	splitShellCommand,
	type ProcessApi,
	type ProcessOptions,
} from '@php-wasm/util';
import type { PHP } from './php';
import type { PHPWorker } from './php-worker';
import type { Remote } from './comlink-sync';
import { logger } from '@php-wasm/logger';

export type PHPFileSystem = PHP | Remote<PHPWorker>;

export interface SandboxedShellExecutorContext {
	args: string[];
	command?: string;
	php: PHPFileSystem;
	processApi: ProcessApi;
	options: ProcessOptions;
}

/** Executes commands beyond the portable PHP, ls, and pwd command set. */
export type SandboxedShellExecutor = (
	context: SandboxedShellExecutorContext
) => Promise<void>;

/**
 * An isomorphic proc_open() handler for PHP subprocesses and a small portable
 * terminal command set. Runtimes may supply a VFS-only shell executor for
 * additional shell syntax without making the universal package runtime-specific.
 */
export function sandboxedSpawnHandlerFactory(
	getPHPInstance?: () => Promise<{
		php: PHPFileSystem;
		reap: () => void;
	}>,
	shellExecutor?: SandboxedShellExecutor,
	currentPHP?: PHPFileSystem
) {
	return createSpawnHandler(
		async function (args, processApi, options, command) {
			if (
				args?.[0] === '/usr/bin/env' &&
				args[1] === 'stty' &&
				args[2] === 'size'
			) {
				processApi.stdout('18 140');
				processApi.exit(0);
				return;
			}

			const originalArgs = args;
			if (
				args?.[0] === '/bin/sh' &&
				args?.[1] === '-c' &&
				typeof args[2] === 'string'
			) {
				args = splitShellCommand(args[2]);
			}
			if (args[0] === 'exec') args.shift();
			if (args[0]?.endsWith('.php') || args[0]?.endsWith('.phar')) {
				args.unshift('php');
			}

			const binaryName = args[0]?.split('/').pop();
			if (binaryName === 'tput' && args[1] === 'cols') {
				processApi.stdout('140');
				processApi.exit(0);
				return;
			}
			if (binaryName === 'less') {
				processApi.on('stdin', (data) => processApi.stdout(data));
				await new Promise<void>((resolve) => {
					processApi.childProcess.stdin.on('finish', resolve);
				});
				processApi.exit(0);
				return;
			}

			const isPortableCommand = ['php', 'ls', 'pwd'].includes(
				binaryName ?? ''
			);
			if (!isPortableCommand && !shellExecutor) {
				processApi.exit(127);
				return;
			}
			const requiresSubprocess = binaryName === 'php';
			if (!currentPHP && !getPHPInstance) {
				logger.warn(
					'Tried to spawn a PHP subprocess, but the sandboxed spawn handler was created without a getPHPInstance function.'
				);
				processApi.exit(127);
				return;
			}

			if (requiresSubprocess && !getPHPInstance) {
				logger.warn(
					'Tried to spawn a PHP subprocess, but the sandboxed spawn handler was created without a getPHPInstance function.'
				);
				processApi.exit(127);
				return;
			}

			// Acquiring a worker also lets the originating WASM execution advance
			// proc_open() pipe I/O while the shell command is running.
			const acquired = getPHPInstance
				? await getPHPInstance()
				: undefined;
			const php = requiresSubprocess
				? acquired!.php
				: (currentPHP ?? acquired!.php);
			try {
				if (acquired && options.cwd) await php.chdir(options.cwd);
				if (!isPortableCommand) {
					await shellExecutor!({
						args: originalArgs,
						command,
						php,
						processApi,
						options,
					});
					return;
				}

				const cwd = await php.cwd();
				switch (binaryName) {
					case 'php': {
						const result = await php.cli(args, {
							env: {
								...options.env,
								SCRIPT_PATH: args[1],
								SHELL_PIPE: '0',
							},
						});
						result.stdout.pipeTo(
							new WritableStream({
								write(chunk) {
									processApi.stdout(chunk as ArrayBuffer);
								},
							})
						);
						result.stderr.pipeTo(
							new WritableStream({
								write(chunk) {
									processApi.stderr(chunk as ArrayBuffer);
								},
							})
						);
						processApi.exit(await result.exitCode);
						break;
					}
					case 'ls':
						for (const file of await php.listFiles(
							args[1] ?? cwd
						)) {
							processApi.stdout(file + '\n');
						}
						await new Promise((resolve) => setTimeout(resolve, 10));
						processApi.exit(0);
						break;
					case 'pwd':
						processApi.stdout(cwd + '\n');
						await new Promise((resolve) => setTimeout(resolve, 10));
						processApi.exit(0);
						break;
				}
			} catch (e) {
				const errMsg =
					e instanceof Error
						? e.message + '\n' + e.stack
						: typeof e === 'object' && e !== null
							? JSON.stringify(e, Object.getOwnPropertyNames(e))
							: String(e);
				processApi.stderr(`[spawn error] ${errMsg}`);
				processApi.exit(1);
				throw e;
			} finally {
				acquired?.reap();
			}
		}
	);
}
