import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
// eslint-disable-next-line @nx/enforce-module-boundaries
import InitialDockerfile from '../../../compile/php/Dockerfile?raw';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

describe(`Imagick – ${runtimeMode}`, () => {
	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

	const topOfTheStack: Record<string, string> = {
		// Check if imagick extension is loaded
		imagickLoaded: `
			if (!extension_loaded('imagick')) {
				throw new Exception('Imagick extension is not loaded');
			}
			echo 'imagick loaded';
		`,

		// Create a basic Imagick object
		imagickNew: `
			$imagick = new Imagick();
			if (!$imagick instanceof Imagick) {
				throw new Exception('Failed to create Imagick object');
			}
			echo 'imagick created';
		`,

		// Create an image from scratch
		imagickNewImage: `
			$imagick = new Imagick();
			$imagick->newImage(100, 100, new ImagickPixel('red'));
			$imagick->setImageFormat('png');
			if ($imagick->getImageWidth() !== 100) {
				throw new Exception('Image width is incorrect');
			}
			if ($imagick->getImageHeight() !== 100) {
				throw new Exception('Image height is incorrect');
			}
			echo 'new image created';
		`,

		// Read an image file
		imagickReadImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			if ($imagick->getImageWidth() <= 0) {
				throw new Exception('Failed to read image');
			}
			echo 'image read';
		`,

		// Resize an image
		imagickResizeImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$originalWidth = $imagick->getImageWidth();
			$imagick->resizeImage(50, 50, Imagick::FILTER_LANCZOS, 1);
			if ($imagick->getImageWidth() !== 50) {
				throw new Exception('Failed to resize image');
			}
			echo 'image resized';
		`,

		// Crop an image
		imagickCropImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->cropImage(50, 50, 0, 0);
			if ($imagick->getImageWidth() !== 50 || $imagick->getImageHeight() !== 50) {
				throw new Exception('Failed to crop image');
			}
			echo 'image cropped';
		`,

		// Rotate an image
		imagickRotateImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$originalWidth = $imagick->getImageWidth();
			$originalHeight = $imagick->getImageHeight();
			$imagick->rotateImage(new ImagickPixel('none'), 90);
			// After 90 degree rotation, width and height should be swapped
			if ($imagick->getImageWidth() !== $originalHeight) {
				throw new Exception('Failed to rotate image');
			}
			echo 'image rotated';
		`,

		// Flip an image
		imagickFlipImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->flipImage();
			echo 'image flipped';
		`,

		// Flop an image (mirror)
		imagickFlopImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->flopImage();
			echo 'image flopped';
		`,

		// Get image format
		imagickGetImageFormat: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$format = $imagick->getImageFormat();
			if (strtoupper($format) !== 'JPEG') {
				throw new Exception('Image format is incorrect: ' . $format);
			}
			echo 'format: ' . $format;
		`,

		// Set image format
		imagickSetImageFormat: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->setImageFormat('png');
			if (strtolower($imagick->getImageFormat()) !== 'png') {
				throw new Exception('Failed to set image format');
			}
			echo 'format set to png';
		`,

		// Get image blob
		imagickGetImageBlob: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->setImageFormat('png');
			$blob = $imagick->getImageBlob();
			if (strlen($blob) === 0) {
				throw new Exception('Failed to get image blob');
			}
			echo 'got blob of ' . strlen($blob) . ' bytes';
		`,

		// Create image from blob
		imagickReadImageBlob: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$originalImage = new Imagick();
			$originalImage->readImage($imagePath);
			$blob = $originalImage->getImageBlob();
			$imagick = new Imagick();
			$imagick->readImageBlob($blob);
			if ($imagick->getImageWidth() !== $originalImage->getImageWidth()) {
				throw new Exception('Failed to create image from blob');
			}
			echo 'image created from blob';
		`,

		// Blur an image
		imagickBlurImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->blurImage(5, 3);
			echo 'image blurred';
		`,

		// Add border to image
		imagickBorderImage: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$originalWidth = $imagick->getImageWidth();
			$imagick->borderImage(new ImagickPixel('red'), 10, 10);
			if ($imagick->getImageWidth() !== $originalWidth + 20) {
				throw new Exception('Failed to add border');
			}
			echo 'border added';
		`,

		// Get image properties
		imagickGetImageProperties: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$properties = $imagick->getImageProperties();
			if (!is_array($properties)) {
				throw new Exception('Failed to get image properties');
			}
			echo 'got ' . count($properties) . ' properties';
		`,

		// Set compression quality
		imagickSetCompressionQuality: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->setCompressionQuality(75);
			$quality = $imagick->getCompressionQuality();
			if ($quality !== 75) {
				throw new Exception('Failed to set compression quality');
			}
			echo 'compression quality set';
		`,

		// Clear and destroy
		imagickClearAndDestroy: `
			$imagePath = '${path
				.join(__dirname, 'test-data', 'image.jpg')
				.replace(/\\/g, '\\\\')}';
			$imagick = new Imagick();
			$imagick->readImage($imagePath);
			$imagick->clear();
			$imagick->destroy();
			echo 'imagick cleared and destroyed';
		`,
	};

	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
		});

		afterEach(async () => {
			php.exit();
		});

		describe.each(Object.keys(topOfTheStack))('%s', (testKey) => {
			const testCode = topOfTheStack[testKey];
			test('Direct call', () => assertNoCrash(testCode));
		});

		async function assertNoCrash(code: string) {
			try {
				const result = await php.run({
					code: `<?php ${code}`,
				});
				expect(result).toBeTruthy();
				expect(result.errors).toBeFalsy();
				expect(result.exitCode).toBe(0);
			} catch (e) {
				if (
					'FIX_DOCKERFILE' in process.env &&
					process.env['FIX_DOCKERFILE'] === 'true' &&
					runtimeMode == 'asyncify' &&
					'functionsMaybeMissingFromAsyncify' in php
				) {
					const missingCandidates = (
						php.functionsMaybeMissingFromAsyncify as string[]
					)
						.map((candidate) =>
							candidate.replace('byn$fpcast-emu$', '')
						)
						.filter(
							(candidate) =>
								!Dockerfile.includes(`"${candidate}"`)
						);
					if (missingCandidates.length) {
						addAsyncifyFunctionsToDockerfile(missingCandidates);
						throw new Error(
							`Asyncify crash! The following missing functions were just auto-added to the ASYNCIFY_ONLY list in the Dockerfile: \n ` +
								missingCandidates.join(', ') +
								`\nYou now need to rebuild PHP and re-run this test: \n` +
								`  npm run recompile:php:node:asyncify:8.0\n` +
								`  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'\n`
						);
					}

					const err = new Error(
						`Asyncify crash! No C functions present in the stack trace were missing ` +
							`from the Dockerfile. This could mean the stack trace is too short – try increasing the stack trace limit ` +
							`with --stack-trace-limit=100. If you already did that, fixing this problem will likely take more digging.`
					);
					err.cause = e;
					throw err;
				}
				throw e;
			}
		}
	});
});

let Dockerfile = InitialDockerfile;
const DockerfilePath = path.resolve(
	__dirname,
	'../../../compile/php/Dockerfile'
);
function addAsyncifyFunctionsToDockerfile(functions: string[]) {
	const currentDockerfile = fs.readFileSync(DockerfilePath, 'utf8') + '';
	const lookup = `export ASYNCIFY_ONLY_UNPREFIXED=$'`;
	const idx = currentDockerfile.indexOf(lookup) + lookup.length;
	const updatedDockerfile =
		currentDockerfile.substring(0, idx) +
		functions.map((f) => `"${f}",\\\n`).join('') +
		currentDockerfile.substring(idx);
	fs.writeFileSync(DockerfilePath, updatedDockerfile);
	Dockerfile = updatedDockerfile;
}
