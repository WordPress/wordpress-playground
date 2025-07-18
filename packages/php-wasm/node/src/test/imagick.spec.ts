import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

describe('imagick', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime('8.3', { withImagick: true }));
	});

	it('supports dynamic loading', async () => {
		const result = await php.runStream({
			code: `<?php
                echo json_encode(extension_loaded('imagick'));`,
		});

		expect(await result.stdoutText).toEqual('true');
	});

	it.skip('generate image', async () => {
		const image = await php.run({
			code: `<?php
				header('Content-type: image/jpeg');
				$image = new Imagick('image.jpg');
				$image->thumbnailImage(100, 0);
				echo $image;
			`,
		});

		console.log(image.text);
		expect(false).toBe(true);
	});
});
