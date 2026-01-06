import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { PlaygroundCliBlueprintV2Worker } from './worker-v2';
import { type NodeProcess } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';

process.on('unhandledRejection', (e: any) => {
	logger.error('Unhandled rejection:', e);
});

new PlaygroundCliBlueprintV2Worker(
	new EmscriptenDownloadMonitor(),
	process as NodeProcess
);

process.send!({ command: 'worker-script-initialized' });
