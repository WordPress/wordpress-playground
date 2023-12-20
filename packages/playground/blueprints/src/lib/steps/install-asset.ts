import type { UniversalPHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { writeFile } from './write-file';
import { unzip } from './unzip';

export interface InstallAssetOptions {
	/**
	 * The zip file to install.
	 */
	zipFile: File;
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
	{ targetPath, zipFile }: InstallAssetOptions
): Promise<{
	assetFolderPath: string;
	assetFolderName: string;
}> {
	// Extract to temporary folder so we can find asset folder name
	const zipFileName = zipFile.name;
	const assetNameGuess = zipFileName.replace(/\.zip$/, '');

	const wpContent = joinPaths(await playground.documentRoot, 'wp-content');
	const tmpDir = joinPaths(wpContent, crypto.randomUUID());
	const tmpZipPath = joinPaths(tmpDir, zipFileName);
	const tmpUnzippedFilesPath = joinPaths(tmpDir, 'assets', assetNameGuess);

	if (await playground.fileExists(tmpUnzippedFilesPath)) {
		await playground.rmdir(tmpDir, {
			recursive: true,
		});
	}
	await playground.mkdir(tmpDir);

	await writeFile(playground, {
		path: tmpZipPath,
		data: zipFile,
	});

	try {
		await unzip(playground, {
			zipPath: tmpZipPath,
			extractToPath: tmpUnzippedFilesPath,
		});

		// Find the path asset folder name
		const files = await playground.listFiles(tmpUnzippedFilesPath, {
			prependPath: true,
		});

		/**
		 * If the zip only contains a single entry that is directory,
		 * we assume that's the asset folder. Otherwise, the zip
		 * probably contains the plugin files without an intermediate folder.
		 */
		const zipHasRootFolder =
			files.length === 1 && (await playground.isDir(files[0]));
		let assetFolderName;
		let tmpAssetPath = '';
		if (zipHasRootFolder) {
			tmpAssetPath = files[0];
			assetFolderName = files[0].split('/').pop()!;
		} else {
			tmpAssetPath = tmpUnzippedFilesPath;
			assetFolderName = assetNameGuess;
		}

		// Move asset folder to target path
		const assetFolderPath = `${targetPath}/${assetFolderName}`;
		await playground.mv(tmpAssetPath, assetFolderPath);

		return {
			assetFolderPath,
			assetFolderName,
		};
	} finally {
		await playground.rmdir(tmpDir, {
			recursive: true,
		});
	}
}
