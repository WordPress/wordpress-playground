import type { PlaygroundWorkerClient } from './worker-thread';

export interface WebClientMixin {
	onNavigation(fn: (url: string) => void): Promise<void>;
	goTo(requestedPath: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	setIframeSandboxFlags(flags: string[]): Promise<void>;
	onDownloadProgress: PlaygroundWorkerClient['onDownloadProgress'];
}

export type PlaygroundClient = WebClientMixin & PlaygroundWorkerClient;
