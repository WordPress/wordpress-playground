import { test, expect } from '../../playground-fixtures.ts';

test('playground.cli() streams stdout', async ({ website }) => {
	test.skip(
		true,
		'kernel-mode boot intentionally skips cli() plumbing; the kernel ' +
			'handler delivers WordPress via nginx + php-fpm, so cli() is ' +
			'undefined on the endpoint.'
	);
	await website.goto('./');
	// Ensure the Playground client is connected and exposed on window
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);

	const output = await website.page.evaluate(async () => {
		const playground = (window as any).playground;
		await playground.writeFile('/tmp/script.php', "<?php echo 'hi!'; ");
		const response = await playground.cli(['php', '/tmp/script.php']);
		return await response.stdoutText;
	});

	await expect(output).toContain('hi!');
});
