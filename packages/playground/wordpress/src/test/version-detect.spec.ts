import {
	MinifiedWordPressVersions,
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore circular package dep so @php-wasm/node can test with the WP file-not-found callback
import { loadNodeRuntime } from '@php-wasm/node';
import { bootWordPress } from '../boot';
import {
	getLoadedWordPressVersion,
	versionStringToLoadedWordPressVersion,
} from '../version-detect';

describe('Test WP version detection', async () => {
	for (const expectedWordPressVersion of Object.keys(
		MinifiedWordPressVersions
	)) {
		it(`detects WP ${expectedWordPressVersion} at runtime`, async () => {
			const handler = await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(
					expectedWordPressVersion
				),
				sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
			});
			const loadedWordPressVersion = await getLoadedWordPressVersion(
				handler
			);
			expect(loadedWordPressVersion).to.equal(expectedWordPressVersion);
		});
	}

	it('errors when unable to read version at runtime', async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		const php = await handler.getPrimaryPhp();

		php.unlink(`${handler.documentRoot}/wp-includes/version.php`);
		const detectionResult = await getLoadedWordPressVersion(handler).then(
			() => 'no-error',
			() => 'error'
		);
		expect(detectionResult).to.equal('error');
	});

	it('errors on reading empty version at runtime', async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		const php = await handler.getPrimaryPhp();

		php.writeFile(
			`${handler.documentRoot}/wp-includes/version.php`,
			'<?php $wp_version = "";'
		);

		const detectionResult = await getLoadedWordPressVersion(handler).then(
			() => 'no-error',
			() => 'error'
		);
		expect(detectionResult).to.equal('error');
	});

	const versionMap = {
		'6.3': '6.3',
		'6.4.2': '6.4',
		'6.5': '6.5',
		'6.5.4': '6.5',
		'6.6-alpha-57783': 'nightly',
		'6.6-beta-57783': 'nightly',
		'6.6-RC-54321': 'nightly',
		'6.6-RC2-12345': 'nightly',
		'6.6-beta': 'beta',
		'6.6-beta2': 'beta',
		'6.6-RC': 'beta',
		'6.6-RC2': 'beta',
		'custom-version': 'custom-version',
	};

	for (const [input, expected] of Object.entries(versionMap)) {
		it(`maps '${input}' to '${expected}'`, () => {
			const result = versionStringToLoadedWordPressVersion(input);
			expect(result).to.equal(expected);
		});
	}
});
