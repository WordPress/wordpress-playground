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
import { joinPaths } from '@php-wasm/util';
import { phpVars } from '@php-wasm/util';

export { createMemoizedFetch } from './create-memoized-fetch';

export const RecommendedPHPVersion = '8.3';

/**
 * Unzip a zip file inside Playground using JavaScript.
 *
 * This is the fallback for PHP runtimes that lack the ZipArchive
 * extension (e.g. PHP 5.6 WASM). It reads the zip bytes from the
 * PHP filesystem, decodes them in JS via @php-wasm/stream-compression,
 * and writes each entry back.
 */
/**
 * Parse and extract a zip file using JavaScript only.
 *
 * Iterates over the local file headers in the zip binary, decompresses
 * deflated entries via the browser's DecompressionStream, and writes
 * each file to the PHP filesystem. Supports "stored" (no compression)
 * and "deflate" methods — the only two used by standard zip tools.
 */
async function unzipFileJS(
	php: UniversalPHP,
	zipPath: string,
	extractToPath: string,
	overwriteFiles: boolean
) {
	const zipBytes = await php.readFileAsBuffer(zipPath);
	const view = new DataView(
		zipBytes.buffer,
		zipBytes.byteOffset,
		zipBytes.byteLength
	);
	let offset = 0;

	while (offset + 30 <= zipBytes.length) {
		const signature = view.getUint32(offset, true);
		// Local file header signature = 0x04034b50
		if (signature !== 0x04034b50) {
			break; // reached central directory or end
		}

		const headerStart = offset;
		const compressionMethod = view.getUint16(offset + 8, true);
		const crc32 = view.getUint32(offset + 14, true);
		const compressedSize = view.getUint32(offset + 18, true);
		const uncompressedSize = view.getUint32(offset + 22, true);
		const fileNameLength = view.getUint16(offset + 26, true);
		const extraFieldLength = view.getUint16(offset + 28, true);

		const fileNameBytes = zipBytes.subarray(
			offset + 30,
			offset + 30 + fileNameLength
		);
		const fileName = new TextDecoder().decode(fileNameBytes);

		const dataStart = offset + 30 + fileNameLength + extraFieldLength;
		const compressedData = zipBytes.subarray(
			dataStart,
			dataStart + compressedSize
		);

		offset = dataStart + compressedSize;

		const filePath = joinPaths(extractToPath, fileName);

		// Directory entry
		if (fileName.endsWith('/')) {
			php.mkdirTree(filePath);
			continue;
		}

		if (!overwriteFiles && (await php.fileExists(filePath))) {
			continue;
		}

		// Ensure parent directory exists
		const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
		if (parentDir) {
			php.mkdirTree(parentDir);
		}

		let fileData: Uint8Array;
		if (compressionMethod === 0) {
			// Stored (no compression)
			fileData = compressedData;
		} else if (compressionMethod === 8) {
			// Deflate — wrap in gzip framing so the browser's
			// DecompressionStream('gzip') can handle it.
			const gzipHeader = new Uint8Array(10);
			gzipHeader.set([0x1f, 0x8b, 0x08]);

			const gzipFooter = new Uint8Array(8);
			const footerView = new DataView(gzipFooter.buffer);
			footerView.setUint32(0, crc32, true);
			footerView.setUint32(4, uncompressedSize % 2 ** 32, true);

			const gzipData = new Uint8Array(
				gzipHeader.length + compressedData.length + gzipFooter.length
			);
			gzipData.set(gzipHeader, 0);
			gzipData.set(compressedData, gzipHeader.length);
			gzipData.set(gzipFooter, gzipHeader.length + compressedData.length);

			const ds = new DecompressionStream('gzip');
			const writer = ds.writable.getWriter();
			writer.write(gzipData);
			writer.close();

			const reader = ds.readable.getReader();
			const chunks: Uint8Array[] = [];
			let totalLen = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				totalLen += value.length;
			}
			fileData = new Uint8Array(totalLen);
			let pos = 0;
			for (const chunk of chunks) {
				fileData.set(chunk, pos);
				pos += chunk.length;
			}
		} else {
			// Unsupported compression method; skip
			continue;
		}

		await php.writeFile(filePath, fileData);
	}
}

/**
 * Unzip a zip file inside Playground.
 *
 * Tries PHP's ZipArchive first; falls back to a JavaScript-based
 * decoder for PHP runtimes without the zip extension (e.g. PHP 5.6).
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
	if (zipPath instanceof File) {
		const zipFile = zipPath;
		zipPath = tmpPath;
		await php.writeFile(
			zipPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}

	// Check if ZipArchive is available in this PHP build.
	const checkResult = await php.run({
		code: `<?php echo class_exists('ZipArchive') ? '1' : '0';`,
	});
	const hasZipArchive = checkResult.text.trim() === '1';

	if (!hasZipArchive) {
		await unzipFileJS(php, zipPath, extractToPath, overwriteFiles);
		if (await php.fileExists(tmpPath)) {
			await php.unlink(tmpPath);
		}
		return;
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
	if (await php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
};

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
