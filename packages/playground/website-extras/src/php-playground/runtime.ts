import type { PlaygroundClient } from '@wp-playground/client';

class PlaygroundRuntime {
	private client: PlaygroundClient | null = null;
	private bootPromise: Promise<void> = Promise.resolve();

	setClient(client: PlaygroundClient | null) {
		this.client = client;
	}

	getClient() {
		return this.client;
	}

	setBootPromise(promise: Promise<void>) {
		this.bootPromise = promise;
	}

	getBootPromise() {
		return this.bootPromise;
	}
}

export const playgroundRuntime = new PlaygroundRuntime();
