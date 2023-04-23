import { ProgressReceiver } from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { RemoteAPI } from '@php-wasm/web';
import { ProgressBarOptions } from './progress-bar';
import type { WebWorkerPHP } from './worker-thread';

export interface WebClientMixin extends ProgressReceiver {
	setProgress(options: ProgressBarOptions): Promise<void>;
	setLoaded(): Promise<void>;

	onNavigation(fn: (url: string) => void): Promise<void>;
	goTo(requestedPath: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	setIframeSandboxFlags(flags: string[]): Promise<void>;
	onDownloadProgress: WebWorkerPHP['onDownloadProgress'];
}

/**
 * @inheritDoc
 */
export type PlaygroundClient = RemoteAPI<WebWorkerPHP & WebClientMixin>;

/*
 * Assert that PlaygroundClient is a superset of UniversalPHP.
 */
export const assertion: UniversalPHP = {} as PlaygroundClient;
