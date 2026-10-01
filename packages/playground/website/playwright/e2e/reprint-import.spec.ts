import { test, expect } from '../playground-fixtures';

/**
 * Clones a real WordPress site served by playwright/reprint-site/serve.sh
 * into a new Playground through the UI, then checks the copy: files
 * including generated thumbnails and non-ASCII paths, rewritten URLs in
 * posts, options and custom tables, and the administrator session.
 *
 * Needs REPRINT_E2E_SITE_URL pointing at that site. CI runs it in the
 * `reprint-import` group; locally, start the site first.
 */
const siteUrl = process.env.REPRINT_E2E_SITE_URL;

test(
	'clones a live site and imports its files and database',
	{ tag: '@reprint-import' },
	async ({ website, browserName }) => {
		test.skip(!siteUrl, 'REPRINT_E2E_SITE_URL is not set.');
		test.skip(browserName !== 'chromium', 'One browser covers the pull.');
		test.setTimeout(15 * 60_000);

		const manifest = await (
			await fetch(new URL('playground-e2e-manifest.json', siteUrl))
		).json();
		const sourceOrigin = new URL(siteUrl!).origin;

		await website.goto('./');
		const page = website.page;
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		await page
			.getByRole('button', { name: 'New Playground', exact: true })
			.click();
		await page.getByRole('button', { name: 'Clone a live site' }).click();
		const pane = page.getByRole('dialog', {
			name: 'Clone a WordPress site pane',
		});
		await pane
			.getByRole('textbox', { name: 'Live site URL', exact: true })
			.fill(siteUrl!);
		await pane.getByRole('button', { name: 'Check site' }).click();
		// The key step opens only when Reprint Server answered the probe.
		const key = pane.locator('input[type=password]');
		await expect(key).toBeVisible();
		await key.fill(
			process.env.REPRINT_E2E_SECRET || 'playground-e2e-secret'
		);
		await pane.getByRole('button', { name: 'Clone site' }).click();

		const openSite = page.getByRole('button', { name: 'Open site' });
		await expect(openSite).toBeVisible({ timeout: 12 * 60_000 });
		await expect(page.getByText('Try resuming')).toHaveCount(0);

		const copy = await page.evaluate(
			async ({ manifest, sourceOrigin }) => {
				const client = (window as any).playgroundSites.getClient();
				const php = await client.run({
					code: `<?php
						require '/wordpress/wp-load.php';
						global $wpdb;
						echo json_encode([
							'home' => get_option('home'),
							'heroContent' => get_post(${manifest.heroPost})->post_content,
							'firstContent' => get_post(${manifest.firstPost})->post_content,
							'heroMeta' => get_post_meta(${manifest.heroPost}, 'playground_e2e_gallery', true),
							'settings' => get_option('playground_e2e_settings'),
							'notes' => $wpdb->get_results('SELECT note, url FROM ${manifest.notesTable} ORDER BY id', ARRAY_A),
							'published' => (int) wp_count_posts()->publish,
							'editorName' => get_user_by('login', 'editor')->display_name,
							'thumbnailUrl' => wp_get_attachment_image_url(${manifest.attachment}, 'thumbnail'),
						]);`,
				});
				// Diagnostics for CI: what the copy holds and what Reprint left behind.
				const diagnostics = await client.run({
					code: `<?php
						require '/wordpress/wp-load.php';
						global $wpdb;
						$state = [];
						foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator('/tmp/playground-reprint-state', FilesystemIterator::SKIP_DOTS)) as $file) {
							$state[] = substr($file->getPathname(), 29) . ' ' . $file->getSize();
						}
						echo json_encode([
							'posts' => $wpdb->get_results('SELECT ID, post_name, post_type, LENGTH(post_content) AS len FROM ' . $wpdb->posts . ' ORDER BY ID', ARRAY_A),
							'tables' => $wpdb->get_col('SHOW TABLES'),
							'db' => array_map(fn($f) => $f . ' ' . filesize($f), glob('/wordpress/wp-content/database/*')),
							'state' => $state,
						]);`,
				});
				// eslint-disable-next-line no-console
				console.log(
					'[reprint-import] ' + diagnostics.text.slice(0, 6000)
				);
				const admin = await client.request({ url: '/wp-admin/' });
				return {
					db: JSON.parse(php.text),
					thumbnailExists: await client.fileExists(
						'/wordpress/' + manifest.thumbnail
					),
					originalExists: await client.fileExists(
						'/wordpress/' + manifest.original
					),
					unicodeText: await client.readFileAsText(
						'/wordpress/' + manifest.unicodeFile
					),
					admin: {
						status: admin.httpStatusCode,
						text: admin.text,
					},
					sourceOrigin,
				};
			},
			{ manifest, sourceOrigin }
		);

		// Files, including sizes WordPress generated on upload.
		expect(copy.originalExists).toBe(true);
		expect(copy.thumbnailExists).toBe(true);
		expect(copy.unicodeText).toBe('unicode path\n');

		// Every stored URL now points at the copy, not the live site.
		expect(copy.db.home).not.toContain(sourceOrigin);
		expect(copy.db.firstContent).not.toContain(sourceOrigin);
		expect(copy.db.firstContent).toContain(`href="${copy.db.home}/?p=1"`);
		// Reprint v0.10.10 leaves shortcode attributes alone; the copy must
		// keep the escaped URL intact while rewriting the image block next to it.
		expect(copy.db.heroContent).toContain(
			`[vc_video link="${sourceOrigin.replace(/\//g, '\\/')}\\/wp-content\\/uploads\\/video.mp4"]`
		);
		expect(copy.db.heroContent).toContain(`<img src="${copy.db.home}/`);
		// Serialized values survive the trip intact. Reprint v0.10.10 rewrites
		// their URLs only for a target without a path, and every Playground
		// site URL carries /scope:…, so those URLs are not asserted here.
		expect(copy.db.heroMeta.sizes.thumb).toContain('/hero-150x150.jpg');
		expect(copy.db.settings.label).toBe('Zażółć gęślą jaźń');
		expect(copy.db.notes.map((row: any) => row.note)).toEqual([
			'first',
			'second',
			'third',
		]);
		expect(copy.db.published).toBe(manifest.postCount);
		expect(copy.db.editorName).toBe('Zażółć Gęślą');
		expect(copy.db.thumbnailUrl).toContain(copy.db.home);

		// The pull ends signed in as an administrator.
		expect(copy.admin.status).toBe(200);
		expect(copy.admin.text).toContain('Dashboard');

		await openSite.click();
		await expect(pane).toHaveCount(0);
	}
);
