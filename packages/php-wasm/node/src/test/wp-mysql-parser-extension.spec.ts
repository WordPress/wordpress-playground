import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { PHP } from '@php-wasm/universal';
import { unzipFile } from '@wp-playground/common';
import { loadNodeRuntime, type PHPLoaderExtension } from '../lib';

const parserExtensionManifestUrl = new URL(
	'../../../../playground/wordpress-builds/src/sqlite-database-integration/wp-mysql-parser/manifest.json',
	import.meta.url
);
const sqliteIntegrationZipUrl = new URL(
	'../../../../playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-pr388.zip',
	import.meta.url
);

describe('WP MySQL parser PHP.wasm extension', () => {
	let phpInstances: PHP[] = [];

	afterEach(() => {
		for (const php of phpInstances) {
			php.exit();
		}
		phpInstances = [];
	});

	it('loads the PR388 native parser extension through the runtime manifest and processes 5000 long queries', async () => {
		expect(existsSync(fileURLToPath(parserExtensionManifestUrl))).toBe(
			true
		);
		expect(existsSync(fileURLToPath(sqliteIntegrationZipUrl))).toBe(true);

		const fallback = await runParserBenchmark({
			loadNativeExtension: false,
		});
		const native = await runParserBenchmark({
			loadNativeExtension: true,
		});

		expect(fallback).toMatchObject({
			extensionLoaded: false,
			nativeLexerUsed: false,
			processedQueries: 5000,
		});
		expect(native).toMatchObject({
			extensionLoaded: true,
			nativeLexerUsed: true,
			processedQueries: 5000,
		});
		expect(native.totalTokens).toBeGreaterThan(0);
		expect(fallback.totalTokens).toBeGreaterThan(0);
		expect(native.durationMs).toBeLessThan(fallback.durationMs);
	}, 180_000);

	async function runParserBenchmark({
		loadNativeExtension,
	}: {
		loadNativeExtension: boolean;
	}): Promise<ParserBenchmarkResult> {
		const extensions: PHPLoaderExtension[] = loadNativeExtension
			? [
					{
						source: {
							format: 'manifest',
							manifestUrl: parserExtensionManifestUrl,
						},
						fetch: fetchLocalFile,
					},
				]
			: [];
		const php = new PHP(
			await loadNodeRuntime('8.4', {
				extensions,
			})
		);
		phpInstances.push(php);

		await unzipFile(
			php,
			new File(
				[readFileSync(fileURLToPath(sqliteIntegrationZipUrl)) as any],
				'sqlite-database-integration-pr388.zip'
			),
			'/tmp/sqlite-driver'
		);

		const result = await php.run({
			code: parserBenchmarkPhp,
		});

		expect(result.errors).toBeFalsy();
		return JSON.parse(result.text) as ParserBenchmarkResult;
	}
});

interface ParserBenchmarkResult {
	extensionLoaded: boolean;
	nativeLexerUsed: boolean;
	processedQueries: number;
	totalTokens: number;
	durationMs: number;
}

const parserBenchmarkPhp = `<?php
$lexer_class_path = '/tmp/sqlite-driver/plugin-sqlite-database-integration/wp-includes/database/mysql/class-wp-mysql-lexer.php';
if (extension_loaded('wp_mysql_parser')) {
	file_put_contents($lexer_class_path, <<<'PHP'
<?php

require_once __DIR__ . '/class-wp-mysql-polyfill-lexer.php';

if (class_exists('WP_MySQL_Native_Lexer', false)) {
	class WP_MySQL_Lexer extends WP_MySQL_Polyfill_Lexer {
		private $native_lexer;

		public function __construct(
			string $sql,
			int $mysql_version = 80038,
			array $sql_modes = array()
		) {
			parent::__construct($sql, $mysql_version, $sql_modes);
			$this->native_lexer = new WP_MySQL_Native_Lexer(
				$sql,
				$mysql_version,
				$sql_modes
			);
		}

		public function native_token_stream() {
			return $this->native_lexer->native_token_stream();
		}
	}
} else {
	require_once __DIR__ . '/class-wp-mysql-native-lexer.php';

	class WP_MySQL_Lexer extends WP_MySQL_Native_Lexer {
	}
}
PHP);
}

require_once '/tmp/sqlite-driver/plugin-sqlite-database-integration/wp-includes/database/load.php';

$driver = new WP_PDO_MySQL_On_SQLite(
	'mysql-on-sqlite:dbname=playground_native_parser_benchmark;path=:memory:'
);
$query_count = 5000;
$processed_queries = 0;
$total_tokens = 0;
$started_at = hrtime(true);

for ($i = 0; $i < $query_count; $i++) {
	$needle = 'native-parser-' . $i;
	$offset = $i % 100;
	$query = "SELECT p.ID, p.post_title, p.post_name, u.display_name, " .
		"mt1.meta_value AS color, mt2.meta_value AS size " .
		"FROM wp_posts p " .
		"LEFT JOIN wp_postmeta mt1 ON (p.ID = mt1.post_id AND mt1.meta_key = '_color') " .
		"LEFT JOIN wp_postmeta mt2 ON (p.ID = mt2.post_id AND mt2.meta_key = '_size') " .
		"INNER JOIN wp_users u ON (p.post_author = u.ID) " .
		"WHERE p.post_type IN ('post', 'page', 'attachment') " .
		"AND p.post_status NOT IN ('trash', 'auto-draft') " .
		"AND (p.post_title LIKE '%" . $needle . "%' " .
		"OR p.post_content LIKE '%" . $needle . "%' " .
		"OR mt1.meta_value = 'blue') " .
		"GROUP BY p.ID, p.post_title, p.post_name, u.display_name, mt1.meta_value, mt2.meta_value " .
		"ORDER BY p.post_date DESC, p.ID ASC " .
		"LIMIT " . $offset . ", 20";

	if (extension_loaded('wp_mysql_parser')) {
		$total_tokens += (new WP_MySQL_Lexer($query))->native_token_stream()->count();
	} else {
		$tokens = (new WP_MySQL_Lexer($query))->remaining_tokens();
		if (!$tokens) {
			throw new Exception('Lexer returned no tokens at query ' . $i);
		}
		$total_tokens += count($tokens);
	}
	$processed_queries++;
}

echo json_encode(array(
	'extensionLoaded' => extension_loaded('wp_mysql_parser'),
	'nativeLexerUsed' => method_exists('WP_MySQL_Lexer', 'native_token_stream'),
	'processedQueries' => $processed_queries,
	'totalTokens' => $total_tokens,
	'durationMs' => (hrtime(true) - $started_at) / 1000000,
));
`;

async function fetchLocalFile(input: RequestInfo | URL): Promise<Response> {
	const url =
		input instanceof Request ? new URL(input.url) : new URL(String(input));
	if (url.protocol !== 'file:') {
		return fetch(input);
	}

	try {
		return new Response(await readFile(fileURLToPath(url)), {
			status: 200,
		});
	} catch (error) {
		return new Response(String(error), {
			status: 404,
			statusText: 'Not Found',
		});
	}
}
