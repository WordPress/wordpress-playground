import { NodePHP } from '@php-wasm/node';
import { getWordPressModule } from '@wp-playground/wordpress';
import { setSiteOptions } from './site-data';
import { unzip } from './unzip';

describe('Blueprint step setSiteOptions()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load('7.4', {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should set the site option', async () => {
		await setSiteOptions(php, {
			options: {
				blogname: 'My test site!',
			},
		});
		const response = await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                echo get_option('blogname');
			`,
		});
		expect(response.text).toBe('My test site!');
	});
});
