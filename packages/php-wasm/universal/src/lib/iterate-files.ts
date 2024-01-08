import { joinPaths, normalizePath } from '@php-wasm/util';
import { StreamedFile } from '@php-wasm/stream-compression';
import { UniversalPHP } from './universal-php';
import { streamReadFileFromPHP } from './stream-read-file-from-php';

export type IteratePhpFilesOptions = {
	/**
	 * Should yield paths relative to the root directory?
	 * If false, all paths will be absolute.
	 */
	relativePaths?: boolean;

	/**
	 * A prefix to add to all paths.
	 * Only used if `relativePaths` is true.
	 */
	pathPrefix?: string;

	/**
	 * A list of paths to exclude from the results.
	 */
	exceptPaths?: string[];
};

/**
 * Iterates over all files in a php directory and its subdirectories.
 *
 * @param php - The PHP instance.
 * @param root - The root directory to start iterating from.
 * @param options - Optional configuration.
 * @returns All files found in the tree.
 */
export async function* iteratePhpFiles(
	php: UniversalPHP,
	root: string,
	{
		relativePaths = true,
		pathPrefix,
		exceptPaths = [],
	}: IteratePhpFilesOptions = {}
): AsyncGenerator<File> {
	root = normalizePath(root);
	const stack: string[] = [root];
	while (stack.length) {
		const currentParent = stack.pop();
		if (!currentParent) {
			return;
		}
		const files = await php.listFiles(currentParent);
		for (const file of files) {
			const absPath = `${currentParent}/${file}`;
			if (exceptPaths.includes(absPath.substring(root.length + 1))) {
				continue;
			}
			const isDir = await php.isDir(absPath);
			if (isDir) {
				stack.push(absPath);
			} else {
				yield new File(
					[await php.readFileAsBuffer(absPath)],
					relativePaths
						? joinPaths(
								pathPrefix || '',
								absPath.substring(root.length + 1)
						  )
						: absPath
				);
			}
		}
	}
}

function bufferToStream(buffer) {
	console.log('Pull', 'buffer.byteLength', buffer.byteLength, buffer);

	const newArray = new Uint8Array(buffer.byteLength);
	newArray.set(new Uint8Array(buffer));
	buffer = newArray;
	// buffer = new Uint8Array(buffer);
	console.log('Pull', 'buffer.byteLength', buffer.byteLength, buffer);
	return new ReadableStream({
		type: 'bytes',
		// 0.5 MB seems like a reasonable chunk size, let's adjust
		// this if needed.
		autoAllocateChunkSize: Math.max(
			1,
			Math.min(buffer.byteLength, 512 * 1024)
		),
		/**
		 * We could write directly to controller.byobRequest.view
		 * here. Unfortunately, in Chrome it detaches on the first
		 * `await` and cannot be reused once we actually have the data.
		 */
		async pull(controller) {
			// Read data until we have enough to fill the BYOB request:
			const view = controller.byobRequest!.view!;
			const uint8array = new Uint8Array(view.byteLength);
			uint8array.set(buffer);
			buffer = buffer.slice(uint8array.byteLength);
			console.log(
				'Pull',
				{ uint8array, buf: buffer },
				'buffer.byteLength',
				buffer.byteLength,
				'newArray.byteLength',
				newArray.byteLength,
				view.byteOffset,
				view.byteLength,
				controller.byobRequest
			);

			// Emit that chunk:
			controller.byobRequest?.respondWithNewView(uint8array);
			console.log('uint8array length', uint8array.byteLength);
			if (buffer.byteLength === 0 || view.byteLength === 0) {
				controller.close();
				controller.byobRequest?.respond(0);
			}
		},
	});
}
