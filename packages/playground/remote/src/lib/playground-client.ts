import { ProgressReceiver } from '@php-wasm/progress';
import { ProgressBarOptions } from './progress-bar';
import type { PlaygroundWorkerClient } from './worker-thread';

export interface WebClientMixin extends ProgressReceiver {
	setProgress(options: ProgressBarOptions): Promise<void>;
	setLoaded(): Promise<void>;

	onNavigation(fn: (url: string) => void): Promise<void>;
	goTo(requestedPath: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	setIframeSandboxFlags(flags: string[]): Promise<void>;
	onDownloadProgress: PlaygroundWorkerClient['onDownloadProgress'];
}

/**
 * @inheritDoc
 */
export interface PlaygroundClient
	extends WebClientMixin,
		PlaygroundWorkerClient {}
