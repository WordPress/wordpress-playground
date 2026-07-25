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

export interface UnzipProgress {
	filesProcessed: number;
	totalFiles: number;
	uncompressedBytesProcessed: number;
	totalUncompressedBytes: number;
}

const UNZIP_PROGRESS_FILES_INTERVAL = 100;
const UNZIP_PROGRESS_UNCOMPRESSED_BYTES_INTERVAL = 400 * 1024;
const UNZIP_PROGRESS_LINE_PREFIX = 'PLAYGROUND_UNZIP_PROGRESS:';

/**
 * Unzip a zip file inside Playground.
 *
 * When `onProgress` is provided, extraction reports after each batch reaches
 * 100 files or 400 KiB of uncompressed data. Each ZIP entry is extracted
 * atomically, so one large entry may cross the byte threshold.
 */
export const unzipFile = async (
	php: UniversalPHP,
	zipPath: string | File,
	extractToPath: string,
	overwriteFiles = true,
	onProgress?: (progress: UnzipProgress) => void
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
			reportProgress: !!onProgress,
			filesInterval: UNZIP_PROGRESS_FILES_INTERVAL,
			uncompressedBytesInterval:
				UNZIP_PROGRESS_UNCOMPRESSED_BYTES_INTERVAL,
			linePrefix: UNZIP_PROGRESS_LINE_PREFIX,
		});
		const code = `<?php
		$zipPath = ${js.zipPath};
		$extractTo = ${js.extractToPath};
		$overwriteFiles = ${js.overwriteFiles};
		$reportProgress = ${js.reportProgress};
		$filesInterval = ${js.filesInterval};
		$uncompressedBytesInterval = ${js.uncompressedBytesInterval};
		$linePrefix = ${js.linePrefix};

		if (!is_dir($extractTo)) {
			mkdir($extractTo, 0777, true);
		}
		$zip = new ZipArchive;
		$res = $zip->open($zipPath);
		if ($res !== TRUE) {
			$fileSize = file_exists($zipPath) ? filesize($zipPath) : 'unknown';
			throw new Exception(
				"Could not unzip file. Error code: " . $res .
				". File size: " . $fileSize . " bytes."
			);
		}

		try {
			if (!$reportProgress) {
				if ($overwriteFiles) {
					if (!$zip->extractTo($extractTo)) {
						throw new Exception("Could not extract ZIP file.");
					}
				} else {
					for ($i = 0; $i < $zip->numFiles; $i++) {
						$filename = $zip->getNameIndex($i);
						if ($filename === false) {
							throw new Exception(
								"Could not inspect ZIP entry " . $i . "."
							);
						}
						$extractFilePath =
							rtrim($extractTo, '/') . '/' . $filename;
						// Leave existing paths out when $overwriteFiles is false.
						if (
							!file_exists($extractFilePath) &&
							!$zip->extractTo($extractTo, $filename)
						) {
							throw new Exception(
								"Could not extract ZIP entry " . $filename . "."
							);
						}
					}
				}
			} else {
				$totalFiles = 0;
				$totalUncompressedBytes = 0;
				for ($i = 0; $i < $zip->numFiles; $i++) {
					$stat = $zip->statIndex($i);
					if ($stat === false) {
						throw new Exception(
							"Could not inspect ZIP entry " . $i . "."
						);
					}
					if (substr($stat['name'], -1) !== '/') {
						$totalFiles++;
						$totalUncompressedBytes += $stat['size'];
					}
				}

				$filesProcessed = 0;
				$uncompressedBytesProcessed = 0;
				$filesSinceUpdate = 0;
				$uncompressedBytesSinceUpdate = 0;
				$entriesToExtract = array();
				for ($i = 0; $i < $zip->numFiles; $i++) {
					$stat = $zip->statIndex($i);
					if ($stat === false) {
						throw new Exception(
							"Could not inspect ZIP entry " . $i . "."
						);
					}
					$filename = $stat['name'];
					$extractFilePath =
						rtrim($extractTo, '/') . '/' . $filename;
					if ($overwriteFiles || !file_exists($extractFilePath)) {
						$entriesToExtract[] = $filename;
					}
					if (substr($filename, -1) === '/') {
						continue;
					}

					$filesProcessed++;
					$uncompressedBytesProcessed += $stat['size'];
					$filesSinceUpdate++;
					$uncompressedBytesSinceUpdate += $stat['size'];
					if (
						$filesSinceUpdate >= $filesInterval ||
						$uncompressedBytesSinceUpdate >=
							$uncompressedBytesInterval
					) {
						extractZipBatch($zip, $extractTo, $entriesToExtract);
						reportUnzipProgress(
							$linePrefix,
							$filesProcessed,
							$totalFiles,
							$uncompressedBytesProcessed,
							$totalUncompressedBytes
						);
						$filesSinceUpdate = 0;
						$uncompressedBytesSinceUpdate = 0;
					}
				}
				extractZipBatch($zip, $extractTo, $entriesToExtract);
				if (
					$filesSinceUpdate > 0 ||
					$uncompressedBytesSinceUpdate > 0 ||
					$totalFiles === 0
				) {
					reportUnzipProgress(
						$linePrefix,
						$filesProcessed,
						$totalFiles,
						$uncompressedBytesProcessed,
						$totalUncompressedBytes
					);
				}
			}
		} catch (Exception $e) {
			// PHP 5.2 does not support finally.
			$zip->close();
			throw $e;
		}
		$zip->close();
		chmod($extractTo, 0777);

		function extractZipBatch($zip, $extractTo, &$entries)
		{
			if (count($entries) === 0) {
				return;
			}
			if (!$zip->extractTo($extractTo, $entries)) {
				throw new Exception("Could not extract ZIP entries.");
			}
			$entries = array();
		}

		function reportUnzipProgress(
			$linePrefix,
			$filesProcessed,
			$totalFiles,
			$uncompressedBytesProcessed,
			$totalUncompressedBytes
		) {
			echo $linePrefix . json_encode(array(
				'filesProcessed' => $filesProcessed,
				'totalFiles' => $totalFiles,
				'uncompressedBytesProcessed' => $uncompressedBytesProcessed,
				'totalUncompressedBytes' => $totalUncompressedBytes,
			)) . "\\n";
			flush();
		}
		`;
		if (onProgress) {
			await runUnzipFileWithProgress(php, code, onProgress);
		} else {
			await php.run({ code });
		}
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

async function runUnzipFileWithProgress(
	php: UniversalPHP,
	code: string,
	onProgress: (progress: UnzipProgress) => void
) {
	const response = await php.runStream({ code });
	const stderrText = response.stderrText;
	const reader = response.stdout.getReader();
	const decoder = new TextDecoder();
	let buffered = '';
	let progressError: unknown;
	const processLine = (line: string) => {
		if (!line.startsWith(UNZIP_PROGRESS_LINE_PREFIX)) {
			return;
		}
		try {
			onProgress(
				JSON.parse(
					line.slice(UNZIP_PROGRESS_LINE_PREFIX.length)
				) as UnzipProgress
			);
		} catch (error) {
			progressError ??= error;
		}
	};
	while (true) {
		const { done, value } = await reader.read();
		buffered += decoder.decode(value, { stream: !done });
		let newline = buffered.indexOf('\n');
		while (newline !== -1) {
			processLine(buffered.slice(0, newline));
			buffered = buffered.slice(newline + 1);
			newline = buffered.indexOf('\n');
		}
		if (done) {
			break;
		}
	}
	if (buffered) {
		processLine(buffered);
	}
	const [exitCode, stderr] = await Promise.all([
		response.exitCode,
		stderrText,
	]);
	if (exitCode !== 0) {
		throw new Error(
			stderr.trim() ||
				`Could not unzip file. PHP exited with code ${exitCode}.`
		);
	}
	if (progressError) {
		throw progressError;
	}
}

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
