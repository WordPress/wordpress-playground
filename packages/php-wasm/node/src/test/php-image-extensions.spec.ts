import http from 'http';
import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import type { PHPLoaderOptions } from '../lib';
import { jspi } from 'wasm-feature-detect';
import { inferMimeType } from '@php-wasm/universal';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

const requestHandler = (
	req: http.IncomingMessage,
	res: http.ServerResponse
) => {
	if (req.url && fs.existsSync(path.join(__dirname, 'test-data', req.url))) {
		const content = fs.readFileSync(
			path.join(__dirname, 'test-data', req.url)
		);
		res.writeHead(200, { 'Content-Type': inferMimeType(req.url) });
		res.write(content);
		res.end();
	} else {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not found');
	}
};

const httpServer = http.createServer(requestHandler);
const resolvedPort = await new Promise((resolve) => {
	httpServer.listen(0, function () {
		resolve((httpServer.address() as any).port);
	});
});
const host = '127.0.0.1';

const httpUrl = `http://${host}:${resolvedPort}`;

describe(`http protocol – ${runtimeMode}`, () => {
	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

	const phpLoaderOptions: PHPLoaderOptions[] = [{}, { withXdebug: true }];

	phpLoaderOptions.forEach((options) => {
		describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
			let php: PHP;
			beforeEach(async () => {
				php = new PHP(
					await loadNodeRuntime(phpVersion as any, options)
				);
				await setPhpIniEntries(php, {
					allow_url_fopen: 1,
				});
			});

			afterEach(async () => {
				php.exit();
			});

			/**
			 * GD extension support
			 */
			describe(
				'gd extension support',
				{ skip: options.withXdebug },
				() => {
					// PHP7.4 used to crash before gd_jpeg.c modification.
					it('should be able to decode a JPEG image without crashing', async () => {
						// Generate a tiny JPEG using GD and save it to string
						const phpCode = `<?php
							$img = imagecreatetruecolor(1, 1);

							ob_start();
							imagejpeg($img);
							$data = ob_get_clean();

							$decoded = imagecreatefromstring($data);
							echo json_encode([
								'is_resource' => is_resource($decoded) || (is_object($decoded) && get_class($decoded) === 'GdImage'),
								'width' => imagesx($decoded),
								'height' => imagesy($decoded),
							]);
							?>`;

						const response = await php.run({
							code: phpCode,
						});
						const bodyText = new TextDecoder().decode(
							response.bytes
						);
						const result = JSON.parse(bodyText);

						// Vefy GD actually created an image
						expect(result).toEqual({
							is_resource: true,
							width: 1,
							height: 1,
						});
					});

					describe('AVIF support', () => {
						const isPhp81Plus = () => {
							const [major, minor] = phpVersion
								.split('.')
								.map(Number);
							return major > 8 || (major === 8 && minor >= 1);
						};

						it('should show detailed AVIF codec information for PHP 8.1+', async () => {
							if (!isPhp81Plus()) {
								return;
							}

							const phpCode = `<?php
								echo "=== GD Info ===\\n";
								$info = gd_info();
								foreach ($info as $key => $value) {
									if (is_bool($value)) {
										echo "$key: " . ($value ? 'true' : 'false') . "\\n";
									} else {
										echo "$key: $value\\n";
									}
								}

								echo "\\n=== AVIF Functions ===\\n";
								echo "imageavif: " . (function_exists('imageavif') ? 'exists' : 'missing') . "\\n";
								echo "imagecreatefromavif: " . (function_exists('imagecreatefromavif') ? 'exists' : 'missing') . "\\n";

								echo "\\n=== Test AVIF Encoding ===\\n";
								$img = imagecreatetruecolor(10, 10);
								$result = @imageavif($img);
								imagedestroy($img);
								echo "Encoding result: " . ($result ? 'SUCCESS' : 'FAILED') . "\\n";

								if (!$result) {
									echo "Last error: ";
									$err = error_get_last();
									if ($err) {
										echo $err['message'] . "\\n";
									} else {
										echo "no error captured\\n";
									}
								}
								?>`;

							const response = await php.run({
								code: phpCode,
							});
							expect(response.errors).toBe('');
						});

						it('should report AVIF support in gd_info() for PHP 8.1+', async () => {
							const response = await php.run({
								code: `<?php
										$info = gd_info();
										echo json_encode([
											'has_avif_key' => isset($info['AVIF Support']),
											'avif_support' => isset($info['AVIF Support']) ? $info['AVIF Support'] : false,
										]);
									`,
							});
							expect(response.errors).toBe('');
							const result = JSON.parse(response.text);

							if (isPhp81Plus()) {
								expect(result.has_avif_key).toBe(true);
								expect(result.avif_support).toBe(true);
							} else {
								expect(result.has_avif_key).toBe(false);
							}
						});

						it('should create and encode AVIF images for PHP 8.1+', async () => {
							if (!isPhp81Plus()) {
								// Skip for older PHP versions
								return;
							}

							const phpCode = `<?php
								$img = imagecreatetruecolor(200, 200);
								$red = imagecolorallocate($img, 255, 0, 0);
								imagefill($img, 0, 0, $red);

								ob_start();
								$result = imageavif($img);
								$avifData = ob_get_clean();
								imagedestroy($img);

								$last_error = error_get_last();
								echo json_encode([
									'success' => $result,
									'has_data' => strlen($avifData) > 0,
									'data_size' => strlen($avifData),
									'has_ftyp' => strpos($avifData, 'ftyp') !== false,
									'has_avif' => strpos($avifData, 'avif') !== false,
									'last_error' => $last_error ? $last_error['message'] : null,
								]);
								?>`;

							const response = await php.run({
								code: phpCode,
							});
							const result = JSON.parse(response.text);

							expect(result.success).toBe(true);
							expect(result.has_data).toBe(true);
							expect(result.data_size).toBeGreaterThan(0);
							expect(result.has_ftyp).toBe(true);
							expect(result.has_avif).toBe(true);
						});

						it('should load AVIF from local file for PHP 8.1+', async () => {
							await php.writeFile(
								'/image.avif',
								new Uint8Array(
									fs.readFileSync(
										path.join(
											__dirname,
											'test-data',
											'image.avif'
										)
									)
								)
							);

							const phpCode = `<?php
								if (function_exists('imagecreatefromavif')) {
									$img = @imagecreatefromavif('/image.avif');
									if ($img) {
										echo json_encode([
											'success' => true,
											'is_resource' => is_resource($img) || (is_object($img) && get_class($img) === 'GdImage'),
											'width' => imagesx($img),
											'height' => imagesy($img),
										]);
										imagedestroy($img);
									} else {
										echo json_encode(['success' => false, 'error' => 'Failed to load image']);
									}
								} else {
									echo json_encode(['success' => false, 'error' => 'imagecreatefromavif not available']);
								}
								?>`;

							const response = await php.run({
								code: phpCode,
							});

							if (isPhp81Plus()) {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(true);
								expect(result.is_resource).toBe(true);
								expect(result.width).toBe(30);
								expect(result.height).toBe(30);
							} else {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(false);
							}
						});

						it('should load AVIF from remote URL for PHP 8.1+', async () => {
							const phpCode = `<?php
								if (function_exists('imagecreatefromavif')) {
									$img = @imagecreatefromavif('${httpUrl}/image.avif');
									if ($img) {
										echo json_encode([
											'success' => true,
											'is_resource' => is_resource($img) || (is_object($img) && get_class($img) === 'GdImage'),
											'width' => imagesx($img),
											'height' => imagesy($img),
										]);
										imagedestroy($img);
									} else {
										echo json_encode(['success' => false, 'error' => 'Failed to load image']);
									}
								} else {
									echo json_encode(['success' => false, 'error' => 'imagecreatefromavif not available']);
								}
								?>`;

							const response = await php.run({
								code: phpCode,
							});

							if (isPhp81Plus()) {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(true);
								expect(result.is_resource).toBe(true);
								expect(result.width).toBe(30);
								expect(result.height).toBe(30);
							} else {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(false);
							}
						});

						it('should decode AVIF created in-memory for PHP 8.1+', async () => {
							const phpCode = `<?php
								if (!function_exists('imageavif')) {
									echo json_encode(['success' => false, 'error' => 'imageavif not available']);
									exit;
								}

								$img = imagecreatetruecolor(100, 100);
								$blue = imagecolorallocate($img, 0, 0, 255);
								imagefill($img, 0, 0, $blue);

								ob_start();
								@imageavif($img);
								$avifData = ob_get_clean();
								imagedestroy($img);

								$decoded = @imagecreatefromstring($avifData);
								if ($decoded) {
									echo json_encode([
										'success' => true,
										'is_resource' => is_resource($decoded) || (is_object($decoded) && get_class($decoded) === 'GdImage'),
										'width' => imagesx($decoded),
										'height' => imagesy($decoded),
									]);
									imagedestroy($decoded);
								} else {
									echo json_encode(['success' => false, 'error' => 'Failed to decode AVIF']);
								}
								?>`;

							const response = await php.run({
								code: phpCode,
							});

							if (isPhp81Plus()) {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(true);
								expect(result.is_resource).toBe(true);
								expect(result.width).toBe(100);
								expect(result.height).toBe(100);
							} else {
								const result = JSON.parse(response.text);
								expect(result.success).toBe(false);
							}
						});
					});
				}
			);
		});
	});
});
