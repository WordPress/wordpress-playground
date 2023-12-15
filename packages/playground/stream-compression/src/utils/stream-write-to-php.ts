import { UniversalPHP } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';

/**
 * Writes a file to the Playground.
 */
export function streamWriteToPhp(php: UniversalPHP, root: string) {
	return new WritableStream({
		async write(file: File) {
			const filePath = joinPaths(root, file.name);
			if (file.type === 'directory') {
				await php.mkdir(filePath);
			} else {
				await php.mkdir(dirname(filePath));
				await php.writeFile(
					filePath,
					new Uint8Array(await file.arrayBuffer())
				);
			}
		},
	});
}
