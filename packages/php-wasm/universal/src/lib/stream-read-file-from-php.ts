import { UniversalPHP } from './universal-php';

/**
 * Reads a file from PHP filesystem using a stream.
 */
export function streamReadFileFromPHP(php: UniversalPHP, path: string) {
	return new ReadableStream({
		async pull(controller) {
			const buffer = await php.readFileAsBuffer(path);
			controller.enqueue(buffer);
			controller.close();
		},
	});
}
