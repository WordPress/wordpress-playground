import { test, expect } from '../playground-fixtures.ts';

test('playground.cli() streams stdout', async ({ website }) => {
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

test('playground.captureSiteThumbnail() captures the front page', async ({
	website,
}) => {
	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);

	const thumbnail = await website.page.evaluate(async () => {
		const playground = (window as any).playground;
		return await playground.captureSiteThumbnail();
	});

	expect(thumbnail.mime).toMatch(/^image\/(webp|jpeg)$/);
	expect(thumbnail.data.length).toBeGreaterThan(0);
	const dimensions = await website.page.evaluate(async ({ mime, data }) => {
		const image = new Image();
		image.src = `data:${mime};base64,${data}`;
		await image.decode();
		return {
			width: image.naturalWidth,
			height: image.naturalHeight,
		};
	}, thumbnail);
	expect(dimensions).toEqual({ width: 320, height: 240 });
});
