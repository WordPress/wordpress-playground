import { test, expect } from './fixtures/playground-fixtures';

/**
 * The Terminal Dock pane shells into the same kernel that serves the
 * site: `/bin/bash` on a kernel PTY, started in the WordPress document
 * root. Listing the cwd through the shell and seeing WordPress core
 * files proves the whole chain — Dock pane (swapped in on the runtime
 * probe), xterm.js pane, Comlink PTY forwarding, kernel spawn — against
 * the live VFS. `wp --version` on top proves the staged WP-CLI: the
 * phar and its `wp` wrapper at `/usr/local/bin` (vfs-builder.ts
 * `populateWpCli`), including the wrapper's `phar.so` loading — any of
 * those missing and the command errors instead of naming WP-CLI. The
 * placeholder assertions pin the pane's hint contract: visible once the
 * first prompt settles, gone after the first keystroke. The `partial`
 * row assertion pins the bashrc partial-line handling: glued, the row
 * reads `partial/var/www/html $` and never matches.
 */
test('opens a shell into the kernel WordPress document root', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.openDockPane('Terminal');

	const pane = website.page.getByRole('dialog', { name: 'Terminal pane' });
	const rows = pane.locator('.xterm-rows');
	// The bash prompt (PS1 ends in '$ ') signals the PTY round-trip is live.
	await expect(rows).toContainText('$', { timeout: 60_000 });
	await expect(rows).toContainText('Type "playground"', {
		timeout: 30_000,
	});

	await pane.locator('.xterm').click();
	await website.page.keyboard.type('ls');
	await website.page.keyboard.press('Enter');

	await expect(rows).toContainText('wp-config.php', { timeout: 30_000 });
	await expect(rows).not.toContainText('Type "playground"');

	await website.page.keyboard.type('wp --version');
	await website.page.keyboard.press('Enter');

	await expect(rows).toContainText('WP-CLI', { timeout: 30_000 });

	await website.page.keyboard.type(`php -r 'echo "partial";'`);
	await website.page.keyboard.press('Enter');

	await expect(
		rows.locator('> div').filter({ hasText: /^partial\s*$/ })
	).toHaveCount(1, { timeout: 30_000 });
});
