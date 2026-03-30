import { describe, it, expect } from 'vitest';
import { transpileV1toV2 } from './v1-to-v2-transpiler';

describe('transpileV1toV2', () => {
	// ============================================================
	// Basic structure
	// ============================================================

	it('sets version to 2', () => {
		const result = transpileV1toV2({});
		expect(result.version).toBe(2);
	});

	it('handles empty V1 blueprint', () => {
		const result = transpileV1toV2({});
		expect(result).toEqual({ version: 2 });
	});

	// ============================================================
	// Top-level property mapping: version constraints
	// ============================================================

	describe('version constraints', () => {
		it('maps preferredVersions.php to phpVersion', () => {
			const result = transpileV1toV2({
				preferredVersions: { php: '8.2', wp: 'latest' },
			});
			expect(result.phpVersion).toBe('8.2');
		});

		it('maps preferredVersions.wp to wordpressVersion', () => {
			const result = transpileV1toV2({
				preferredVersions: { php: '8.2', wp: '6.4' },
			});
			expect(result.wordpressVersion).toBe('6.4');
		});

		it('maps "latest" string values', () => {
			const result = transpileV1toV2({
				preferredVersions: { php: 'latest', wp: 'latest' },
			});
			expect(result.phpVersion).toBe('latest');
			expect(result.wordpressVersion).toBe('latest');
		});

		it('omits version fields when preferredVersions is absent', () => {
			const result = transpileV1toV2({});
			expect(result).not.toHaveProperty('phpVersion');
			expect(result).not.toHaveProperty('wordpressVersion');
		});
	});

	// ============================================================
	// Top-level property mapping: applicationOptions
	// ============================================================

	describe('applicationOptions', () => {
		it('maps landingPage', () => {
			const result = transpileV1toV2({ landingPage: '/wp-admin/' });
			expect(
				(result as any).applicationOptions['wordpress-playground']
					.landingPage
			).toBe('/wp-admin/');
		});

		it('maps login: true', () => {
			const result = transpileV1toV2({ login: true });
			expect(
				(result as any).applicationOptions['wordpress-playground'].login
			).toBe(true);
		});

		it('maps login object', () => {
			const result = transpileV1toV2({
				login: { username: 'admin', password: 'pass' },
			});
			expect(
				(result as any).applicationOptions['wordpress-playground'].login
			).toEqual({ username: 'admin', password: 'pass' });
		});

		it('maps features.networking to networkAccess', () => {
			const result = transpileV1toV2({
				features: { networking: true },
			});
			expect(
				(result as any).applicationOptions['wordpress-playground']
					.networkAccess
			).toBe(true);
		});

		it('combines all applicationOptions fields', () => {
			const result = transpileV1toV2({
				landingPage: '/shop/',
				login: true,
				features: { networking: true },
			});
			const opts = (result as any).applicationOptions[
				'wordpress-playground'
			];
			expect(opts.landingPage).toBe('/shop/');
			expect(opts.login).toBe(true);
			expect(opts.networkAccess).toBe(true);
		});

		it('omits applicationOptions when no relevant V1 fields', () => {
			const result = transpileV1toV2({});
			expect(result).not.toHaveProperty('applicationOptions');
		});
	});

	// ============================================================
	// Top-level property mapping: blueprintMeta
	// ============================================================

	describe('blueprintMeta', () => {
		it('maps meta.title to name', () => {
			const result = transpileV1toV2({
				meta: { title: 'My Blueprint', author: 'jdoe' },
			});
			expect((result as any).blueprintMeta.name).toBe('My Blueprint');
		});

		it('maps meta.description', () => {
			const result = transpileV1toV2({
				meta: {
					title: 'Test',
					description: 'A test',
					author: 'jdoe',
				},
			});
			expect((result as any).blueprintMeta.description).toBe('A test');
		});

		it('wraps meta.author in array', () => {
			const result = transpileV1toV2({
				meta: { title: 'Test', author: 'jdoe' },
			});
			expect((result as any).blueprintMeta.authors).toEqual(['jdoe']);
		});

		it('maps meta.categories to tags', () => {
			const result = transpileV1toV2({
				meta: {
					title: 'Test',
					author: 'jdoe',
					categories: ['ecommerce', 'starter'],
				},
			});
			expect((result as any).blueprintMeta.tags).toEqual([
				'ecommerce',
				'starter',
			]);
		});

		it('omits blueprintMeta when no meta', () => {
			const result = transpileV1toV2({});
			expect(result).not.toHaveProperty('blueprintMeta');
		});
	});

	// ============================================================
	// Declarative shorthand → steps
	// ============================================================

	describe('V1 constants', () => {
		it('transpiles constants to defineConstants step', () => {
			const result = transpileV1toV2({
				constants: { WP_DEBUG: true, DISALLOW_FILE_EDIT: true },
			});
			expect(
				(result as any).additionalStepsAfterExecution
			).toContainEqual({
				step: 'defineConstants',
				constants: { WP_DEBUG: true, DISALLOW_FILE_EDIT: true },
			});
		});
	});

	describe('V1 siteOptions', () => {
		it('transpiles siteOptions to setSiteOptions step', () => {
			const result = transpileV1toV2({
				siteOptions: { blogname: 'My Site' },
			});
			expect(
				(result as any).additionalStepsAfterExecution
			).toContainEqual({
				step: 'setSiteOptions',
				options: { blogname: 'My Site' },
			});
		});
	});

	describe('V1 plugins shorthand', () => {
		it('transpiles string plugin slugs', () => {
			const result = transpileV1toV2({
				plugins: ['hello-dolly', 'akismet'],
			});
			const steps = (result as any).additionalStepsAfterExecution;
			expect(steps).toContainEqual({
				step: 'installPlugin',
				source: 'hello-dolly',
				active: true,
			});
			expect(steps).toContainEqual({
				step: 'installPlugin',
				source: 'akismet',
				active: true,
			});
		});

		it('transpiles resource plugin entries', () => {
			const result = transpileV1toV2({
				plugins: [
					{
						resource: 'url',
						url: 'https://example.com/plugin.zip',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution
			).toContainEqual({
				step: 'installPlugin',
				source: 'https://example.com/plugin.zip',
				active: true,
			});
		});

		it('transpiles wordpress.org plugin slugs', () => {
			const result = transpileV1toV2({
				plugins: [
					{ resource: 'wordpress.org/plugins', slug: 'jetpack' },
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution
			).toContainEqual({
				step: 'installPlugin',
				source: 'jetpack',
				active: true,
			});
		});
	});

	// ============================================================
	// Step ordering
	// ============================================================

	it('orders declarative steps before explicit steps', () => {
		const result = transpileV1toV2({
			constants: { WP_DEBUG: true },
			siteOptions: { blogname: 'Test' },
			plugins: ['hello-dolly'],
			steps: [{ step: 'login' }],
		});
		const steps = (result as any).additionalStepsAfterExecution;
		const stepNames = steps.map((s: Record<string, unknown>) => s.step);
		expect(stepNames).toEqual([
			'defineConstants',
			'setSiteOptions',
			'installPlugin',
			'login',
		]);
	});

	// ============================================================
	// Per-step rewrites
	// ============================================================

	describe('step rewrites', () => {
		it('rewrites installPlugin: pluginData → source', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'url',
							url: 'https://example.com/plugin.zip',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0]
			).toMatchObject({
				step: 'installPlugin',
				source: 'https://example.com/plugin.zip',
			});
		});

		it('rewrites installPlugin: pluginZipFile → source', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginZipFile: {
							resource: 'url',
							url: 'https://example.com/p.zip',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0]
			).toMatchObject({
				step: 'installPlugin',
				source: 'https://example.com/p.zip',
			});
		});

		it('rewrites installPlugin: preserves options', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'wordpress.org/plugins',
							slug: 'woo',
						},
						options: {
							activate: false,
							targetFolderName: 'woo-custom',
						},
						ifAlreadyInstalled: 'skip',
					},
				],
			});
			const step = (result as any).additionalStepsAfterExecution[0];
			expect(step.source).toBe('woo');
			expect(step.active).toBe(false);
			expect(step.targetFolderName).toBe('woo-custom');
			expect(step.ifAlreadyInstalled).toBe('skip');
		});

		it('rewrites installTheme: themeData → source', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installTheme',
						themeData: {
							resource: 'wordpress.org/themes',
							slug: 'astra',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0]
			).toMatchObject({
				step: 'installTheme',
				source: 'astra',
			});
		});

		it('rewrites activateTheme: themeFolderName → themeDirectoryName', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'activateTheme',
						themeFolderName: 'twentytwentyfour',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'activateTheme',
				themeDirectoryName: 'twentytwentyfour',
			});
		});

		it('rewrites defineWpConfigConsts → defineConstants', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'defineWpConfigConsts',
						consts: { WP_DEBUG: true },
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'defineConstants',
				constants: { WP_DEBUG: true },
			});
		});

		it('rewrites wpCLI step name', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'wp-cli',
						command: 'wp plugin list',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0]
			).toMatchObject({
				step: 'wpCLI',
				command: 'wp plugin list',
			});
		});

		it('rewrites runPHPWithOptions → runPHP', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'runPHPWithOptions',
						options: {
							code: '<?php echo "hi"; ?>',
							env: { FOO: 'bar' },
						},
					},
				],
			});
			const step = (result as any).additionalStepsAfterExecution[0];
			expect(step.step).toBe('runPHP');
			expect(step.env).toEqual({ FOO: 'bar' });
		});

		it('rewrites importWxr → importContent', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'importWxr',
						file: {
							resource: 'url',
							url: 'https://example.com/content.xml',
						},
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'importContent',
				source: 'https://example.com/content.xml',
				type: 'wxr',
			});
		});

		it('rewrites writeFile → writeFiles', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'writeFile',
						path: '/wordpress/wp-content/test.txt',
						data: 'hello world',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0]
			).toMatchObject({
				step: 'writeFiles',
				writeToPath: '/wp-content/test.txt',
				data: 'hello world',
			});
		});

		it('rewrites runSql → runSQL', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'runSql',
						sql: {
							resource: 'url',
							url: 'https://example.com/data.sql',
						},
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'runSQL',
				source: 'https://example.com/data.sql',
			});
		});

		it('rewrites setSiteOptions step', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'setSiteOptions',
						options: { blogname: 'Test' },
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'setSiteOptions',
				options: { blogname: 'Test' },
			});
		});

		it('preserves login step fields', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'login',
						username: 'editor',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'login',
				username: 'editor',
			});
		});

		it('preserves filesystem steps with path translation', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'mkdir',
						path: '/wordpress/wp-content/uploads/test',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'mkdir',
				path: '/wp-content/uploads/test',
			});
		});

		it('preserves cp step with path translation', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'cp',
						fromPath: '/wordpress/wp-content/a.txt',
						toPath: '/wordpress/wp-content/b.txt',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'cp',
				fromPath: '/wp-content/a.txt',
				toPath: '/wp-content/b.txt',
			});
		});

		it('passes through unknown steps', () => {
			const result = transpileV1toV2({
				steps: [{ step: 'someCustomStep', foo: 'bar' }],
			});
			expect((result as any).additionalStepsAfterExecution[0]).toEqual({
				step: 'someCustomStep',
				foo: 'bar',
			});
		});

		it('filters out falsy step entries', () => {
			const result = transpileV1toV2({
				steps: [null, undefined, false, { step: 'login' }] as any,
			});
			expect((result as any).additionalStepsAfterExecution).toHaveLength(
				1
			);
			expect((result as any).additionalStepsAfterExecution[0].step).toBe(
				'login'
			);
		});
	});

	// ============================================================
	// Resource → DataReference conversion
	// ============================================================

	describe('resource conversion', () => {
		it('converts url resource to URL string', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'url',
							url: 'https://example.com/p.zip',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('https://example.com/p.zip');
		});

		it('converts literal resource to inline file', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'writeFile',
						path: '/test.txt',
						data: {
							resource: 'literal',
							name: 'test.txt',
							contents: 'hello',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].data
			).toEqual({
				filename: 'test.txt',
				content: 'hello',
			});
		});

		it('converts wordpress.org/plugins to slug string', () => {
			const result = transpileV1toV2({
				plugins: [
					{
						resource: 'wordpress.org/plugins',
						slug: 'jetpack',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('jetpack');
		});

		it('converts wordpress.org/themes to slug string', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installTheme',
						themeData: {
							resource: 'wordpress.org/themes',
							slug: 'astra',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('astra');
		});

		it('converts vfs resource to site: path', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'vfs',
							path: '/wordpress/wp-content/plugins/foo',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('site:/wp-content/plugins/foo');
		});

		it('converts bundled resource to ./ path', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'bundled',
							path: 'plugins/my-plugin.zip',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('./plugins/my-plugin.zip');
		});

		it('converts git:directory to GitPath', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'git:directory',
							url: 'https://github.com/org/repo',
							ref: 'main',
							path: 'plugins/my-plugin',
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toEqual({
				gitRepository: 'https://github.com/org/repo',
				ref: 'main',
				pathInRepository: 'plugins/my-plugin',
			});
		});

		it('converts literal:directory to InlineDirectory', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'writeFiles',
						writeToPath: '/test',
						filesTree: {
							resource: 'literal:directory',
							name: 'test-dir',
							files: { 'a.txt': 'hello' },
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].filesTree
			).toEqual({
				directoryName: 'test-dir',
				files: { 'a.txt': 'hello' },
			});
		});

		it('unwraps zip resource wrapper', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'zip',
							inner: {
								resource: 'url',
								url: 'https://example.com/files',
							},
						},
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].source
			).toBe('https://example.com/files');
		});
	});

	// ============================================================
	// Path translation
	// ============================================================

	describe('path translation', () => {
		it('strips /wordpress/ prefix from paths', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'rm',
						path: '/wordpress/wp-content/test.txt',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0].path).toBe(
				'/wp-content/test.txt'
			);
		});

		it('strips wordpress/ prefix (no leading slash)', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'rm',
						path: 'wordpress/wp-content/test.txt',
					},
				],
			});
			expect((result as any).additionalStepsAfterExecution[0].path).toBe(
				'/wp-content/test.txt'
			);
		});

		it('leaves non-wordpress paths unchanged', () => {
			const result = transpileV1toV2({
				steps: [{ step: 'rm', path: '/tmp/test.txt' }],
			});
			expect((result as any).additionalStepsAfterExecution[0].path).toBe(
				'/tmp/test.txt'
			);
		});

		it('translates /wordpress/ in PHP code', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'runPHP',
						code: "<?php require '/wordpress/wp-load.php'; ?>",
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].code
			).toContain("getenv('DOCROOT')");
			expect(
				(result as any).additionalStepsAfterExecution[0].code
			).not.toContain('/wordpress/');
		});

		it('translates activatePlugin pluginPath', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'activatePlugin',
						pluginPath: '/wordpress/wp-content/plugins/foo/foo.php',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].pluginPath
			).toBe('/wp-content/plugins/foo/foo.php');
		});

		it('translates unzip extractToPath', () => {
			const result = transpileV1toV2({
				steps: [
					{
						step: 'unzip',
						zipFile: {
							resource: 'url',
							url: 'https://example.com/files.zip',
						},
						extractToPath: '/wordpress/wp-content/plugins',
					},
				],
			});
			expect(
				(result as any).additionalStepsAfterExecution[0].extractToPath
			).toBe('/wp-content/plugins');
		});
	});

	// ============================================================
	// Complex / integration scenarios
	// ============================================================

	describe('complex blueprints', () => {
		it('transpiles a full V1 blueprint', () => {
			const v1 = {
				landingPage: '/wp-admin/',
				preferredVersions: { php: '8.2', wp: '6.4' },
				login: true,
				features: { networking: true },
				meta: {
					title: 'Test Store',
					description: 'A test store',
					author: 'testuser',
					categories: ['ecommerce'],
				},
				constants: { WP_DEBUG: true },
				siteOptions: { blogname: 'My Store' },
				plugins: ['woocommerce'],
				steps: [
					{
						step: 'installTheme',
						themeData: {
							resource: 'wordpress.org/themes',
							slug: 'storefront',
						},
						options: { activate: true },
					},
					{
						step: 'runPHP',
						code: "<?php require '/wordpress/wp-load.php'; ?>",
					},
				],
			};

			const result = transpileV1toV2(v1);

			expect(result.version).toBe(2);
			expect(result.phpVersion).toBe('8.2');
			expect(result.wordpressVersion).toBe('6.4');
			expect(
				(result as any).applicationOptions['wordpress-playground']
			).toEqual({
				landingPage: '/wp-admin/',
				login: true,
				networkAccess: true,
			});
			expect((result as any).blueprintMeta).toEqual({
				name: 'Test Store',
				description: 'A test store',
				authors: ['testuser'],
				tags: ['ecommerce'],
			});

			const steps = (result as any).additionalStepsAfterExecution;
			expect(steps).toHaveLength(5);
			expect(steps[0].step).toBe('defineConstants');
			expect(steps[1].step).toBe('setSiteOptions');
			expect(steps[2]).toMatchObject({
				step: 'installPlugin',
				source: 'woocommerce',
				active: true,
			});
			expect(steps[3]).toMatchObject({
				step: 'installTheme',
				source: 'storefront',
				active: true,
			});
			expect(steps[4].step).toBe('runPHP');
			expect(steps[4].code).toContain("getenv('DOCROOT')");
		});

		it('handles blueprint with only steps', () => {
			const result = transpileV1toV2({
				steps: [{ step: 'login' }],
			});
			expect(result.version).toBe(2);
			expect((result as any).additionalStepsAfterExecution).toEqual([
				{ step: 'login' },
			]);
		});
	});
});
