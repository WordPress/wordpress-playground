import test, { expect } from '@playwright/test';
import type { DirectoryHandleMount } from '../lib/directory-handle-mount';

test('saves and restores symlinks in real browser OPFS', async ({ page }) => {
	await page.goto('/');
	await page.addScriptTag({
		type: 'module',
		url: '/src/test/playwright/browser-globals.ts',
	});
	const result = await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const name = `symlink-test-${crypto.randomUUID()}`;
		const saved = await root.getDirectoryHandle(name, { create: true });
		const php = new window.PHP(await window.loadWebRuntime('8.4'));
		let mount!: DirectoryHandleMount;
		let unmount: (() => Promise<void>) | undefined;
		try {
			php.mkdir('/site/dir');
			php.writeFile('/site/dir/file.txt', 'old');
			php.mkdir('/shared');
			php.writeFile('/shared/file.txt', 'keep outside file');
			php.symlink('./file.txt', '/site/dir/link');
			php.symlink('../missing', '/site/broken');
			php.symlink('.', '/site/cycle');
			php.symlink('/shared', '/site/outside');
			unmount = await php.mount(
				'/site',
				window.createDirectoryHandleMountHandler(saved, {
					initialSync: { direction: 'memfs-to-opfs' },
					onMount: (value) => {
						mount = value;
					},
				})
			);
			await mount.flush();
			await php.run({
				code: `<?php
				file_put_contents('/site/dir/link', 'new');
				rename('/site/dir', '/site/moved');
				symlink('./moved/file.txt', '/site/new-link');
				rename('/site/broken', '/site/renamed');
			`,
			});
			await unmount();
			unmount = undefined;
			unmount = await php.mount(
				'/site',
				window.createDirectoryHandleMountHandler(saved)
			);
			const outsideFileAfterRemount =
				php.readFileAsText('/shared/file.txt');
			await unmount();
			unmount = undefined;
			php.exit();
			const restored = new window.PHP(await window.loadWebRuntime('8.4'));
			try {
				unmount = await restored.mount(
					'/site',
					window.createDirectoryHandleMountHandler(saved)
				);
				return {
					outsideFileAfterRemount,
					paths: restored.listFiles('/site').sort(),
					directoryTarget: restored.readlink('/site/moved/link'),
					file: restored.readFileAsText('/site/moved/link'),
					newTarget: restored.readlink('/site/new-link'),
					brokenTarget: restored.readlink('/site/renamed'),
					cycleTarget: restored.readlink('/site/cycle'),
					outsideTarget: restored.readlink('/site/outside'),
				};
			} finally {
				await unmount?.();
				unmount = undefined;
				restored.exit();
			}
		} finally {
			await unmount?.();
			php.exit();
			await root.removeEntry(name, { recursive: true });
		}
	});
	expect(result).toEqual({
		outsideFileAfterRemount: 'keep outside file',
		paths: ['cycle', 'moved', 'new-link', 'outside', 'renamed'],
		directoryTarget: './file.txt',
		file: 'new',
		newTarget: './moved/file.txt',
		brokenTarget: '../missing',
		cycleTarget: '.',
		outsideTarget: '/shared',
	});
});
