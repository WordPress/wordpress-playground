import { UniversalPHP, writeFile } from '@php-wasm/universal';

/**
 * Writes a file to the Playground.
 */
export class WriteFileStream extends WritableStream {
	constructor(php: UniversalPHP, root: string) {
		super({
			async write(file: File) {
				await writeFile(php, root, file);
			},
		});
	}
}
