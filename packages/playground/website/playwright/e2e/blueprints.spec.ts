import { test, expect } from '../playground-fixtures';
import { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../../src/lib/base64';

test('Base64-encoded Blueprints should work', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingwebsite: '/',
		steps: [{ step: 'enableMultisite' }],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);

	const bodyText = wordpress.locator('body');
	await expect(bodyText).toContainText('My Sites');
});

test('enableMultisite step should re-activate the plugins', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingwebsite: '/wp-admin/plugins.php',
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

	const deactivationLink = wordpress.locator(
		'a[aria-label="Deactivate Hello Dolly"]',
		{ hasText: 'Deactivate' }
	);
	expect(deactivationLink).toBeVisible();
});
