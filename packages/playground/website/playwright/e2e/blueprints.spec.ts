import { test, expect } from '../playground-fixtures';
import { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../../src/lib/base64';

test('Base64-encoded Blueprints should work', async ({
	page,
	wordpressPage,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/',
		steps: [{ step: 'enableMultisite' }],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await page.goto(`/#${encodedBlueprint}`);

	const bodyText = wordpressPage.locator('body');
	await expect(bodyText).toContainText('My Sites');
});

test('enableMultisite step should re-activate the plugins', async ({
	page,
	wordpressPage,
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
	await page.goto(`/#${encodedBlueprint}`);

	const deactivationLink = wordpressPage.locator('#deactivate-hello-dolly');
	await expect(deactivationLink).toContainText('Deactivate');
});
