import { UniversalPHP, writeFile } from '@php-wasm/universal';

/**
 * Writes a file to the Playground.
 */
export function streamWriteToPhp(php: UniversalPHP, root: string) {
	return new WritableStream({
		async write(file: File) {
			await writeFile(php, root, file);
		},
	});
}
