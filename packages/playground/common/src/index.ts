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

import type { PHPRunOptions, UniversalPHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';

export { createMemoizedFetch } from './create-memoized-fetch';

export const RecommendedPHPVersion = '8.3';

/**
 * Reports cumulative progress through non-directory ZIP entries.
 *
 * Byte counts use declared uncompressed sizes and advance only between
 * entries. Entries skipped because overwriting is disabled still count as
 * processed.
 */
export interface UnzipProgress {
	/** Number of non-directory entries processed so far. */
	filesProcessed: number;
	/** Total number of non-directory entries in the archive. */
	totalFiles: number;
	/** Declared uncompressed bytes processed so far. */
	uncompressedBytesProcessed: number;
	/** Declared uncompressed bytes across all non-directory entries. */
	totalUncompressedBytes: number;
}

const UNZIP_PROGRESS_FILES_INTERVAL = 100;
const UNZIP_PROGRESS_UNCOMPRESSED_BYTES_INTERVAL = 400 * 1024;
const UNZIP_PROGRESS_LINE_PREFIX = 'PLAYGROUND_UNZIP_PROGRESS:';

/**
 * Extracts a ZIP archive into Playground's virtual filesystem.
 *
 * `ZipArchive::extractTo()` has no extraction-progress callback in any
 * supported PHP version, so this function calls it in batches. Each batch ends
 * after either 100 files or 400 KiB of declared uncompressed data.
 *
 * For example, 250 one-byte files are extracted as three batches of 100, 100,
 * and 50 files. An `onProgress` callback receives an update after each batch.
 * Browser delivery may group fast consecutive updates. Entries remain atomic,
 * so a single file larger than 400 KiB finishes before the update.
 *
 * `ZipArchive` follows symlinks already present in the destination. Do not
 * extract into a directory containing untrusted symlinks.
 *
 * @param php - PHP runtime whose filesystem contains the archive and target.
 * @param zipPath - Archive path in the PHP filesystem, or a browser `File`.
 * @param extractToPath - Destination directory, created when it does not exist.
 * @param overwriteFiles - Whether archive entries may replace existing paths.
 * Defaults to `true`.
 * @param onProgress - Optional callback for cumulative extraction progress.
 * @returns A promise that resolves when extraction finishes.
 * @throws When extraction fails or the progress callback throws.
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
		const code = `<?php
		$zipPath = getenv('PLAYGROUND_UNZIP_ZIP_PATH');
		$extractTo = getenv('PLAYGROUND_UNZIP_EXTRACT_TO_PATH');
		$overwriteFiles =
			getenv('PLAYGROUND_UNZIP_OVERWRITE_FILES') === '1';
		$reportProgress =
			getenv('PLAYGROUND_UNZIP_REPORT_PROGRESS') === '1';
		$filesInterval =
			intval(getenv('PLAYGROUND_UNZIP_FILES_INTERVAL'));
		$uncompressedBytesInterval = intval(
			getenv('PLAYGROUND_UNZIP_UNCOMPRESSED_BYTES_INTERVAL')
		);
		$linePrefix = getenv('PLAYGROUND_UNZIP_LINE_PREFIX');

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
			$totalFiles = 0;
			$totalUncompressedBytes = 0;
			if ($reportProgress) {
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
			}

			// Keep one extraction path for all callers. Progress reporting only
			// adds the totals scan above and emits an update between batches.
			$filesProcessed = 0;
			$uncompressedBytesProcessed = 0;
			$filesSinceUpdate = 0;
			$uncompressedBytesSinceUpdate = 0;
			$lastProgressYieldAt = 0;
			$entriesToExtract = array();
			for ($i = 0; $i < $zip->numFiles; $i++) {
				$stat = $zip->statIndex($i);
				if ($stat === false) {
					throw new Exception(
						"Could not inspect ZIP entry " . $i . "."
					);
				}
				$filename = $stat['name'];
				$isDirectory = substr($filename, -1) === '/';
				$extractFilePath =
					rtrim($extractTo, '/') . '/' . $filename;
				// Leave existing paths out when $overwriteFiles is false.
				if ($overwriteFiles || !file_exists($extractFilePath)) {
					$entriesToExtract[] = $filename;
				}
				if ($isDirectory) {
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
					if ($reportProgress) {
						reportUnzipProgress(
							$linePrefix,
							$filesProcessed,
							$totalFiles,
							$uncompressedBytesProcessed,
							$totalUncompressedBytes,
							$lastProgressYieldAt
						);
					}
					$filesSinceUpdate = 0;
					$uncompressedBytesSinceUpdate = 0;
				}
			}
			extractZipBatch($zip, $extractTo, $entriesToExtract);
			if (
				$reportProgress &&
				($filesSinceUpdate > 0 ||
					$uncompressedBytesSinceUpdate > 0 ||
					$totalFiles === 0)
			) {
				reportUnzipProgress(
					$linePrefix,
					$filesProcessed,
					$totalFiles,
					$uncompressedBytesProcessed,
					$totalUncompressedBytes,
					$lastProgressYieldAt
				);
			}
		} catch (Exception $e) {
			// PHP 5.2 does not support finally.
			$zip->close();
			throw $e;
		}
		$zip->close();
		chmod($extractTo, 0777);

		/**
		 * Extracts and clears the queued ZIP entries.
		 *
		 * @param ZipArchive $zip       Open archive containing the entries.
		 * @param string     $extractTo Destination directory.
		 * @param array      $entries   Entry names to extract.
		 * @return void
		 * @throws Exception When ZipArchive cannot extract the queued entries.
		 */
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

		/**
		 * Writes and flushes one prefixed JSON progress record.
		 *
		 * @param string $linePrefix                Progress record prefix.
		 * @param int    $filesProcessed             Files processed so far.
		 * @param int    $totalFiles                 Total files in the archive.
		 * @param int    $uncompressedBytesProcessed Bytes processed so far.
		 * @param int    $totalUncompressedBytes     Total uncompressed bytes.
		 * @param float  $lastProgressYieldAt        Last event-loop yield time.
		 * @return void
		 */
		function reportUnzipProgress(
			$linePrefix,
			$filesProcessed,
			$totalFiles,
			$uncompressedBytesProcessed,
			$totalUncompressedBytes,
			&$lastProgressYieldAt
		) {
			$now = microtime(true);
			// Limit event-loop yields to keep large imports fast.
			$shouldYield =
				$lastProgressYieldAt === 0 ||
				$filesProcessed === $totalFiles ||
				$now - $lastProgressYieldAt >= 0.05;
			echo $linePrefix . json_encode(array(
				'filesProcessed' => $filesProcessed,
				'totalFiles' => $totalFiles,
				'uncompressedBytesProcessed' => $uncompressedBytesProcessed,
				'totalUncompressedBytes' => $totalUncompressedBytes,
			)) . "\\n";
			flush();
			// PHP 5.2's Asyncify build cannot suspend from a nested function call.
			if ($shouldYield && PHP_MAJOR_VERSION >= 7) {
				// PHP runs synchronously inside the worker. Yield so stdout can cross
				// the worker boundary before extraction finishes.
				usleep(0);
				$lastProgressYieldAt = microtime(true);
			}
		}
		`;
		const request: PHPRunOptions = {
			code,
			env: {
				PLAYGROUND_UNZIP_ZIP_PATH: zipPath,
				PLAYGROUND_UNZIP_EXTRACT_TO_PATH: extractToPath,
				PLAYGROUND_UNZIP_OVERWRITE_FILES: overwriteFiles ? '1' : '0',
				PLAYGROUND_UNZIP_REPORT_PROGRESS: onProgress ? '1' : '0',
				PLAYGROUND_UNZIP_FILES_INTERVAL: String(
					UNZIP_PROGRESS_FILES_INTERVAL
				),
				PLAYGROUND_UNZIP_UNCOMPRESSED_BYTES_INTERVAL: String(
					UNZIP_PROGRESS_UNCOMPRESSED_BYTES_INTERVAL
				),
				PLAYGROUND_UNZIP_LINE_PREFIX: UNZIP_PROGRESS_LINE_PREFIX,
			},
		};
		if (onProgress) {
			await runUnzipFileWithProgress(php, request, onProgress);
		} else {
			await php.run(request);
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

/**
 * Runs ZIP extraction and forwards prefixed JSON progress records from stdout.
 *
 * Stream chunks do not align with lines, so partial lines are buffered.
 * Parsing and callback failures are deferred until PHP finishes so temporary
 * archive cleanup and pooled-instance release cannot race the request. A PHP
 * process failure takes precedence.
 *
 * @param php - PHP runtime used to start the streaming request.
 * @param request - Extraction program and per-request environment variables.
 * @param onProgress - Receives each complete, valid progress record.
 * @returns A promise that resolves after the output streams and PHP process.
 * @throws When PHP, progress parsing, or `onProgress` fails.
 */
async function runUnzipFileWithProgress(
	php: UniversalPHP,
	request: PHPRunOptions,
	onProgress: (progress: UnzipProgress) => void
): Promise<void> {
	const response = await php.runStream(request);
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
	try {
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
	} finally {
		reader.releaseLock();
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
