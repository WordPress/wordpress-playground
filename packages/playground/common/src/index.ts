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
					$entries = array();
					for ($i = 0; $i < $zip->numFiles; $i++) {
						$filename = $zip->getNameIndex($i);
						$entries[] = array(
							'filename' => $filename,
							'extractFilePath' => get_safe_zip_entry_path(
								$extractTo,
								$filename
							),
							'isDirectory' => substr($filename, -1) === '/',
						);
					}
					foreach ($entries as $entry) {
						if (
							!file_exists($entry['extractFilePath']) ||
							$overwriteFiles
						) {
							extract_zip_entry($zip, $entry);
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

		function get_safe_zip_entry_path($extractTo, $entryName) {
			if ($entryName === '' || strpos($entryName, "\0") !== false) {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			$entryNameForValidation = ltrim($entryName, '/');
			if ($entryNameForValidation === '') {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			if ($entryNameForValidation[0] === '\\\\') {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			if (preg_match('/^[A-Za-z]:[\\\\\\\\\\/]/', $entryNameForValidation)) {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			if (strpos($entryNameForValidation, '\\\\') !== false) {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			$normalizedParts = array();
			foreach (explode('/', $entryNameForValidation) as $part) {
				if ($part === '' || $part === '.') {
					continue;
				}
				if ($part === '..') {
					throw new Exception('Unsafe ZIP entry name: ' . $entryName);
				}
				$normalizedParts[] = $part;
			}
			if (count($normalizedParts) === 0) {
				throw new Exception('Unsafe ZIP entry name: ' . $entryName);
			}
			return rtrim($extractTo, '/') . '/' . implode('/', $normalizedParts);
		}

		function extract_zip_entry($zip, $entry) {
			$extractFilePath = $entry['extractFilePath'];
			if ($entry['isDirectory']) {
				if (!is_dir($extractFilePath)) {
					mkdir($extractFilePath, 0777, true);
				}
				return;
			}

			$parentDirectory = dirname($extractFilePath);
			if (!is_dir($parentDirectory)) {
				mkdir($parentDirectory, 0777, true);
			}
			$source = $zip->getStream($entry['filename']);
			if ($source === false) {
				throw new Exception(
					'Could not read ZIP entry: ' . $entry['filename']
				);
			}
			$target = fopen($extractFilePath, 'wb');
			if ($target === false) {
				fclose($source);
				throw new Exception(
					'Could not write ZIP entry: ' . $entry['filename']
				);
			}
			try {
				$copyResult = stream_copy_to_stream($source, $target);
			} catch (Exception $e) {
				fclose($source);
				fclose($target);
				throw $e;
			}
			fclose($source);
			fclose($target);
			if ($copyResult === false) {
				throw new Exception(
					'Could not extract ZIP entry: ' . $entry['filename']
				);
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
