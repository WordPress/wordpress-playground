import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
	bootWordPressAndRequestHandler,
	getWordPressBootResult,
} from '../boot';
import type { PHPRequestHandler } from '@php-wasm/universal';

describe('WordPress install options', () => {
	it(
		'keeps the default installed site unchanged',
		async () => {
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: await getSqliteDriverModule(),
			});

			const details = await getSiteDetails(handler, {
				adminUsername: 'admin',
				adminPassword: 'password',
			});

			expect(details.installed).toBe(true);
			expect(details.blogname).toBe('My WordPress Website');
			expect(details.adminEmail).toBe('admin@localhost.com');
			expect(details.passwordMatches).toBe(true);
			expect(details.permalinkStructure).toBe(
				'/%year%/%monthnum%/%day%/%postname%/'
			);
			expect(getWordPressBootResult(handler)).toEqual({
				adminCredentialsApplied: false,
			});
		},
		{ timeout: 30_000 }
	);

	it(
		'passes provided install values to the normal installer request',
		async () => {
			const adminPassword = 'not-in-logs-secret';
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: await getSqliteDriverModule(),
				installOptions: {
					siteTitle: 'Installed From Options',
					adminUsername: 'playgroundadmin',
					adminPassword,
					adminEmail: 'playground-admin@example.com',
				},
			});

			const details = await getSiteDetails(handler, {
				adminUsername: 'playgroundadmin',
				adminPassword,
			});
			const bootResult = getWordPressBootResult(handler);

			expect(details.installed).toBe(true);
			expect(details.blogname).toBe('Installed From Options');
			expect(details.adminEmail).toBe('playground-admin@example.com');
			expect(details.passwordMatches).toBe(true);
			expect(details.permalinkStructure).toBe(
				'/%year%/%monthnum%/%day%/%postname%/'
			);
			expect(bootResult.adminCredentialsApplied).toBe(true);
			expect(JSON.stringify(bootResult)).not.toContain(adminPassword);
		},
		{ timeout: 30_000 }
	);

	it(
		'does not rerun the installer for an existing installed site',
		async () => {
			const siteDir = mkdtempSync(
				join(tmpdir(), 'playground-install-options-')
			);

			try {
				const firstHandler = await bootWordPressAndRequestHandler({
					createPhpRuntime: async () =>
						await loadNodeRuntime(RecommendedPHPVersion),
					siteUrl: 'http://playground-domain/',
					wordPressZip: await getWordPressModule(),
					sqliteIntegrationPluginZip: await getSqliteDriverModule(),
					hooks: {
						beforeWordPressFiles: async (php) => {
							await php.mount(
								'/wordpress',
								createNodeFsMountHandler(siteDir)
							);
						},
					},
					installOptions: {
						siteTitle: 'Original Site Title',
					},
				});
				await firstHandler[Symbol.asyncDispose]();

				await using secondHandler =
					await bootWordPressAndRequestHandler({
						createPhpRuntime: async () =>
							await loadNodeRuntime(RecommendedPHPVersion),
						siteUrl: 'http://playground-domain/',
						sqliteIntegrationPluginZip:
							await getSqliteDriverModule(),
						wordpressInstallMode:
							'install-from-existing-files-if-needed',
						hooks: {
							beforeWordPressFiles: async (php) => {
								await php.mount(
									'/wordpress',
									createNodeFsMountHandler(siteDir)
								);
							},
						},
						installOptions: {
							siteTitle: 'Should Not Replace Existing Title',
						},
					});

				const details = await getSiteDetails(secondHandler, {
					adminUsername: 'admin',
					adminPassword: 'password',
				});

				expect(details.installed).toBe(true);
				expect(details.blogname).toBe('Original Site Title');
				expect(details.passwordMatches).toBe(true);
			} finally {
				rmSync(siteDir, { recursive: true, force: true });
			}
		},
		{ timeout: 60_000 }
	);
});

async function getSiteDetails(
	handler: PHPRequestHandler,
	options: {
		adminUsername: string;
		adminPassword: string;
	}
) {
	const php = await handler.getPrimaryPhp();
	const result = await php.run({
		code: `<?php
			ob_start();
			require getenv('DOCUMENT_ROOT') . '/wp-load.php';
			$user = get_user_by('login', getenv('PLAYGROUND_ADMIN_USERNAME'));
			$details = array(
				'installed' => is_blog_installed(),
				'blogname' => get_option('blogname'),
				'adminEmail' => $user ? $user->user_email : null,
				'passwordMatches' => $user
					? wp_check_password(
						getenv('PLAYGROUND_ADMIN_PASSWORD'),
						$user->user_pass,
						$user->ID
					)
					: false,
				'permalinkStructure' => get_option('permalink_structure'),
			);
			ob_clean();
			echo json_encode($details);
			ob_end_flush();
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
			PLAYGROUND_ADMIN_USERNAME: options.adminUsername,
			PLAYGROUND_ADMIN_PASSWORD: options.adminPassword,
		},
	});
	return JSON.parse(result.text);
}
