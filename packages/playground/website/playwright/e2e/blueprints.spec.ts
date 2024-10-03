import { test, expect } from '../playground-fixtures';
import { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../../src/lib/base64';

test('Base64-encoded Blueprints should work', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		steps: [{ step: 'login' }],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('enableMultisite step should re-activate the plugins', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/plugins.php',
		steps: [
			{ step: 'login' },
			{
				step: 'installPlugin',
				pluginZipFile: {
					resource: 'wordpress.org/plugins',
					slug: 'hello-dolly',
				},
				options: { activate: true },
			},
			{ step: 'enableMultisite' },
		],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.getByLabel('Deactivate Hello Dolly')).toHaveText(
		'Deactivate'
	);
});

test('should resolve nice permalinks (/%postname%/)', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/sample-page/',
		steps: [
			{
				step: 'setSiteOptions',
				options: {
					permalink_structure: '/%25postname%25/', // %25 is escaped "%"
				},
			},
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					$wp_rewrite->flush_rules();
				`,
			},
			{
				step: 'setSiteOptions',
				options: {
					blogname: 'test',
				},
			},
		],
	};

	await website.goto(`/#${JSON.stringify(blueprint)}`);
	const body = wordpress.locator('body');
	await expect(body).toContainText('Sample Page');
});

test('Landing page without the initial slash should work', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: 'wp-admin/plugins.php',
		login: true,
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Plugins');
});

test('enableMultisite step should enable a multisite', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/',
		steps: [{ step: 'enableMultisite' }],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('My Sites');
});

test('wp-cli step should create a post', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post.php',
		login: true,
		steps: [
			{
				step: 'wp-cli',
				command:
					"wp post create --post_title='Test post' --post_excerpt='Some content' --no-color",
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(
		wordpress.locator('body').locator('[aria-label="“Test post” (Edit)"]')
	).toBeVisible();
});

test('PHP Shutdown should work', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		features: { networking: true },
		steps: [
			{ step: 'login' },
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/rewrite.php',
				data: "<?php add_action( 'shutdown', function() { post_message_to_js('test'); } );",
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});
