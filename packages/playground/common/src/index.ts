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
 *
 * Uses PHP's ZipArchive when available. Falls back to a
 * JavaScript-based implementation for legacy PHP builds
 * that lack the zip extension.
 */
export const unzipFile = async (
	php: UniversalPHP,
	zipPath: string | File,
	extractToPath: string,
	overwriteFiles = true
) => {
	// Resolve File objects to bytes for the JS fallback path,
	// and to a temp path for the PHP path.
	let zipBytes: Uint8Array | undefined;
	const tmpPath = `/tmp/file-${Math.random()}.zip`;
	if (zipPath instanceof File) {
		zipBytes = new Uint8Array(await zipPath.arrayBuffer());
		zipPath = tmpPath;
		await php.writeFile(zipPath, zipBytes);
	}

	// Check if ZipArchive is available
	const hasZipArchive =
		(
			await php.run({
				code: `<?php echo class_exists('ZipArchive') ? '1' : '0';`,
			})
		).text === '1';

	if (hasZipArchive) {
		const js = phpVars({ zipPath, extractToPath, overwriteFiles });
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
				for ($i = 0; $i < $zip->numFiles; $i++) {
					$filename = $zip->getNameIndex($i);
					$fileinfo = pathinfo($filename);
					$extractFilePath = rtrim($extractTo, '/') . '/' . $filename;
					// Check if file exists and $overwriteFiles is false
					if (!file_exists($extractFilePath) || $overwriteFiles) {
						// Extract file
						$zip->extractTo($extractTo, $filename);
					}
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
	} else {
		// Fallback: unzip in JavaScript and write files to the PHP FS.
		if (!zipBytes) {
			zipBytes = await php.readFileAsBuffer(zipPath);
		}
		await unzipFileJS(php, zipBytes, extractToPath, overwriteFiles);
	}

	if (await php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
};

/**
 * JavaScript-based unzip implementation for PHP builds
 * without ZipArchive (e.g. legacy PHP 5.6 WASM).
 */
async function unzipFileJS(
	php: UniversalPHP,
	zipBytes: Uint8Array,
	extractToPath: string,
	overwriteFiles: boolean
) {
	const { decodeZip } = await import('@php-wasm/stream-compression');
	// decodeZip uses BYOB readers, so the source stream must be
	// a byte stream (type: 'bytes' with a Uint8Array enqueue).
	const stream = new ReadableStream({
		type: 'bytes',
		start(controller) {
			controller.enqueue(zipBytes);
			controller.close();
		},
	});
	const files = decodeZip(stream);
	const reader = files.getReader();
	while (true) {
		const { done, value: file } = await reader.read();
		if (done) break;
		const filePath = extractToPath.replace(/\/$/, '') + '/' + file.name;
		if (file.type === 'directory' || file.name.endsWith('/')) {
			await php.mkdir(filePath);
		} else {
			// Ensure parent directory exists
			const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
			if (!(await php.fileExists(parentDir))) {
				await php.mkdir(parentDir);
			}
			if (overwriteFiles || !(await php.fileExists(filePath))) {
				await php.writeFile(
					filePath,
					new Uint8Array(await file.arrayBuffer())
				);
			}
		}
	}
}

export const zipDirectory = async (
	php: UniversalPHP,
	directoryPath: string
) => {
	const outputPath = `/tmp/file${Math.random()}.zip`;
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

	const fileBuffer = await php.readFileAsBuffer(outputPath);
	php.unlink(outputPath);
	return fileBuffer;
};
