import fs from 'fs';
import { rootCertificates } from 'tls';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

describe(`Imagick – ${runtimeMode}`, () => {
	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;

		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, {
				allow_url_fopen: 1,
				'openssl.cafile': '/internal/shared/ca-bundle.crt',
			});
			php.writeFile(
				'/internal/shared/ca-bundle.crt',
				rootCertificates.join('\n')
			);

			// Create a simple test JPEG image in VFS
			const testImageData = fs.readFileSync(
				path.join(__dirname, 'test-data', 'image.jpg')
			);
			php.writeFile('/tmp/test-image.jpg', testImageData);
		});

		afterEach(async () => {
			php.exit();
		});

		test('imagick extension is loaded', async () => {
			const result = await php.run({
				code: `<?php echo extension_loaded('imagick') ? 'yes' : 'no';`,
			});
			expect(result.text).toBe('yes');
		});

		test('create Imagick object', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick();
					echo $imagick instanceof Imagick ? 'yes' : 'no';
				`,
			});
			expect(result.text).toBe('yes');
		});

		test('create new image from scratch', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick();
					$imagick->newImage(100, 100, new ImagickPixel('red'));
					$imagick->setImageFormat('jpeg');
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			expect(result.text).toBe('100x100');
		});

		test('read image file from VFS', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			expect(result.text).toMatch(/^\d+x\d+$/);
			expect(result.exitCode).toBe(0);
		});

		test('resize image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->resizeImage(50, 50, Imagick::FILTER_LANCZOS, 1);
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			expect(result.text).toBe('50x50');
		});

		test('crop image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$originalWidth = $imagick->getImageWidth();
					$originalHeight = $imagick->getImageHeight();
					$cropWidth = min(50, $originalWidth);
					$cropHeight = min(50, $originalHeight);
					$imagick->cropImage($cropWidth, $cropHeight, 0, 0);
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			// Should be 50x50 or smaller if original image is smaller
			const dimensions = result.text.split('x').map(Number);
			expect(dimensions[0]).toBeLessThanOrEqual(50);
			expect(dimensions[1]).toBeLessThanOrEqual(50);
			expect(dimensions[0]).toBeGreaterThan(0);
			expect(dimensions[1]).toBeGreaterThan(0);
		});

		test('rotate image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$originalWidth = $imagick->getImageWidth();
					$originalHeight = $imagick->getImageHeight();
					$imagick->rotateImage(new ImagickPixel('none'), 90);
					// After 90 degree rotation, width and height should be swapped
					echo $imagick->getImageWidth() . ',' . $originalHeight . ',' . $imagick->getImageHeight() . ',' . $originalWidth;
				`,
			});
			const [newWidth, origHeight, newHeight, origWidth] = result.text
				.split(',')
				.map(Number);
			expect(newWidth).toBe(origHeight);
			expect(newHeight).toBe(origWidth);
		});

		test('flip image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->flipImage();
					echo 'flipped';
				`,
			});
			expect(result.text).toBe('flipped');
			expect(result.exitCode).toBe(0);
		});

		test('flop image (mirror)', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->flopImage();
					echo 'flopped';
				`,
			});
			expect(result.text).toBe('flopped');
			expect(result.exitCode).toBe(0);
		});

		test('get image format', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					echo strtoupper($imagick->getImageFormat());
				`,
			});
			expect(result.text).toBe('JPEG');
		});

		test('get image blob', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$blob = $imagick->getImageBlob();
					echo strlen($blob);
				`,
			});
			const blobSize = parseInt(result.text);
			expect(blobSize).toBeGreaterThan(0);
		});

		test('create image from blob', async () => {
			const result = await php.run({
				code: `<?php
					$originalImage = new Imagick('/tmp/test-image.jpg');
					$originalWidth = $originalImage->getImageWidth();
					$blob = $originalImage->getImageBlob();
					$imagick = new Imagick();
					$imagick->readImageBlob($blob);
					echo $imagick->getImageWidth() . ',' . $originalWidth;
				`,
			});
			const [newWidth, originalWidth] = result.text
				.split(',')
				.map(Number);
			expect(newWidth).toBe(originalWidth);
		});

		test('blur image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->blurImage(5, 3);
					echo 'blurred';
				`,
			});
			expect(result.text).toBe('blurred');
			expect(result.exitCode).toBe(0);
		});

		test('add border to image', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$originalWidth = $imagick->getImageWidth();
					$imagick->borderImage(new ImagickPixel('red'), 10, 10);
					echo $imagick->getImageWidth() . ',' . $originalWidth;
				`,
			});
			const [newWidth, originalWidth] = result.text
				.split(',')
				.map(Number);
			expect(newWidth).toBe(originalWidth + 20);
		});

		test('get image properties', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$properties = $imagick->getImageProperties();
					echo count($properties);
				`,
			});
			const propertyCount = parseInt(result.text);
			expect(propertyCount).toBeGreaterThanOrEqual(0);
		});

		test('set compression quality', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->setCompressionQuality(75);
					echo $imagick->getCompressionQuality();
				`,
			});
			expect(result.text).toBe('75');
		});

		test('write image to VFS and verify', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->resizeImage(50, 50, Imagick::FILTER_LANCZOS, 1);
					$imagick->writeImage('/tmp/output.jpg');

					// Verify the file exists and is readable
					if (!file_exists('/tmp/output.jpg')) {
						echo 'error: file not found';
						exit(1);
					}

					// Verify we can read it back
					$verify = new Imagick('/tmp/output.jpg');
					echo $verify->getImageWidth() . 'x' . $verify->getImageHeight();
				`,
			});
			expect(result.text).toBe('50x50');

			// Also verify from Node.js side
			const outputFile = php.readFileAsBuffer('/tmp/output.jpg');
			expect(outputFile.byteLength).toBeGreaterThan(0);
		});

		test('clear and destroy', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->clear();
					$imagick->destroy();
					echo 'cleared';
				`,
			});
			expect(result.text).toBe('cleared');
			expect(result.exitCode).toBe(0);
		});

		test('convert JPEG to GIF', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->setImageFormat('gif');
					$imagick->writeImage('/tmp/output.gif');

					// Verify we can read it back as GIF
					$verify = new Imagick('/tmp/output.gif');
					echo strtoupper($verify->getImageFormat());
				`,
			});
			expect(result.text).toBe('GIF');

			// Verify the GIF file exists
			const gifFile = php.readFileAsBuffer('/tmp/output.gif');
			expect(gifFile.byteLength).toBeGreaterThan(0);
		});

		test('create animated GIF from multiple frames', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick();

					// Create 3 frames with different colors
					$colors = ['red', 'green', 'blue'];
					foreach ($colors as $color) {
						$frame = new Imagick();
						$frame->newImage(50, 50, new ImagickPixel($color));
						$frame->setImageFormat('gif');
						$imagick->addImage($frame);
					}

					// Set animation delay
					$imagick->setImageDelay(50);

					// Write animated GIF
					$imagick->writeImages('/tmp/animated.gif', true);

					// Verify
					$verify = new Imagick('/tmp/animated.gif');
					echo $verify->getNumberImages() . ' frames';
				`,
			});
			expect(result.text).toBe('3 frames');
		});

		test('convert JPEG to PNG', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->setImageFormat('png');
					$imagick->writeImage('/tmp/output.png');

					// Verify we can read it back as PNG
					$verify = new Imagick('/tmp/output.png');
					echo strtoupper($verify->getImageFormat());
				`,
			});
			expect(result.text).toBe('PNG');

			// Verify the PNG file exists
			const pngFile = php.readFileAsBuffer('/tmp/output.png');
			expect(pngFile.byteLength).toBeGreaterThan(0);
		});

		test('resize and save as PNG', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick('/tmp/test-image.jpg');
					$imagick->resizeImage(75, 75, Imagick::FILTER_LANCZOS, 1);
					$imagick->setImageFormat('png');
					$imagick->writeImage('/tmp/resized.png');

					// Verify
					$verify = new Imagick('/tmp/resized.png');
					echo $verify->getImageWidth() . 'x' . $verify->getImageHeight() . ' ' . strtoupper($verify->getImageFormat());
				`,
			});
			expect(result.text).toBe('75x75 PNG');
		});

		test('read image from HTTP URL', async () => {
			const result = await php.run({
				code: `<?php
					$url = 'https://raw.githubusercontent.com/WordPress/wordpress-playground/8bf0bcb0c6a20d84e17d2a09decadc674f66d964/packages/php-wasm/node/src/test/test-data/image.jpg';
					$imagick = new Imagick($url);
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			expect(result.text).toMatch(/^\d+x\d+$/);
			expect(result.exitCode).toBe(0);
		});

		test('read image from http:// wrapper', async () => {
			const result = await php.run({
				code: `<?php
					// Note: GitHub redirects http to https, so this tests the wrapper
					$url = 'http://raw.githubusercontent.com/WordPress/wordpress-playground/8bf0bcb0c6a20d84e17d2a09decadc674f66d964/packages/php-wasm/node/src/test/test-data/image.jpg';
					$imagick = new Imagick($url);
					echo $imagick->getImageWidth() . 'x' . $imagick->getImageHeight();
				`,
			});
			expect(result.text).toMatch(/^\d+x\d+$/);
			expect(result.exitCode).toBe(0);
		});

		test('process image from URL and save to VFS', async () => {
			const result = await php.run({
				code: `<?php
					$url = 'https://raw.githubusercontent.com/WordPress/wordpress-playground/8bf0bcb0c6a20d84e17d2a09decadc674f66d964/packages/php-wasm/node/src/test/test-data/image.jpg';
					$imagick = new Imagick($url);

					// Resize and convert to GIF
					$imagick->resizeImage(100, 100, Imagick::FILTER_LANCZOS, 1);
					$imagick->setImageFormat('gif');
					$imagick->writeImage('/tmp/from-url.gif');

					// Verify
					$verify = new Imagick('/tmp/from-url.gif');
					echo $verify->getImageWidth() . 'x' . $verify->getImageHeight() . ' ' . strtoupper($verify->getImageFormat());
				`,
			});
			expect(result.text).toBe('100x100 GIF');

			// Verify file from Node.js side
			const outputFile = php.readFileAsBuffer('/tmp/from-url.gif');
			expect(outputFile.byteLength).toBeGreaterThan(0);
		});

		// Playground doesn't support WebP in PHP < 8.0
		const majorPHPVersion = phpVersion?.substring(0, 1);
		test.skipIf(majorPHPVersion === '7')(
			'convert JPEG to WebP',
			async () => {
				const result = await php.run({
					code: `<?php
				$imagick = new Imagick('/tmp/test-image.jpg');
				$imagick->setImageFormat('webp');
				$imagick->writeImage('/tmp/output.webp');

				// Verify we can read it back as WebP
				$verify = new Imagick('/tmp/output.webp');
				echo strtoupper($verify->getImageFormat());
			`,
				});
				expect(result.text).toBe('WEBP');

				// Verify the WebP file exists
				const webpFile = php.readFileAsBuffer('/tmp/output.webp');
				expect(webpFile.byteLength).toBeGreaterThan(0);
			}
		);

		test.skipIf(majorPHPVersion === '7')(
			'resize and save as WebP',
			async () => {
				const result = await php.run({
					code: `<?php
				$imagick = new Imagick('/tmp/test-image.jpg');
				$imagick->resizeImage(100, 100, Imagick::FILTER_LANCZOS, 1);
				$imagick->setImageFormat('webp');
				$imagick->writeImage('/tmp/resized.webp');

				// Verify
				$verify = new Imagick('/tmp/resized.webp');
				echo $verify->getImageWidth() . 'x' . $verify->getImageHeight() . ' ' . strtoupper($verify->getImageFormat());
			`,
				});
				expect(result.text).toBe('100x100 WEBP');
			}
		);

		test('get supported image formats', async () => {
			const result = await php.run({
				code: `<?php
					$imagick = new Imagick();
					$formats = $imagick->queryFormats();

					// Check for common formats
					$hasJPEG = in_array('JPEG', $formats) || in_array('JPG', $formats);
					$hasGIF = in_array('GIF', $formats);
					$hasWEBP = in_array('WEBP', $formats);
					$hasPNG = in_array('PNG', $formats);

					echo ($hasJPEG ? 'JPEG ' : '') . ($hasGIF ? 'GIF ' : '') . ($hasWEBP ? 'WEBP ' : '') . ($hasPNG ? 'PNG' : '');
				`,
			});
			expect(result.text).toContain('JPEG');
			expect(result.text).toContain('GIF');
			expect(result.text).toContain('PNG');
			if (majorPHPVersion !== '7') {
				expect(result.text).toContain('WEBP');
			}
		});
	});
});
