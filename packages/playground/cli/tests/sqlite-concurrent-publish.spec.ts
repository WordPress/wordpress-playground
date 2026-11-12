import { runCLI } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';

const TEST_SUITE_TIMEOUT = 120_000;
const TEST_CASE_TIMEOUT = 120_000;

/**
 * Regression coverage for the SQLite corruption class reported in:
 *
 * - WordPress/wordpress-playground#3914: concurrent Gutenberg-style publish
 *   requests crashed php.wasm or corrupted the SQLite database.
 * - WordPress/wordpress-playground#3883: WAL-mode corruption made SQLite
 *   return "database disk image is malformed".
 * - WordPress/wordpress-playground#3909: Playground switched SQLite's default
 *   journal mode to DELETE.
 * - WordPress/sqlite-database-integration#447: the integration now preserves
 *   Playground's effective journal mode instead of silently restoring WAL.
 *
 * WAL requires shared-memory sidecar support for coordinating readers and
 * writers across connections. Playground's virtualized file systems do not
 * provide the effective shared-memory semantics SQLite expects there, so
 * concurrent CLI workers can observe or write an inconsistent WAL state. That
 * shows up as malformed database files, WordPress database error pages, or
 * php.wasm crashes under write-heavy editor flows.
 *
 * This test intentionally uses several CLI workers. A single worker serializes
 * requests too much to reproduce the WAL failure mode this protects against.
 * The regression was reported on Linux CI and reproduced on non-Windows CLI
 * workers, so keep this stress test out of the Windows CLI matrix.
 */
describe.skipIf(process.platform === 'win32')(
	'Playground CLI SQLite concurrent publish flow',
	() => {
		let cliServer: RunCLIServer | undefined;

		beforeAll(async () => {
			cliServer = await runCLI({
				command: 'server',
				port: 0,
				workers: 6,
				wp: '6.8',
				verbosity: 'debug',
			});
		}, TEST_SUITE_TIMEOUT);

		afterAll(async () => {
			if (cliServer) {
				await cliServer[Symbol.asyncDispose]();
			}
		}, TEST_SUITE_TIMEOUT);

		it(
			'keeps custom-table publish, meta-box, and post-list requests stable',
			async () => {
				if (!cliServer) {
					throw new Error('CLI server failed to start.');
				}
				const server = cliServer;

				await writeStressScripts(server);

				const setup = await fetchCliPath(
					server,
					'/playground-stress-setup.php',
					{ method: 'POST' }
				);
				await expectTextResponse(setup, 'ok');

				for (let i = 0; i < 12; i++) {
					const responses = await Promise.all(
						Array.from({ length: 6 }, (_, j) => {
							if (j % 3 === 0) {
								return fetchCliPath(
									server,
									'/playground-stress-meta-box-loader.php',
									{ method: 'POST' }
								);
							}
							if (j % 3 === 1) {
								return fetchCliPath(
									server,
									'/playground-stress-post-list.php'
								);
							}
							return fetchCliPath(
								server,
								'/playground-stress-publish.php',
								{ method: 'POST' }
							);
						})
					);

					for (const response of responses) {
						const json = await expectJsonOkResponse(response);
						expect(json.ok).toBe(true);
					}
				}

				const integrity = await fetchCliPath(
					server,
					'/playground-stress-integrity.php'
				);
				await expectTextResponse(integrity, 'ok');
			},
			TEST_CASE_TIMEOUT
		);
	}
);

async function writeStressScripts(cliServer: RunCLIServer) {
	await cliServer.playground.writeFile(
		'/wordpress/playground-stress-setup.php',
		getCustomTableSetupScript()
	);
	await cliServer.playground.writeFile(
		'/wordpress/playground-stress-publish.php',
		getCustomTablePublishScript()
	);
	await cliServer.playground.writeFile(
		'/wordpress/playground-stress-meta-box-loader.php',
		getCustomTableMetaBoxLoaderScript()
	);
	await cliServer.playground.writeFile(
		'/wordpress/playground-stress-post-list.php',
		getCustomTablePostListScript()
	);
	await cliServer.playground.writeFile(
		'/wordpress/playground-stress-integrity.php',
		getIntegrityCheckScript()
	);
}

async function fetchCliPath(
	cliServer: RunCLIServer,
	path: string,
	init?: RequestInit
) {
	return await fetch(new URL(path, cliServer.serverUrl), init);
}

async function expectTextResponse(response: Response, expected: string) {
	const text = await expectOkResponse(response);
	expect(text.trim()).toBe(expected);
}

async function expectOkResponse(response: Response) {
	const text = await response.text();
	expect(response.status, text).toBe(200);
	return text;
}

async function expectJsonOkResponse(response: Response) {
	const text = await expectOkResponse(response);
	try {
		return JSON.parse(text) as { ok: boolean };
	} catch (e) {
		throw new Error(`Expected JSON response, got: ${text}`, {
			cause: e,
		});
	}
}

function getCustomTableSetupScript() {
	return `<?php
require __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';

global $wpdb;
ob_start();

for ($i = 0; $i < 11; $i++) {
	$columns = array();
	for ($j = 0; $j < 11; $j++) {
		$columns[] = "c$j varchar(500) NOT NULL DEFAULT '' COMMENT 'stress comment $j'";
	}

	$table = $wpdb->prefix . 'playground_stress_' . $i;
	dbDelta(
		"CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			" . implode(",\n\t\t\t", $columns) . ",
			PRIMARY KEY  (id)
		) " . $wpdb->get_charset_collate() . ";"
	);

	$wpdb->get_var("SELECT COUNT(*) FROM $table");
	if ($wpdb->last_error) {
		ob_clean();
		http_response_code(500);
		echo $wpdb->last_error;
		exit;
	}
}

ob_clean();
echo 'ok';
`;
}

function getCustomTablePublishScript() {
	return `<?php
require __DIR__ . '/wp-load.php';

global $wpdb;

$post_id = wp_insert_post(
	array(
		'post_title' => 'Playground stress ' . microtime(true),
		'post_content' => str_repeat('content ', 500),
		'post_status' => 'publish',
		'post_type' => 'post',
	),
	true
);

if (is_wp_error($post_id)) {
	http_response_code(500);
	echo json_encode(array('ok' => false, 'error' => $post_id->get_error_message()));
	exit;
}

for ($i = 0; $i < 11; $i++) {
	$data = array();
	for ($j = 0; $j < 11; $j++) {
		$data["c$j"] = str_repeat(chr(65 + $i), 500);
	}
	if (false === $wpdb->insert($wpdb->prefix . 'playground_stress_' . $i, $data)) {
		http_response_code(500);
		echo json_encode(array('ok' => false, 'error' => $wpdb->last_error));
		exit;
	}
}

echo json_encode(array('ok' => true, 'post_id' => $post_id));
`;
}

function getCustomTableMetaBoxLoaderScript() {
	return `<?php
require __DIR__ . '/wp-load.php';

global $wpdb;

$total = 0;
for ($i = 0; $i < 11; $i++) {
	$table = $wpdb->prefix . 'playground_stress_' . $i;
	$total += (int) $wpdb->get_var("SELECT COUNT(*) FROM $table");
	if ($wpdb->last_error) {
		http_response_code(500);
		echo json_encode(array('ok' => false, 'error' => $wpdb->last_error));
		exit;
	}
}

$join = '';
for ($i = 1; $i < 11; $i++) {
	$table = $wpdb->prefix . 'playground_stress_' . $i;
	$join .= " LEFT JOIN $table s$i ON s$i.id = s0.id";
}
$first_table = $wpdb->prefix . 'playground_stress_0';
$wpdb->get_results("SELECT * FROM $first_table s0 $join ORDER BY s0.id DESC LIMIT 50");

if ($wpdb->last_error) {
	http_response_code(500);
	echo json_encode(array('ok' => false, 'error' => $wpdb->last_error));
	exit;
}

echo json_encode(array('ok' => true, 'total' => $total));
`;
}

function getCustomTablePostListScript() {
	return `<?php
require __DIR__ . '/wp-load.php';

$query = new WP_Query(
	array(
		'post_type' => 'post',
		'post_status' => 'publish',
		'posts_per_page' => 20,
	)
);

echo json_encode(array('ok' => true, 'found_posts' => $query->found_posts));
`;
}

function getIntegrityCheckScript() {
	return `<?php
require __DIR__ . '/wp-load.php';

echo $GLOBALS['@pdo']->query('PRAGMA integrity_check')->fetchColumn();
`;
}
