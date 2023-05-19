import { ProgressReceiver } from '@php-wasm/progress';
import { UniversalPHP, type IsomorphicRemotePHP } from '@php-wasm/universal';
import { RemoteAPI } from '@php-wasm/web';
import { ProgressBarOptions } from './progress-bar';
import type { PlaygroundWorkerEndpoint } from './worker-thread';

export interface WebClientMixin extends ProgressReceiver {
	setProgress(options: ProgressBarOptions): Promise<void>;
	setLoaded(): Promise<void>;

	onNavigation(fn: (url: string) => void): Promise<void>;
	goTo(requestedPath: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	setIframeSandboxFlags(flags: string[]): Promise<void>;
	onDownloadProgress: PlaygroundWorkerEndpoint['onDownloadProgress'];
}

// Using interface instead of Type to ensure TypeDoc
// generates documentation for the methods.

type BaseType = RemoteAPI<PlaygroundWorkerEndpoint & WebClientMixin> &
	IsomorphicRemotePHP;

/**
 * @inheritDoc
 */
export interface PlaygroundClient extends BaseType {}

/*
 * Assert that PlaygroundClient is a superset of UniversalPHP.
 */
export const assertion: UniversalPHP = {} as PlaygroundClient;
