import { test, expect } from '../playground-fixtures.ts';

test('playground.cli() streams stdout', async ({ website }) => {
	await website.goto('./');
	// Ensure the Playground client is connected and exposed on window
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);

	const output = await website.page.evaluate(async () => {
		const playground = (window as any).playground;
		let step = 'writeFile';
		try {
			await playground.writeFile('/tmp/script.php', "<?php echo 'hi!'; ");
			console.warn('[client.spec] writeFile ok');
			step = 'cli';
			const response = await playground.cli(['php', '/tmp/script.php']);
			console.warn('[client.spec] cli ok');
			step = 'stdoutText';
			return await response.stdoutText;
		} catch (error) {
			console.error('[client.spec] failed', {
				step,
				name: (error as Error)?.name,
				message: (error as Error)?.message,
				stack: (error as Error)?.stack,
			});
			throw error;
		}
	});

	await expect(output).toContain('hi!');
});
