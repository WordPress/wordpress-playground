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
	let shouldCleanupTmpPath = false;
	try {
		if (zipPath instanceof File) {
			const zipFile = zipPath;
			zipPath = tmpPath;
			shouldCleanupTmpPath = true;
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
        function playground_unzip_is_path_inside($path, $root)
        {
            $path = str_replace('\\\\', '/', $path);
            $root = rtrim(str_replace('\\\\', '/', $root), '/');
            return $path === $root || strpos($path, $root . '/') === 0;
        }

        function playground_unzip_assert_realpath_inside($path, $root, $label)
        {
            $realpath = realpath($path);
            if ($realpath === false) {
                throw new Exception("Could not resolve " . $label . ": " . $path);
            }
            if (!playground_unzip_is_path_inside($realpath, $root)) {
                throw new Exception("Refusing to extract ZIP entry outside target: " . $path);
            }
        }

        function playground_unzip_copy_stream($zip, $filename, $targetPath)
        {
            if (is_link($targetPath)) {
                throw new Exception("Refusing to write ZIP entry through symlink: " . $filename);
            }
            $source = $zip->getStream($filename);
            if (!is_resource($source)) {
                throw new Exception("Could not read ZIP entry: " . $filename);
            }
            $target = fopen($targetPath, 'wb');
            if (!is_resource($target)) {
                fclose($source);
                throw new Exception("Could not write ZIP entry: " . $filename);
            }
            try {
                while (!feof($source)) {
                    $chunk = fread($source, 1048576);
                    if ($chunk === false) {
                        throw new Exception("Could not read ZIP entry: " . $filename);
                    }
                    if ($chunk !== '' && fwrite($target, $chunk) === false) {
                        throw new Exception("Could not write ZIP entry: " . $filename);
                    }
                }
            } catch (Exception $e) {
                fclose($target);
                fclose($source);
                throw $e;
            }
            fclose($target);
            fclose($source);
        }

        function playground_unzip_prepare_directory($path, $label)
        {
            $normalizedPath = str_replace('\\\\', '/', $path);
            if ($normalizedPath === '') {
                throw new Exception("Invalid " . $label . ": " . $path);
            }
            $currentPath = substr($normalizedPath, 0, 1) === '/' ? '/' : '.';
            $parts = explode('/', trim($normalizedPath, '/'));
            foreach ($parts as $part) {
                if ($part === '') {
                    continue;
                }
                if ($part === '.' || $part === '..') {
                    throw new Exception("Invalid " . $label . ": " . $path);
                }
                $currentPath = rtrim($currentPath, '/') . '/' . $part;
                if (is_link($currentPath)) {
                    throw new Exception("Refusing to create " . $label . " through symlink: " . $path);
                }
                if (file_exists($currentPath)) {
                    if (!is_dir($currentPath)) {
                        throw new Exception("Cannot create " . $label . " over file: " . $path);
                    }
                    continue;
                }
                if (!mkdir($currentPath, 0777)) {
                    throw new Exception("Could not create " . $label . ": " . $path);
                }
            }
            $realpath = realpath($path);
            if ($realpath === false) {
                throw new Exception("Could not resolve " . $label . ": " . $path);
            }
            return $realpath;
        }

        function playground_unzip_path_parts($filename)
        {
            $parts = explode('/', trim($filename, '/'));
            foreach ($parts as $part) {
                if ($part === '' || $part === '.' || $part === '..') {
                    throw new Exception("Unsafe ZIP entry path: " . $filename);
                }
            }
            return $parts;
        }

        function playground_unzip_is_symlink_entry($zip, $index)
        {
            if (!method_exists($zip, 'getExternalAttributesIndex')) {
                return false;
            }
            $opsys = 0;
            $attr = 0;
            if (!$zip->getExternalAttributesIndex($index, $opsys, $attr)) {
                return false;
            }
            $mode = ($attr >> 16) & 0170000;
            return $mode === 0120000;
        }

        function playground_unzip_ensure_directory($root, $parts, $filename)
        {
            $currentPath = $root;
            foreach ($parts as $part) {
                $currentPath .= '/' . $part;
                if (is_link($currentPath)) {
                    throw new Exception("Refusing to extract ZIP entry through symlink: " . $filename);
                }
                if (file_exists($currentPath)) {
                    if (!is_dir($currentPath)) {
                        throw new Exception("Cannot create ZIP entry directory over file: " . $filename);
                    }
                    playground_unzip_assert_realpath_inside(
                        $currentPath,
                        $root,
                        "ZIP entry directory"
                    );
                    continue;
                }
                if (!mkdir($currentPath, 0777)) {
                    throw new Exception("Could not create ZIP entry directory: " . $filename);
                }
                playground_unzip_assert_realpath_inside(
                    $currentPath,
                    $root,
                    "ZIP entry directory"
                );
            }
            return $currentPath;
        }

        function unzip($zipPath, $extractTo, $overwriteFiles = true)
        {
            $extractRoot = playground_unzip_prepare_directory(
                $extractTo,
                "ZIP extraction target"
            );
            $zip = new ZipArchive;
            $res = $zip->open($zipPath);
            if ($res === TRUE) {
				try {
					$filenames = array();
					for ($i = 0; $i < $zip->numFiles; $i++) {
						$filename = $zip->getNameIndex($i);
						if ($filename === false) {
							throw new Exception("Could not read ZIP entry name at index " . $i);
						}
						$normalizedFilename = str_replace('\\\\', '/', $filename);
						if (
							$normalizedFilename === '' ||
							substr($normalizedFilename, 0, 1) === '/' ||
							preg_match('/^[A-Za-z]:/', $normalizedFilename) ||
							preg_match('#(?:^|/)\\.(?:/|$)#', $normalizedFilename) ||
							preg_match('#(?:^|/)\\.\\.(?:/|$)#', $normalizedFilename)
						) {
							throw new Exception("Unsafe ZIP entry path: " . $filename);
						}
						if (playground_unzip_is_symlink_entry($zip, $i)) {
							throw new Exception("Refusing to extract ZIP symlink entry: " . $filename);
						}
						$filenames[] = $filename;
					}
					foreach ($filenames as $filename) {
						$normalizedFilename = str_replace('\\\\', '/', $filename);
						$pathParts = playground_unzip_path_parts($normalizedFilename);
						if (substr($normalizedFilename, -1) === '/') {
							playground_unzip_ensure_directory(
								$extractRoot,
								$pathParts,
								$filename
							);
							continue;
						}
						$entryBasename = array_pop($pathParts);
						$parentPath = playground_unzip_ensure_directory(
							$extractRoot,
							$pathParts,
							$filename
						);
						$extractFilePath = $parentPath . '/' . $entryBasename;
						if (is_link($extractFilePath)) {
							throw new Exception("Refusing to write ZIP entry through symlink: " . $filename);
						}
						if (file_exists($extractFilePath)) {
							playground_unzip_assert_realpath_inside(
								$extractFilePath,
								$extractRoot,
								"ZIP entry"
							);
							if (is_dir($extractFilePath)) {
								throw new Exception("Cannot overwrite directory with ZIP entry: " . $filename);
							}
							if (!$overwriteFiles) {
								continue;
							}
						}
						playground_unzip_copy_stream($zip, $filename, $extractFilePath);
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
		if (shouldCleanupTmpPath) {
			try {
				if (await php.fileExists(tmpPath)) {
					await php.unlink(tmpPath);
				}
			} catch {
				// Ignore cleanup failures so they do not mask the original unzip error.
			}
		}
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
			$zipRoot = rtrim($directoryPath, '/\\\\');
			$files = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator($directoryPath)
			);
			foreach ($files as $file) {
				$file = strval($file);
				if (is_dir($file)) {
					continue;
				}
				$entryName = ltrim(substr($file, strlen($zipRoot)), '/\\\\');
				$zip->addFile($file, $entryName);
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
