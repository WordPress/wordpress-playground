import { test, expect } from './wordpress-fixtures';
import { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../src/lib/base64';

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
