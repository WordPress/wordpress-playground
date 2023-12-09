import { UniversalPHP } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';

/**
 * Replaces the contents of a Playground directory with the given files.
 *
 * @param client
 * @param root
 * @param newFiles
 */
export async function overwritePath(
	client: UniversalPHP,
	root: string,
	newFiles: Record<string, Uint8Array | string>
) {
	await client.mkdir(root);
	await client.rmdir(root);
	for (const [relativePath, content] of Object.entries(newFiles)) {
		const filePath = joinPaths(root, relativePath);
		await client.mkdir(dirname(filePath));
		await client.writeFile(filePath, content);
	}
}
