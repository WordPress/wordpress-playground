import type { UniversalPHP } from '@php-wasm/universal';
import { joinPaths, randomFilename } from '@php-wasm/util';
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
	/**
	 * Target folder name to install the asset into.
	 */
	targetFolderName?: string;
	/**
	 * What to do if the asset already exists.
	 */
	ifAlreadyInstalled?: 'overwrite' | 'skip' | 'error';
}

/**
 * Install asset: Extract folder from zip file and move it to target
 */
export async function installAsset(
	playground: UniversalPHP,
	{
		targetPath,
		zipFile,
		ifAlreadyInstalled = 'overwrite',
		targetFolderName = '',
	}: InstallAssetOptions
): Promise<{
	assetFolderPath: string;
	assetFolderName: string;
}> {
	// Extract to temporary folder so we can find asset folder name
	const zipFileName = zipFile.name;
	const assetNameGuess = zipFileName.replace(/\.zip$/, '');
	assertSafePathSegment(assetNameGuess, 'Asset ZIP filename');
	if (targetFolderName) {
		assertSafePathSegment(targetFolderName, 'Asset target folder name');
	}

	const wpContent = joinPaths(await playground.documentRoot, 'wp-content');
	const tmpDir = joinPaths(wpContent, randomFilename());
	const tmpUnzippedFilesPath = joinPaths(tmpDir, 'assets', assetNameGuess);

	if (await playground.fileExists(tmpUnzippedFilesPath)) {
		await playground.rmdir(tmpDir, {
			recursive: true,
		});
	}
	await playground.mkdir(tmpDir);

	try {
		await unzip(playground, {
			zipFile,
			extractToPath: tmpUnzippedFilesPath,
		});

		// Find the path asset folder name
		let files = await playground.listFiles(tmpUnzippedFilesPath, {
			prependPath: true,
		});
		// _unzip_file_ziparchive in WordPress skips the __MACOSX files, and so
		// should we here.
		files = files.filter((name) => !name.endsWith('/__MACOSX'));

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
		assertSafePathSegment(assetFolderName, 'Asset folder name');

		// If a specific slug was requested be used, use that.
		if (targetFolderName && targetFolderName.length) {
			assetFolderName = targetFolderName;
		}

		// Move asset folder to target path
		const assetFolderPath = `${targetPath}/${assetFolderName}`;

		// Handle the scenario when the asset is already installed.
		const skipped = await handleIfAlreadyInstalled(playground, {
			assetName: assetFolderName,
			assetPath: assetFolderPath,
			targetPath,
			ifAlreadyInstalled,
			expectedType: 'directory',
		});
		if (skipped) {
			return {
				assetFolderPath,
				assetFolderName,
			};
		}
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

export function assertSafePathSegment(value: string, label: string) {
	if (
		!value ||
		value === '.' ||
		value === '..' ||
		value.includes('/') ||
		value.includes('\\')
	) {
		throw new Error(`${label} must be a single path segment.`);
	}
}

export function assertSafeRelativeFileTree(
	files: Record<string, unknown>,
	label: string
) {
	for (const [filePath, content] of Object.entries(files)) {
		assertSafeRelativePath(filePath, label);
		if (
			content &&
			typeof content === 'object' &&
			!(content instanceof Uint8Array) &&
			!(content instanceof File)
		) {
			assertSafeRelativeFileTree(
				content as Record<string, unknown>,
				label
			);
		}
	}
}

function assertSafeRelativePath(value: string, label: string) {
	const normalized = value.replace(/\\/g, '/');
	if (
		!value ||
		normalized.startsWith('/') ||
		/^[A-Za-z]:/.test(normalized) ||
		normalized
			.split('/')
			.some((segment) => !segment || segment === '.' || segment === '..')
	) {
		throw new Error(`${label} must not escape the asset directory.`);
	}
}

export async function handleIfAlreadyInstalled(
	playground: UniversalPHP,
	{
		assetName,
		assetPath,
		targetPath,
		ifAlreadyInstalled = 'overwrite',
		expectedType,
	}: {
		assetName: string;
		assetPath: string;
		targetPath: string;
		ifAlreadyInstalled?: 'overwrite' | 'skip' | 'error';
		expectedType: 'directory' | 'file';
	}
) {
	if (!(await playground.fileExists(assetPath))) {
		return false;
	}

	const isDirectory = await playground.isDir(assetPath);
	if (expectedType === 'directory' && !isDirectory) {
		throw new Error(
			`Cannot install asset ${assetName} to ${assetPath} because a file with the same name already exists. Note it's a file, not a directory! Is this by mistake?`
		);
	}
	if (expectedType === 'file' && isDirectory) {
		throw new Error(
			`Cannot install asset ${assetName} to ${assetPath} because a directory with the same name already exists.`
		);
	}

	if (ifAlreadyInstalled === 'overwrite') {
		if (isDirectory) {
			await playground.rmdir(assetPath, {
				recursive: true,
			});
		} else {
			await playground.unlink(assetPath);
		}
		return false;
	}
	if (ifAlreadyInstalled === 'skip') {
		return true;
	}
	throw new Error(
		`Cannot install asset ${assetName} to ${targetPath} because it already exists and ` +
			`the ifAlreadyInstalled option was set to ${ifAlreadyInstalled}`
	);
}
