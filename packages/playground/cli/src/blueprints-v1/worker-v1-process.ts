import { logger } from '@php-wasm/logger';
import { PlaygroundCliBlueprintV1Worker } from './worker-v1';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';

process.on('unhandledRejection', (e: any) => {
	logger.error('Unhandled rejection:', e);
});

new PlaygroundCliBlueprintV1Worker(
	new EmscriptenDownloadMonitor(),
	// TODO: Fix this type error.
	// @ts-ignore
	process as NodeProcess
);

process.send!({ command: 'worker-script-initialized' });
