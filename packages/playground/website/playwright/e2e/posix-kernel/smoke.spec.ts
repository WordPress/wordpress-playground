import { test, expect } from '../../playground-fixtures';

test('the kernel-mode site loads and the WordPress front page renders', async ({
	website,
	wordpress,
}) => {
	await website.goto('/');
	await expect(wordpress.locator('body')).toBeVisible();
});

test('a writeFile + runPHP blueprint executes inside the kernel', async ({
	website,
	wordpress,
}) => {
	const blueprint = {
		landingPage: '/smoke.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/smoke.php',
				data: '<?php echo "kernel ok: " . PHP_VERSION;',
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('kernel ok:');
});
