import type { UniversalPHP } from '@php-wasm/universal';
import { writeFile } from './client-methods';
import { unzip } from './import-export';

export type AssetType = 'plugin' | 'theme';

/**
 * Install asset: Extract folder from zip file and move it to target
 */
export async function installAsset(
	playground: UniversalPHP,
	{
		type: assetType,
		zipFile,
	}: {
		type: AssetType;
		zipFile: File;
	}
): Promise<{
	assetFolderPath: string;
	assetFolderName: string;
}> {
	// Extract to temporary folder so we can find asset folder name

	const zipFileName = zipFile.name;
	const tmpFolder = `/tmp/${assetType}`;
	const tmpZipPath = `/tmp/${zipFileName}`;

	if (await playground.isDir(tmpFolder)) {
		await playground.rmdir(tmpFolder, {
			recursive: true,
		});
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
		throw new Error(
			`The ${assetType} zip file should contain a folder with ${assetType} files inside, but the provided zip file (${zipFileName}) does not contain such a folder.`
		);
	}

	// Move asset folder to target path

	const targetPath = `${await playground.documentRoot}/wp-content/${assetType}s`;

	const assetFolderPath = `${targetPath}/${assetFolderName}`;
	await playground.mv(tmpAssetPath, assetFolderPath);

	// Clean up

	await playground.rmdir(tmpFolder, {
		recursive: true,
	});

	return {
		assetFolderPath,
		assetFolderName,
	};
}
