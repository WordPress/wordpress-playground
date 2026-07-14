import type { FileTree, PHP, PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { collectBytes, encodeZip } from '@php-wasm/stream-compression';
import { basename } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { InMemoryFilesystem } from '@wp-playground/storage';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import {
	getSqliteDriverModule,
	getWordPressModule as loadWordPressModule,
} from '@wp-playground/wordpress-builds';
import { compileBlueprintForExecution } from '../../lib/compile';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';
import { resolveBlueprintV2WordPressSource } from '../../lib/v2/compile';
import {
	v2SchemaConformanceCases,
	v2SchemaConformanceFileContents,
} from './schema-conformance-fixtures';

const wordpressMocks = vi.hoisted(() => ({
	getWordPressStableVersions: vi.fn(),
	resolveWordPressRelease: vi.fn(),
}));
const gitMocks = vi.hoisted(() => ({
	listGitFiles: vi.fn(),
	resolveCommitHash: vi.fn(),
	sparseCheckout: vi.fn(),
}));

vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal()),
	getWordPressStableVersions: wordpressMocks.getWordPressStableVersions,
	resolveWordPressRelease: wordpressMocks.resolveWordPressRelease,
}));

vi.mock('@wp-playground/storage', async (importOriginal) => ({
	...(await importOriginal()),
	listGitFiles: gitMocks.listGitFiles,
	resolveCommitHash: gitMocks.resolveCommitHash,
	sparseCheckout: gitMocks.sparseCheckout,
}));

const installableFiles = {
	'style.css': '/*\nTheme Name: Blueprint v2 Conformance Theme\n*/',
	'index.php': '<?php echo "Blueprint v2 conformance theme";',
	'installable-plugin.php': `<?php
/**
 * Plugin Name: Blueprint v2 Conformance Plugin
 */
`,
};
const emptyZip = new Uint8Array([
	0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0,
]);
// The WP-CLI step owns command semantics. This suite only needs a local binary
// that proves the v2 declaration reaches that step without a network download.
const wpCliStub = '<?php exit(0);';

describe('Blueprint v2 schema runtime conformance', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	let wordPressZip: Awaited<ReturnType<typeof loadWordPressModule>>;
	let sqliteIntegrationPluginZip: Awaited<
		ReturnType<typeof getSqliteDriverModule>
	>;
	let importerPluginZip: Uint8Array;
	let installableZip: Uint8Array;
	let fetchSpy: { mockRestore(): void };

	beforeAll(async () => {
		[
			wordPressZip,
			sqliteIntegrationPluginZip,
			importerPluginZip,
			installableZip,
		] = await Promise.all([
			loadWordPressModule(),
			getSqliteDriverModule(),
			createImporterPluginZip(),
			createInstallableZip(),
		]);
	}, 30_000);

	beforeEach(async () => {
		wordpressMocks.getWordPressStableVersions.mockResolvedValue([
			'6.7.5',
			'6.8',
			'6.8.1',
			'6.9',
		]);
		wordpressMocks.resolveWordPressRelease.mockResolvedValue({
			version: '7.0-beta1',
			releaseUrl: 'https://wordpress.org/wordpress-7.0-beta1.zip',
			source: 'api',
		});
		gitMocks.resolveCommitHash.mockResolvedValue('conformance-commit');
		gitMocks.listGitFiles.mockResolvedValue([
			{
				name: 'installable',
				type: 'folder',
				children: Object.keys(installableFiles).map((name) => ({
					name,
					type: 'file',
				})),
			},
		]);
		gitMocks.sparseCheckout.mockImplementation(
			async (_url, _commit, paths: string[]) => ({
				files: Object.fromEntries(
					paths.map((path) => [
						path,
						installableFiles[
							basename(path) as keyof typeof installableFiles
						],
					])
				),
			})
		);
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip,
			sqliteIntegrationPluginZip,
		});
		php = await handler.getPrimaryPhp();
		fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation(fetchConformanceAsset);
	});

	afterEach(async () => {
		fetchSpy.mockRestore();
		php.exit();
		await handler[Symbol.asyncDispose]();
		vi.clearAllMocks();
	});

	it.each(v2SchemaConformanceCases)(
		'runs $name through its runtime boundaries',
		async ({ declaration }) => {
			const bundle = new InMemoryFilesystem(
				createExecutionContext(declaration)
			);
			const compiled = await compileBlueprintForExecution(bundle);
			expect(compiled.version).toBe(2);
			if (compiled.version !== 2) {
				throw new Error('Expected a compiled Blueprint v2 result.');
			}
			expect(compiled.compiled.unsupportedPlan).toEqual([]);

			// WordPress sources are pre-boot inputs, not compiled plan steps. Resolve
			// them here because compiled.run() starts only after WordPress boots.
			const customWordPressArchive =
				await resolveBlueprintV2WordPressSource(compiled.declaration, {
					streamBundledFile: (path) => bundle.read(path),
				});
			if (compiled.compiled.runtime.wpVersion === 'custom') {
				expect(customWordPressArchive).toBeInstanceOf(File);
			} else {
				expect(customWordPressArchive).toBeUndefined();
			}

			await compiled.run(php);
		},
		{ timeout: 120_000 }
	);

	/**
	 * Builds the local file bundle used by execution-context references.
	 * Every fixture receives the same paths so missing references fail consistently.
	 */
	function createExecutionContext(
		declaration: BlueprintV2Declaration
	): FileTree {
		return {
			'blueprint.json': JSON.stringify(declaration),
			assets: {
				'installable.zip': installableZip,
			},
			fonts: {
				'execution-context.woff2': v2SchemaConformanceFileContents.font,
			},
			media: {
				'execution-context.txt': v2SchemaConformanceFileContents.media,
			},
			posts: {
				'execution-context.html': v2SchemaConformanceFileContents.post,
			},
			sql: {
				'execution-context.sql': v2SchemaConformanceFileContents.sql,
			},
			wxr: {
				'execution-context.xml': v2SchemaConformanceFileContents.wxr,
			},
			php: {
				'execution-context.php': v2SchemaConformanceFileContents.php,
			},
			archives: {
				'execution-context.zip': emptyZip,
			},
			'post-types': {
				'from-file.json': JSON.stringify({
					label: 'File-backed post type',
					public: true,
				}),
			},
		};
	}

	/**
	 * Serves every remote conformance asset without leaving the test process.
	 * Unknown requests fail so a new network dependency cannot enter unnoticed.
	 */
	async function fetchConformanceAsset(input: RequestInfo | URL) {
		const url = new URL(
			input instanceof Request ? input.url : String(input)
		);
		if (
			url.hostname === 'api.wordpress.org' &&
			url.pathname === '/translations/core/1.0/'
		) {
			return new Response(
				JSON.stringify({
					translations: [
						{
							language: 'en_US',
							package:
								'https://example.com/translations/core.zip',
						},
					],
				}),
				{ status: 200 }
			);
		}
		if (url.hostname === 'downloads.wordpress.org') {
			if (url.pathname.includes('/translation/')) {
				return zipResponse(emptyZip);
			}
			if (url.pathname.includes('/plugin/wordpress-importer')) {
				return zipResponse(importerPluginZip);
			}
			return zipResponse(installableZip);
		}
		if (url.pathname.endsWith('/wp-cli.phar')) {
			return new Response(wpCliStub, { status: 200 });
		}
		if (url.hostname !== 'example.com') {
			throw new Error(`Unexpected conformance fetch: ${url.href}`);
		}

		switch (url.pathname) {
			case '/translations/core.zip':
				return zipResponse(emptyZip);
			case '/assets/installable.zip':
				return zipResponse(installableZip);
			case '/fonts/url.woff2':
				return new Response(v2SchemaConformanceFileContents.font, {
					status: 200,
				});
			case '/media/url.txt':
				return new Response(v2SchemaConformanceFileContents.media, {
					status: 200,
				});
			case '/posts/url.html':
				return new Response(v2SchemaConformanceFileContents.post, {
					status: 200,
				});
			case '/sql/url.sql':
				return new Response(v2SchemaConformanceFileContents.sql, {
					status: 200,
				});
			case '/wxr/url.xml':
				return new Response(v2SchemaConformanceFileContents.wxr, {
					status: 200,
				});
			case '/php/url.php':
				return new Response(v2SchemaConformanceFileContents.php, {
					status: 200,
				});
			case '/archives/url.zip':
				return zipResponse(emptyZip);
			default:
				throw new Error(`Unexpected conformance fetch: ${url.href}`);
		}
	}
});

/**
 * Packages the shared installable as both a valid plugin and a valid theme.
 */
async function createInstallableZip() {
	return createZip(
		Object.fromEntries(
			Object.entries(installableFiles).map(([name, contents]) => [
				`installable/${name}`,
				contents,
			])
		)
	);
}

/**
 * Packages a minimal importer with the API required by the WXR step.
 *
 * Runtime smoke tests cover real WXR imports. This local stand-in keeps the
 * schema-wide source and option matrix deterministic and fast.
 */
async function createImporterPluginZip() {
	return createZip({
		'wordpress-importer/wordpress-importer.php': `<?php
/**
 * Plugin Name: WordPress Importer
 */
class WP_Import {
	public array $authors = array();
	public bool $fetch_attachments = false;

	/** Returns an empty parsed import for the conformance fixture. */
	public function parse(string $file): array {
		return array();
	}

	/** Initializes the author map without creating WordPress users. */
	public function get_authors_from_import(array $import_data): void {
		$this->authors = array();
	}

	/** Accepts the import after the runner has exercised its option handling. */
	public function import(string $file, array $options = array()): void {}
}
`,
	});
}

/**
 * Encodes named UTF-8 fixture files into an in-memory ZIP archive.
 */
async function createZip(entries: Record<string, string>) {
	const files = Object.entries(entries).map(
		([name, contents]) => new File([contents], name)
	);
	const bytes = await collectBytes(encodeZip(files));
	if (!bytes) {
		throw new Error('Failed to create the conformance asset archive.');
	}
	return bytes;
}

/**
 * Returns archive bytes with the content type expected by resource loaders.
 */
function zipResponse(bytes: Uint8Array) {
	return new Response(bytes, {
		status: 200,
		headers: { 'Content-Type': 'application/zip' },
	});
}
