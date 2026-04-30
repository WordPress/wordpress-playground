import { test, expect } from '../playground-fixtures.ts';

test('playground.cli() streams stdout', async ({ website }) => {
	website.page.on('console', (message) => {
		console.log(`[browser-console:${message.type()}] ${message.text()}`);
	});
	website.page.on('worker', (worker) => {
		console.log(`[browser-worker] ${worker.url()}`);
		worker.on('close', () => {
			console.log(`[browser-worker-closed] ${worker.url()}`);
		});
	});

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
