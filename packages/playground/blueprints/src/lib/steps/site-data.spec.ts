import { NodePHP } from '@php-wasm/node';
import { getWordPressModule } from '@wp-playground/wordpress';
import { setSiteOptions } from './site-data';

describe('Blueprint step setSiteOptions()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load('8.0', {
			dataModules: [await getWordPressModule()],
			requestHandler: {
				documentRoot: '/wordpress',
			},
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
