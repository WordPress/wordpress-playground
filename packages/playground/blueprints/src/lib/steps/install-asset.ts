import type { UniversalPHP } from '@php-wasm/universal';
import { writeFile } from './client-methods';
import { unzip } from './import-export';

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
	const tmpFolder = `/tmp/assets`;
	const tmpZipPath = `/tmp/${zipFileName}`;

	async function cleanTmpFolder() {
		await playground.rmdir(tmpFolder, {
			recursive: true,
		});
	}

	if (await playground.fileExists(tmpFolder)) {
		await cleanTmpFolder();
	}

	await writeFile(playground, {
		path: tmpZipPath,
		data: zipFile,
	});

	await unzip(playground, {
		zipPath: tmpZipPath,
		extractToPath: tmpFolder,
	});

	await playground.unlink(tmpZipPath);

	// Find extracted asset folder name

	const files = await playground.listFiles(tmpFolder);

	let assetFolderName;
	let tmpAssetPath = '';

	for (const file of files) {
		tmpAssetPath = `${tmpFolder}/${file}`;
		if (await playground.isDir(tmpAssetPath)) {
			assetFolderName = file;
			break;
		}
	}

	if (!assetFolderName) {
		await cleanTmpFolder();
		throw new Error(
			`The zip file should contain a single folder with files inside, but the provided zip file (${zipFileName}) does not contain such a folder.`
		);
	}

	// Move asset folder to target path

	const assetFolderPath = `${targetPath}/${assetFolderName}`;
	await playground.mv(tmpAssetPath, assetFolderPath);

	// Clean up

	await cleanTmpFolder();

	return {
		assetFolderPath,
		assetFolderName,
	};
}
