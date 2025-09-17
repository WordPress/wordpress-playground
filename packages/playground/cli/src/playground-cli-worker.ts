import { PHPWorker } from '@php-wasm/universal';

export class PlaygroundCliWorker extends PHPWorker {
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
