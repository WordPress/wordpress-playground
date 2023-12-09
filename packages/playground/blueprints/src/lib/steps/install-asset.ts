import { writeToPath, type UniversalPHP, FileEntry } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';

export interface InstallAssetOptions {
	/**
	 * The files to install.
	 */
	files: AsyncIterable<FileEntry>;
	/**
	 * The default name of the asset.
	 * Used if the zip file contains more than one folder.
	 */
	defaultAssetName: string;
	/**
	 * Target path to extract the main folder.
	 * @example
	 *
	 * <code>
	 * const targetPath = `${await playground.documentRoot}/wp-content/plugins`;
	 * </code>
	 */
	targetPath: string;
}

/**
 * Install asset: Extract folder from zip file and move it to target
 */
export async function installAsset(
	playground: UniversalPHP,
	{ targetPath, files, defaultAssetName }: InstallAssetOptions
): Promise<string> {
	const extractionPath = joinPaths(targetPath, crypto.randomUUID());
	await writeToPath(playground, extractionPath, files);
	return await flattenDirectory(playground, extractionPath, defaultAssetName);
}

export async function flattenDirectory(
	php: UniversalPHP,
	directoryPath: string,
	defaultName: string
) {
	const parentPath = dirname(directoryPath);

	const filesInside = await php.listFiles(directoryPath);
	if (filesInside.length === 1) {
		const onlyFilePath = joinPaths(directoryPath, filesInside[0]);
		const isDir = await php.isDir(onlyFilePath);
		if (isDir) {
			const finalPath = joinPaths(parentPath, filesInside[0]);
			await php.mv(onlyFilePath, finalPath);
			await php.rmdir(directoryPath, { recursive: true });
			return finalPath;
		}
	}

	const finalPath = joinPaths(parentPath, defaultName);
	await php.mv(directoryPath, finalPath);
	return finalPath;
}
