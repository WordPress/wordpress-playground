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
	): Promise<number> {
		const streamedResponse = await this.cli(argv, options);
		const stdoutDone = streamedResponse.stdout.pipeTo(
			new WritableStream({
				write(chunk) {
					process.stdout.write(chunk);
				},
			})
		);
		const stderrDone = streamedResponse.stderr.pipeTo(
			new WritableStream({
				write(chunk) {
					process.stderr.write(chunk);
				},
			})
		);
		const [, , exitCode] = await Promise.all([
			stdoutDone,
			stderrDone,
			streamedResponse.exitCode,
		]);
		return exitCode;
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
}
