import { PHPWorker } from '@php-wasm/universal';
import type { Mount } from '@php-wasm/cli-util';

export class PlaygroundCliWorker extends PHPWorker {
	// Subclasses override this to apply post-install mounts.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async mountAfterWordPressInstall(mounts: Array<Mount>): Promise<void> {
		// No-op by default. Subclasses override.
	}

	async runCLIScript(
		argv: string[],
		options: { env?: Record<string, string> } = {}
	) {
		const streamedResponse = await this.cli(argv, options);
		streamedResponse.stdout.pipeTo(
			new WritableStream({
				write(chunk) {
					process.stdout.write(chunk);
				},
			})
		);
		streamedResponse.stderr.pipeTo(
			new WritableStream({
				write(chunk) {
					process.stderr.write(chunk);
				},
			})
		);
		return await streamedResponse.exitCode;
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
}
