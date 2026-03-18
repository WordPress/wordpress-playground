import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../../src/lib/base64';

test('should apply a base64-encoded Blueprint from the URL hash', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		steps: [{ step: 'login' }],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('At a Glance');
});

test('should apply a JSON Blueprint from the URL hash', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/test-page.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/test-page.php',
				data: '<?php echo "PERSONAL_WP_BLUEPRINT_TEST";',
			},
		],
	};

	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText(
		'PERSONAL_WP_BLUEPRINT_TEST'
	);
});

test('should execute a writeFile + landingPage Blueprint correctly', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/custom-output.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/custom-output.php',
				data: `<?php echo "Hello from PersonalWP e2e test";`,
			},
		],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText(
		'Hello from PersonalWP e2e test'
	);
});

test('should execute a login step and land on wp-admin', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/plugins.php',
		login: true,
	};

	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Plugins');
});

test('should handle a wp-cli step', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/edit.php',
		login: true,
		steps: [
			{
				step: 'wp-cli',
				command:
					"wp post create --post_title='E2E Test Post' --post_status=publish --no-color",
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('E2E Test Post');
});
