import https from 'https';
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
const selfSignedCert = {
	key: fs.readFileSync(path.join(__dirname, 'test-data', 'key.pem')),
	cert: fs.readFileSync(path.join(__dirname, 'test-data', 'cert.pem')),
};
const httpsServer = https.createServer(
	{
		key: selfSignedCert.key,
		cert: selfSignedCert.cert,
	},
	requestHandler
);

const serverConfigurations = [
	{
		protocol: 'http',
		port: new Promise((resolve) => {
			httpServer.listen(0, function () {
				resolve((httpServer.address() as any).port);
			});
		}),
	},
	{
		protocol: 'https',
		port: new Promise((resolve) => {
			httpsServer.listen(0, function () {
				resolve((httpsServer.address() as any).port);
			});
		}),
	},
];

for (const serverConfiguration of serverConfigurations) {
	const protocol = serverConfiguration.protocol;
	const port = await serverConfiguration.port;
	const host = '127.0.0.1';

	const httpUrl = `${protocol}://${host}:${port}`;

	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

	const phpLoaderOptions: PHPLoaderOptions[] = [{}, { withXdebug: true }];

	describe(`${protocol} protocol – ${runtimeMode}`, () => {
		phpLoaderOptions.forEach((options) => {
			describe.each(phpVersions)(
				`PHP %s – ${runtimeMode}`,
				(phpVersion) => {
					let php: PHP;
					beforeEach(async () => {
						php = new PHP(
							await loadNodeRuntime(phpVersion as any, options)
						);
						php.writeFile(
							'/internal/shared/ca-bundle.crt',
							selfSignedCert.cert.toString()
						);
						await setPhpIniEntries(php, {
							allow_url_fopen: 1,
							'openssl.cafile': '/internal/shared/ca-bundle.crt',
							'curl.cainfo': '/internal/shared/ca-bundle.crt',
						});
					});

					afterEach(async () => {
						php.exit();
					});

					/**
					 * GD extension support
					 */
					describe('gd extension support', () => {
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

						function skipIfPhpVersionDoesnSupportAVIF() {
							if (
								['8.0', '7.4', '7.3', '7.2'].includes(
									phpVersion
								)
							) {
								console.log(
									`Skipping AVIF tests for PHP ${phpVersion} because AVIF support was added in PHP 8.1.`
								);
								return true;
							}
							return false;
						}
						describe.skipIf(skipIfPhpVersionDoesnSupportAVIF())(
							'AVIF support',
							() => {
								it('should show detailed AVIF codec information', async () => {
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

								it('should report AVIF support in gd_info()', async () => {
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

									expect(result.has_avif_key).toBe(true);
									expect(result.avif_support).toBe(true);
								});

								it('should create and encode AVIF images', async () => {
									const expectedWidth = 200;
									const expectedHeight = 200;
									const phpCode = `<?php
									$img = imagecreatetruecolor(${expectedWidth}, ${expectedHeight});
									$red = imagecolorallocate($img, 255, 0, 0);
									imagefill($img, 0, 0, $red);

									ob_start();
									$result = imageavif($img);
									$avifData = ob_get_clean();
									file_put_contents('/saved.avif', $avifData);
									imagedestroy($img);
									$last_error = error_get_last();

									if (function_exists('imagecreatefromavif')) {
										error_clear_last();
										$saved_img = @imagecreatefromavif('/saved.avif');
										if ($saved_img) {
											$saved_last_error = error_get_last();
											echo json_encode([
												'success' => $result,
												'has_data' => strlen($avifData) > 0,
												'data_size' => strlen($avifData),
												'has_ftyp' => strpos($avifData, 'ftyp') !== false,
												'has_avif' => strpos($avifData, 'avif') !== false,
												'last_error' => $last_error ? $last_error['message'] : null,
												'saved_width' => imagesx($saved_img),
												'saved_height' => imagesy($saved_img),
												'saved_is_resource' => (
													is_resource($saved_img) ||
													(is_object($saved_img) && get_class($saved_img) === 'GdImage')
												),
												'saved_last_error' => $saved_last_error ? $saved_last_error['message'] : null,
											]);

											imagedestroy($img);
										} else {
											echo json_encode(['success' => false, 'error' => 'Failed to load saved image']);
										}
									} else {
										echo json_encode(['success' => false, 'error' => 'imagecreatefromavif not available']);
									}
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
									expect(result.last_error).toBeNull();
									expect(result.saved_width).toBe(
										expectedWidth
									);
									expect(result.saved_height).toBe(
										expectedHeight
									);
									expect(result.saved_is_resource).toBe(true);
									expect(result.saved_last_error).toBeNull();
								});

								it('should load AVIF from local file', async () => {
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

									const result = JSON.parse(response.text);
									expect(result.success).toBe(true);
									expect(result.is_resource).toBe(true);
									expect(result.width).toBe(30);
									expect(result.height).toBe(30);
								});

								it('should load AVIF from remote URL', async () => {
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

									const result = JSON.parse(response.text);
									expect(result.success).toBe(true);
									expect(result.is_resource).toBe(true);
									expect(result.width).toBe(30);
									expect(result.height).toBe(30);
								});

								it('should decode AVIF created in-memory', async () => {
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

									const result = JSON.parse(response.text);
									expect(result.success).toBe(true);
									expect(result.is_resource).toBe(true);
									expect(result.width).toBe(100);
									expect(result.height).toBe(100);
								});
							}
						);
					});
				}
			);
		});
	});
}
