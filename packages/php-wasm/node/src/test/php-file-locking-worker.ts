/**
 * Worker script for running PHP instances in separate child processes.
 * This allows testing real OS-level file locking via fcntl().
 *
 * Communication protocol via IPC:
 * - Parent sends: { type: 'init', config: { phpVersion, tempDir, vfsMountPoint, processId } }
 * - Worker responds: { type: 'init-done' } or { type: 'error', error: string }
 * - Parent sends: { type: 'run', code: string }
 * - Worker responds: { type: 'run-done', result: { exitCode, text, stderr } } or { type: 'error', error: string }
 * - Parent sends: { type: 'dispose' }
 * - Worker responds: { type: 'dispose-done' }
 */

import { PHP } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { createNodeFsMountHandler } from '@php-wasm/node';
import { loadNodeRuntime } from '@php-wasm/node';
import { FileLockManagerForPosix } from '../lib/file-lock-manager-for-posix';

let php: PHP | undefined;
let fileLockManager: FileLockManagerForPosix | undefined;

interface InitConfig {
	phpVersion: SupportedPHPVersion;
	tempDir: string;
	vfsMountPoint: string;
	processId: number;
}

interface InitMessage {
	type: 'init';
	config: InitConfig;
}

interface RunMessage {
	type: 'run';
	code: string;
}

interface DisposeMessage {
	type: 'dispose';
}

type WorkerMessage = InitMessage | RunMessage | DisposeMessage;

async function handleInit(config: InitConfig) {
	try {
		fileLockManager = new FileLockManagerForPosix();

		const runtimeId = await loadNodeRuntime(config.phpVersion, {
			fileLockManager,
			emscriptenOptions: {
				processId: config.processId,
			},
		});

		php = new PHP(runtimeId);

		const errorLogPath = `${config.vfsMountPoint}/error.log`;
		php.writeFile(
			'/internal/shared/php.ini',
			`memory_limit = 128M
max_execution_time = 30 ; seconds
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = Off
log_errors = On
error_log = ${errorLogPath}
`
		);

		php.mount(
			config.vfsMountPoint,
			createNodeFsMountHandler(config.tempDir)
		);

		process.send?.({ type: 'init-done' });
	} catch (e) {
		process.send?.({
			type: 'error',
			error: e instanceof Error ? e.message : String(e),
		});
	}
}

async function handleRun(code: string) {
	if (!php) {
		process.send?.({ type: 'error', error: 'PHP not initialized' });
		return;
	}

	try {
		const result = await php.run({ code });
		process.send?.({
			type: 'run-done',
			result: {
				exitCode: result.exitCode,
				text: result.text,
				stderr: result.errors,
			},
		});
	} catch (e) {
		process.send?.({
			type: 'error',
			error: e instanceof Error ? e.message : String(e),
		});
	}
}

async function handleDispose() {
	if (php) {
		php[Symbol.dispose]();
		php = undefined;
	}
	fileLockManager = undefined;
	process.send?.({ type: 'dispose-done' });
}

process.on('message', async (message: WorkerMessage) => {
	switch (message.type) {
		case 'init':
			await handleInit(message.config);
			break;
		case 'run':
			await handleRun(message.code);
			break;
		case 'dispose':
			await handleDispose();
			process.exit(0);
			break;
	}
});

// Signal that the worker script is loaded and ready to receive init
process.send?.({ type: 'worker-ready' });
