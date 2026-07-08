/**
 * Avoid adding new code here. @wp-playground/common should remain
 * as lean as possible.
 *
 * This package exists to avoid circular dependencies. Let's not
 * use it as a default place to add code that doesn't seem to fit
 * anywhere else. If there's no good place for your code, perhaps
 * it needs to be restructured? Or maybe there's a need for a new package?
 * Let's always consider these questions before adding new code here.
 */

import type { UniversalPHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';

export { createMemoizedFetch } from './create-memoized-fetch';

export const RecommendedPHPVersion = '8.3';

/**
 * Unzip a zip file inside Playground.
 */
export const unzipFile = async (
	php: UniversalPHP,
	zipPath: string | File,
	extractToPath: string,
	overwriteFiles = true
) => {
	/**
	 * Use a random file name to avoid conflicts across concurrent unzipFile()
	 * calls.
	 */
	const tmpPath = `/tmp/file-${Math.random()}.zip`;
	let shouldRemoveTmpPath = false;
	try {
		if (zipPath instanceof File) {
			const zipFile = zipPath;
			zipPath = tmpPath;
			shouldRemoveTmpPath = true;
			await php.writeFile(
				zipPath,
				new Uint8Array(await zipFile.arrayBuffer())
			);
		}
		const js = phpVars({
			zipPath,
			extractToPath,
			overwriteFiles,
		});
		await php.run({
			code: `<?php
        function unzip($zipPath, $extractTo, $overwriteFiles = true)
        {
            if (!is_dir($extractTo)) {
                mkdir($extractTo, 0777, true);
            }
            $zip = new ZipArchive;
            $res = $zip->open($zipPath);
            if ($res === TRUE) {
				try {
					if ($overwriteFiles) {
						if (!$zip->extractTo($extractTo)) {
							throw new Exception('Could not extract ZIP file.');
						}
					} else {
						for ($i = 0; $i < $zip->numFiles; $i++) {
							$filename = $zip->getNameIndex($i);
							$extractFilePath = rtrim($extractTo, '/') . '/' . $filename;
							// Check if file exists and $overwriteFiles is false
							if (!file_exists($extractFilePath)) {
								// Extract file
								$zip->extractTo($extractTo, $filename);
							}
						}
					}
				} catch (Exception $e) {
					$zip->close();
					throw $e;
				}
				$zip->close();
				chmod($extractTo, 0777);
            } else {
                $fileSize = file_exists($zipPath) ? filesize($zipPath) : 'unknown';
	                throw new Exception("Could not unzip file. Error code: " . $res . ". File size: " . $fileSize . " bytes.");
	            }
		}
        unzip(${js.zipPath}, ${js.extractToPath}, ${js.overwriteFiles});
        `,
		});
	} finally {
		if (shouldRemoveTmpPath) {
			try {
				if (await php.fileExists(tmpPath)) {
					await php.unlink(tmpPath);
				}
			} catch {
				// Best-effort cleanup: preserving the unzip error matters more than
				// surfacing a leftover temporary file.
			}
		}
	}
};

export const zipDirectory = async (
	php: UniversalPHP,
	directoryPath: string
) => {
	const outputPath = `/tmp/file${Math.random()}.zip`;
	try {
		const js = phpVars({
			directoryPath,
			outputPath,
		});
		await php.run({
			code: `<?php
			/**
			 * Creates a ZIP archive from a Playground directory.
			 *
			 * The JavaScript wrapper removes the temporary archive in a finally
			 * block, so this function only owns archive creation and permissions.
			 */
			function zipDirectory($directoryPath, $outputPath) {
				$zip = new ZipArchive;
				$res = $zip->open($outputPath, ZipArchive::CREATE);
			if ($res !== TRUE) {
				throw new Exception('Failed to create ZIP');
			}
			$files = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator($directoryPath)
			);
			foreach ($files as $file) {
				$file = strval($file);
				if (is_dir($file)) {
					continue;
				}
				$zip->addFile($file, substr($file, strlen($directoryPath)));
			}
			$zip->close();
			chmod($outputPath, 0777);
		}
			zipDirectory(${js.directoryPath}, ${js.outputPath});
			`,
		});

		return await php.readFileAsBuffer(outputPath);
	} finally {
		try {
			if (await php.fileExists(outputPath)) {
				await php.unlink(outputPath);
			}
		} catch {
			// Best-effort cleanup: preserving the ZIP error matters more than
			// surfacing a leftover temporary file.
		}
	}
};
