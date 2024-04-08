import { NodePHP } from '@php-wasm/node';
import {
	RecommendedPHPVersion,
	getWordPressModule,
} from '@wp-playground/wordpress';
import { setSiteOptions } from './site-data';
import { unzip } from './unzip';
import { defineSiteUrl } from './define-site-url';

it('should fetch 127.0.0.1:8000', async () => {
	// Add your assertions or further processing here
});

describe('Blueprint step setSiteOptions()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		const response = await fetch('http://127.0.0.1:8000');
		const data = await response.text();
		console.log('before', { data });

		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
		await defineSiteUrl(php, {
			siteUrl: 'http://127.0.0.1:9842',
		});

		await (async function () {
			const response = await fetch('http://127.0.0.1:8000');
			const data = await response.text();
			console.log('after', { data });
		})();
	});

	it('should set the site option', async () => {
		console.log('before setSiteOptions');
		await setSiteOptions(php, {
			options: {
				blogname: 'My test site!',
			},
		});
		console.log('after setSiteOptions');
		const response = await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                echo get_option('blogname');
			`,
		});
		expect(response.text).toBe('My test site!');
	});
});
