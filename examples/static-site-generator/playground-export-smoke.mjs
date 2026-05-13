#!/usr/bin/env node
/**
 * Run a real Playground CLI static export and verify exported URL targets.
 *
 * This smoke intentionally uses the published Playground CLI by default so it
 * can run from sparse checkouts without installing the whole monorepo.
 */
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const pluginDir = path.join(__dirname, 'plugin');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'ssgwp-playground-smoke-'));
const exportHostDir = path.join(tempRoot, 'exports');
const blueprintPath = path.join(tempRoot, 'blueprint.json');
const exportDir = path.join(exportHostDir, 'site');
const scopedExportDir = path.join(exportHostDir, 'scoped-site');
const wpVersion = process.env.SSGWP_SMOKE_WP_VERSION || '6.8';
const phpVersion = process.env.SSGWP_SMOKE_PHP_VERSION || '8.3';
const cliAttempts = Number.parseInt(
	process.env.SSGWP_SMOKE_CLI_ATTEMPTS || '3',
	10
);

let failed = false;
let currentExportDir = exportDir;

try {
	mkdirSync(exportHostDir, { recursive: true });
	writeFileSync(blueprintPath, JSON.stringify(createBlueprint(), null, '\t'));
	runPlaygroundCli();
	await verifyExport();
	await verifyScopedExport();
} catch (error) {
	failed = true;
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	if (failed || process.env.SSGWP_KEEP_SMOKE_OUTPUT) {
		console.error(`Smoke output kept at ${tempRoot}`);
	} else {
		rmSync(tempRoot, { force: true, recursive: true });
	}
}

function createBlueprint() {
	return {
		$schema: 'https://playground.wordpress.net/blueprint-schema.json',
		preferredVersions: {
			wp: wpVersion,
			php: phpVersion,
		},
		steps: [
			{
				step: 'activatePlugin',
				pluginPath: 'static-site-generator/static-site-generator.php',
			},
			{
				step: 'runPHP',
				code: createSmokePhp(),
			},
		],
	};
}

function createSmokePhp() {
	return `<?php
require '/wordpress/wp-load.php';

$posts = get_posts(array(
	'numberposts' => -1,
	'post_type' => array('post', 'page'),
	'post_status' => 'any',
));

foreach ($posts as $post) {
	wp_delete_post($post->ID, true);
}

global $wp_rewrite;
$wp_rewrite->set_permalink_structure('/%postname%/');
$wp_rewrite->flush_rules();
kses_remove_filters();

$upload_dir = wp_upload_dir();
$asset_path = trailingslashit($upload_dir['basedir']) . 'ssgwp-smoke-asset.txt';
$asset_url = trailingslashit($upload_dir['baseurl']) . 'ssgwp-smoke-asset.txt';
file_put_contents($asset_path, 'static export smoke asset');
$captions_path = trailingslashit($upload_dir['basedir']) . 'ssgwp-smoke-captions.vtt';
$captions_url = trailingslashit($upload_dir['baseurl']) . 'ssgwp-smoke-captions.vtt';
file_put_contents($captions_path, "WEBVTT\\n\\n00:00.000 --> 00:01.000\\nCaption");

$manifest_dir = trailingslashit(WP_PLUGIN_DIR) . 'ssgwp-smoke-deps';
wp_mkdir_p($manifest_dir . '/icons');
file_put_contents(
	$manifest_dir . '/manifest.json',
	wp_json_encode(array('icons' => array(
		array('src' => 'icon-192.png'),
		array('src' => 'icons/icon.png'),
	)))
);
file_put_contents($manifest_dir . '/icon-192.png', 'icon-192');
file_put_contents($manifest_dir . '/icons/icon.png', 'icon');
file_put_contents(
	$manifest_dir . '/filter.svg',
	'<svg><filter><feImage href="icons/filter.png"></feImage></filter></svg>'
);
file_put_contents(
	$manifest_dir . '/browserconfig.xml',
	'<browserconfig><msapplication><tile>'
		. '<square70x70logo src="icons/tile-small.png"/>'
		. '</tile></msapplication></browserconfig>'
);
file_put_contents($manifest_dir . '/player.json', wp_json_encode(array(
	'captions' => 'captions.vtt',
)));
file_put_contents($manifest_dir . '/captions.vtt', "WEBVTT\\n\\n00:00.000 --> 00:01.000\\nPlugin");
file_put_contents($manifest_dir . '/icons/filter.png', 'filter');
file_put_contents($manifest_dir . '/icons/tile-small.png', 'tile-small');
$manifest_url = content_url('plugins/ssgwp-smoke-deps/manifest.json');
$filter_svg_url = content_url('plugins/ssgwp-smoke-deps/filter.svg');
$browserconfig_url = content_url('plugins/ssgwp-smoke-deps/browserconfig.xml');
$player_config_url = content_url('plugins/ssgwp-smoke-deps/player.json');

$child_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Child Page',
	'post_name' => 'child-page',
	'post_content' => '<p>Child export target.</p>',
));

$parent_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Parent Page',
	'post_name' => 'parent-page',
	'post_content' => '<p>Parent export target.</p>',
));

$comments_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Comments',
	'post_name' => 'comments',
	'post_content' => '<p>Comments page export target.</p>',
));

$embed_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Embed Only',
	'post_name' => 'embed-only',
	'post_content' => '<p>Embed-only export target.</p>',
));

$deferred_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Deferred Link',
	'post_name' => 'deferred-link',
	'post_content' => '<p>Deferred data-href export target.</p>',
));

wp_update_post(array(
	'ID' => $child_id,
	'post_parent' => $parent_id,
));

$child_url = get_permalink($child_id);
$comments_url = get_permalink($comments_id);
$embed_url = get_permalink($embed_id);
$deferred_url = get_permalink($deferred_id);
$protocol_child_url = preg_replace('/^https?:/', '', $child_url);
$static_content = '<p id="section">Static smoke page.</p>'
	. '<base href="' . esc_url(home_url('/')) . '">'
	. '<p><a class="child-link" href="' . esc_url($child_url) . '">Child</a></p>'
	. '<p><a class="deferred-link" data-href="' . esc_url($deferred_url) . '">Deferred</a></p>'
	. '<p><button data-href="' . esc_url($asset_url . '?deferred=1') . '">Deferred asset</button></p>'
	. '<p><a class="comments-link" href="' . esc_url($comments_url) . '">Comments</a></p>'
	. '<p><a class="self-link" href="/static-page/#section">Self</a></p>'
	. '<meta property="og:url" content="' . esc_url($child_url . '#meta') . '">'
	. '<meta property="og:image" content="' . esc_url($asset_url . '?meta=1') . '">'
	. '<meta property="og:audio" content="' . esc_url($asset_url . '?audio=1') . '">'
	. '<meta property="og:video" content="' . esc_url($asset_url . '?video=1') . '">'
	. '<meta name="msapplication-TileImage" content="' . esc_url($asset_url . '?tile=1') . '">'
	. '<meta name="msapplication-square70x70logo" content="' . esc_url($asset_url . '?tile-small=1') . '">'
	. '<meta name="msapplication-wide310x150logo" content="' . esc_url($asset_url . '?tile-wide=1') . '">'
	. '<meta name="msapplication-config" content="' . esc_url($browserconfig_url) . '">'
	. '<meta itemprop="contentUrl" content="' . esc_url($asset_url . '?schema=1') . '">'
	. '<meta itemprop="embedUrl" content="' . esc_url($child_url) . '">'
	. '<meta property="article:author" content="' . esc_url($child_url) . '">'
	. '<meta property="article:publisher" content="' . esc_url(get_permalink($parent_id)) . '">'
	. '<meta property="og:see_also" content="' . esc_url($child_url) . '">'
	. '<meta name="twitter:player" content="' . esc_url($child_url) . '">'
	. '<meta name="twitter:player:stream" content="' . esc_url($asset_url . '?stream=1') . '">'
	. '<link rel="manifest" href="' . esc_url($manifest_url) . '">'
	. '<link rel="preload" as="fetch" href="' . esc_url($player_config_url) . '">'
	. '<link rel="preload" as="image" href="' . esc_url($asset_url) . '" imagesrcset="' . esc_url($asset_url) . ' 1x, ' . esc_url($asset_url . '?preload=2x') . ' 2x">'
	. '<video><track kind="captions" src="' . esc_url($captions_url . '?track=1') . '"></video>'
	. '<p><img class="asset-link" src="' . esc_url($asset_url) . '" alt=""></p>'
	. '<p><img class="svg-filter" src="' . esc_url($filter_svg_url) . '" alt=""></p>'
	. '<p><img class="mixed-srcset" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, ' . esc_url($asset_url . '?mixed=2x') . ' 2x" alt=""></p>'
	. '<object data="' . esc_url($child_url) . '"></object>'
	. '<object data="' . esc_url($asset_url . '?object=1') . '"></object>'
	. '<iframe src="' . esc_url($embed_url) . '"></iframe>'
	. '<iframe data-src="' . esc_url($child_url) . '" data-lazy-src="' . esc_url($asset_url . '?lazy-frame=1') . '"></iframe>'
	. '<embed src="' . esc_url($embed_url) . '">'
	. '<embed src="' . esc_url($asset_url . '?embed=1') . '">'
	. '<embed data-src="' . esc_url($embed_url) . '" data-lazy-src="' . esc_url($asset_url . '?lazy-embed=1') . '">'
	. '<style>.hero{background-image:url("' . esc_url($asset_url) . '")}</style>'
	. '<style>.responsive{background-image:image-set("' . esc_url($asset_url . '?image-set=1') . '" 1x, type("text/plain"))}</style>'
	. '<iframe srcdoc="' . esc_attr('<a href="' . esc_url($child_url) . '">Srcdoc child</a><img src="' . esc_url($asset_url . '?srcdoc=1') . '" alt="">') . '"></iframe>'
	. '<script type="application/json">{"root":"\/parent-page\/child-page\/","rootAsset":"\/wp-content\/uploads\/ssgwp-smoke-asset.txt?root=1","plainRoot":"/static-page/","plainAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?plain=1"}</script>'
	. '<script type="application/json">{"protocolChild":"' . esc_url($protocol_child_url) . '","protocolEscaped":"' . str_replace('/', '\/', $protocol_child_url) . '"}</script>'
	. '<script type="application/json">{"child":"' . esc_url($child_url) . '"}</script>';

$static_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Static Page',
	'post_name' => 'static-page',
	'post_content' => $static_content,
));

$exporter = new SSGWP_Static_Exporter();
$result = $exporter->export_to_directory('/exports/site', array(
	'url_mode' => 'relative',
	'max_pages' => 50,
	'copy_uploads' => true,
	'copy_theme' => true,
	'copy_plugins' => false,
	'copy_core_assets' => true,
	'crawl_links' => true,
	'fetch_mode' => 'internal',
));

if (!empty($result['warnings'])) {
	error_log(implode("\\n", $result['warnings']));
	throw new Exception('Static export completed with warnings.');
}

if ((int) $result['pages_exported'] < 5) {
	throw new Exception('Expected at least five exported pages.');
}

$scoped_home = 'https://playground.wordpress.net/scope:sad-quiet-school';

add_filter('home_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . ltrim($path, '/');
}, 10, 2);

add_filter('site_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . ltrim($path, '/');
}, 10, 2);

add_filter('content_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . 'wp-content/' . ltrim($path, '/');
}, 10, 2);

add_filter('includes_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . 'wp-includes/' . ltrim($path, '/');
}, 10, 2);

$scoped_child_url = get_permalink($child_id);
$scoped_comments_url = get_permalink($comments_id);
$scoped_embed_url = get_permalink($embed_id);
$scoped_deferred_url = get_permalink($deferred_id);
$scoped_protocol_child_url = preg_replace('/^https?:/', '', $scoped_child_url);
$scoped_asset_url = trailingslashit(content_url('uploads')) . 'ssgwp-smoke-asset.txt';
$scoped_captions_url = trailingslashit(content_url('uploads')) . 'ssgwp-smoke-captions.vtt';
$scoped_manifest_url = content_url('plugins/ssgwp-smoke-deps/manifest.json');
$scoped_filter_svg_url = content_url('plugins/ssgwp-smoke-deps/filter.svg');
$scoped_browserconfig_url = content_url('plugins/ssgwp-smoke-deps/browserconfig.xml');
$scoped_player_config_url = content_url('plugins/ssgwp-smoke-deps/player.json');
$scoped_child_path = wp_parse_url($scoped_child_url, PHP_URL_PATH);
$scoped_asset_path = wp_parse_url($scoped_asset_url, PHP_URL_PATH);
$scoped_static_content = '<p id="section">Static smoke page.</p>'
	. '<base href="' . esc_url(home_url('/')) . '">'
	. '<p><a class="child-link" href="' . esc_url($scoped_child_url) . '">Child</a></p>'
	. '<p><a class="deferred-link" data-href="' . esc_url($scoped_deferred_url) . '">Deferred</a></p>'
	. '<p><button data-href="' . esc_url($scoped_asset_url . '?deferred=1') . '">Deferred asset</button></p>'
	. '<p><a class="comments-link" href="' . esc_url($scoped_comments_url) . '">Comments</a></p>'
	. '<p><a class="self-link" href="' . esc_url(home_url('/static-page/#section')) . '">Self</a></p>'
	. '<meta property="og:url" content="' . esc_url($scoped_child_url . '#meta') . '">'
	. '<meta name="twitter:image" content="' . esc_url($scoped_asset_url . '?meta=1') . '">'
	. '<meta property="og:audio:secure_url" content="' . esc_url($scoped_asset_url . '?audio=1') . '">'
	. '<meta property="og:video:secure_url" content="' . esc_url($scoped_asset_url . '?video=1') . '">'
	. '<meta name="msapplication-TileImage" content="' . esc_url($scoped_asset_url . '?tile=1') . '">'
	. '<meta name="msapplication-square70x70logo" content="' . esc_url($scoped_asset_url . '?tile-small=1') . '">'
	. '<meta name="msapplication-wide310x150logo" content="' . esc_url($scoped_asset_url . '?tile-wide=1') . '">'
	. '<meta name="msapplication-config" content="' . esc_url($scoped_browserconfig_url) . '">'
	. '<meta itemprop="contentUrl" content="' . esc_url($scoped_asset_url . '?schema=1') . '">'
	. '<meta itemprop="embedUrl" content="' . esc_url($scoped_child_url) . '">'
	. '<meta property="article:author" content="' . esc_url($scoped_child_url) . '">'
	. '<meta property="article:publisher" content="' . esc_url(get_permalink($parent_id)) . '">'
	. '<meta property="og:see_also" content="' . esc_url($scoped_child_url) . '">'
	. '<meta name="twitter:player" content="' . esc_url($scoped_child_url) . '">'
	. '<meta name="twitter:player:stream" content="' . esc_url($scoped_asset_url . '?stream=1') . '">'
	. '<link rel="manifest" href="' . esc_url($scoped_manifest_url) . '">'
	. '<link rel="preload" as="fetch" href="' . esc_url($scoped_player_config_url) . '">'
	. '<link rel="preload" as="image" href="' . esc_url($scoped_asset_url) . '" imagesrcset="' . esc_url($scoped_asset_url) . ' 1x, ' . esc_url($scoped_asset_url . '?preload=2x') . ' 2x">'
	. '<p><a class="other-scope-link" href="https://playground.wordpress.net/scope:other-site/static-page/">Other scope</a></p>'
	. '<video><track kind="captions" src="' . esc_url($scoped_captions_url . '?track=1') . '"></video>'
	. '<p><img class="asset-link" src="' . esc_url($scoped_asset_url) . '" alt=""></p>'
	. '<p><img class="svg-filter" src="' . esc_url($scoped_filter_svg_url) . '" alt=""></p>'
	. '<p><img class="mixed-srcset" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, ' . esc_url($scoped_asset_url . '?mixed=2x') . ' 2x" alt=""></p>'
	. '<p><img class="other-scope-asset" src="https://playground.wordpress.net/scope:other-site/wp-content/uploads/asset.txt" alt=""></p>'
	. '<object data="' . esc_url($scoped_child_url) . '"></object>'
	. '<object data="' . esc_url($scoped_asset_url . '?object=1') . '"></object>'
	. '<iframe src="' . esc_url($scoped_embed_url) . '"></iframe>'
	. '<iframe data-src="' . esc_url($scoped_child_url) . '" data-lazy-src="' . esc_url($scoped_asset_url . '?lazy-frame=1') . '"></iframe>'
	. '<embed src="' . esc_url($scoped_embed_url) . '">'
	. '<embed src="' . esc_url($scoped_asset_url . '?embed=1') . '">'
	. '<embed data-src="' . esc_url($scoped_embed_url) . '" data-lazy-src="' . esc_url($scoped_asset_url . '?lazy-embed=1') . '">'
	. '<style>.hero{background-image:url("' . esc_url($scoped_asset_url) . '")}</style>'
	. '<style>.responsive{background-image:image-set("' . esc_url($scoped_asset_url . '?image-set=1') . '" 1x, type("text/plain"))}</style>'
	. '<iframe srcdoc="' . esc_attr('<a href="' . esc_url($scoped_child_url) . '">Srcdoc child</a><img src="' . esc_url($scoped_asset_url . '?srcdoc=1') . '" alt="">') . '"></iframe>'
	. '<script type="application/json">{"root":"' . str_replace('/', '\/', $scoped_child_path) . '","rootAsset":"' . str_replace('/', '\/', $scoped_asset_path) . '?root=1"}</script>'
	. '<script type="application/json">{"protocolChild":"' . esc_url($scoped_protocol_child_url) . '","protocolEscaped":"' . str_replace('/', '\/', $scoped_protocol_child_url) . '"}</script>'
	. '<script type="application/json">{"plainRootAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=1","plainRootAssetEscaped":"\/wp-content\/uploads\/ssgwp-smoke-asset.txt?outside=2"}</script>'
	. '<script type="application/json">{"child":"' . esc_url($scoped_child_url) . '"}</script>';

wp_update_post(array(
	'ID' => $static_id,
	'post_content' => $scoped_static_content,
));

$scoped_result = $exporter->export_to_directory('/exports/scoped-site', array(
	'url_mode' => 'relative',
	'max_pages' => 50,
	'copy_uploads' => true,
	'copy_theme' => true,
	'copy_plugins' => false,
	'copy_core_assets' => true,
	'crawl_links' => true,
	'fetch_mode' => 'internal',
));

if (!empty($scoped_result['warnings'])) {
	error_log(implode("\\n", $scoped_result['warnings']));
	throw new Exception('Scoped static export completed with warnings.');
}

if ((int) $scoped_result['pages_exported'] < 5) {
	throw new Exception('Expected at least five scoped exported pages.');
}
`;
}

function runPlaygroundCli() {
	const cliBin = process.env.PLAYGROUND_CLI_BIN || 'npx';
	const cliPrefix = process.env.PLAYGROUND_CLI_BIN
		? []
		: ['--yes', '@wp-playground/cli@latest'];
	const args = [
		...cliPrefix,
		'run-blueprint',
		`--mount=${pluginDir}:/wordpress/wp-content/plugins/static-site-generator`,
		`--mount=${exportHostDir}:/exports`,
		`--blueprint=${blueprintPath}`,
		`--wp=${wpVersion}`,
		`--php=${phpVersion}`,
		'--verbosity=normal',
	];

	let result;

	for (let attempt = 1; attempt <= cliAttempts; attempt++) {
		result = spawnSync(cliBin, args, {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: 'pipe',
		});

		if (result.status === 0) {
			break;
		}

		if (attempt < cliAttempts && isRetryableCliFailure(result)) {
			console.error(`Playground CLI fetch failed; retrying (${attempt + 1}/${cliAttempts}).`);
			continue;
		}

		break;
	}

	if (!result || result.status !== 0) {
		throw new Error(
			[
				'Playground CLI smoke export failed.',
				`Command: ${cliBin} ${args.join(' ')}`,
				`Exit status: ${result ? result.status : 'unknown'}`,
				`STDOUT:\n${result ? result.stdout : ''}`,
				`STDERR:\n${result ? result.stderr : ''}`,
			].join('\n')
		);
	}

	if (result.stderr.trim()) {
		console.error(result.stderr);
	}
}

function isRetryableCliFailure(result) {
	const output = `${result.stdout}\n${result.stderr}`;

	return /(?:fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN)/i.test(output);
}

async function verifyExport() {
	currentExportDir = exportDir;
	assertFile('index.html');
	assertFile('static-page/index.html');
	assertFile('comments/index.html');
	assertFile('deferred-link/index.html');
	assertFile('embed-only/index.html');
	assertFile('parent-page/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
	assertFile('wp-content/uploads/ssgwp-smoke-captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/manifest.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icon-192.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/icon.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/player.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/filter.svg');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/filter.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/tile-small.png');
	assertFile('static-export.json');

	const staticPage = readText('static-page/index.html');
	const expectedTargets = [
		'../parent-page/child-page/index.html',
		'../parent-page/child-page/index.html#meta',
		'../parent-page/index.html',
		'../comments/index.html',
		'../deferred-link/index.html',
		'../embed-only/index.html',
		'../static-page/index.html#section',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?meta=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?audio=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?video=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-small=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-wide=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?stream=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?root=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?plain=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?mixed=2x',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?image-set=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?object=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
		'../wp-content/uploads/ssgwp-smoke-captions.vtt?track=1',
		'../wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'../wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'../wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../wp-content/plugins/ssgwp-smoke-deps/filter.svg',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertIncludes(
		staticPage,
		'imagesrcset="../wp-content/uploads/ssgwp-smoke-asset.txt 1x, ../wp-content/uploads/ssgwp-smoke-asset.txt?preload=2x 2x"',
		'static-page/index.html rewrites responsive image preload srcset'
	);
	assertIncludes(
		staticPage,
		'<base href="./">',
		'static-page/index.html anchors same-site base hrefs to the static document'
	);
	assertIncludes(
		staticPage,
		'data-href="../deferred-link/index.html"',
		'static-page/index.html rewrites deferred page data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-href="../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1"',
		'static-page/index.html rewrites deferred asset data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites object page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe src="../embed-only/index.html"></iframe>',
		'static-page/index.html rewrites iframe src page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../embed-only/index.html">',
		'static-page/index.html rewrites embed page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1">',
		'static-page/index.html rewrites embed media sources'
	);
	assertIncludes(
		staticPage,
		'<embed data-src="../embed-only/index.html" data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1">',
		'static-page/index.html rewrites lazy embed sources'
	);
	assertIncludes(
		staticPage,
		'data="../wp-content/uploads/ssgwp-smoke-asset.txt?object=1"',
		'static-page/index.html rewrites object media sources'
	);
	assertIncludes(
		staticPage,
		'data-src="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites lazy iframe page sources'
	);
	assertIncludes(
		staticPage,
		'data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1"',
		'static-page/index.html rewrites lazy iframe media sources'
	);
	assertDoesNotInclude(staticPage, 'href="/static-page/"');
	assertDoesNotInclude(staticPage, '"root":"\\/parent-page\\/child-page\\/"');
	assertDoesNotInclude(staticPage, '"plainRoot":"/static-page/"');
	assertDoesNotInclude(staticPage, '"protocolChild":"//');
	assertDoesNotInclude(staticPage, '"protocolEscaped":"\\/\\/');
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icon-192.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icons/icon.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'icons/tile-small.png'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'../../../wp-content/plugins/ssgwp-smoke-deps/captions.vtt',
		'copied JSON player configs rewrite WebVTT caption references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../../../wp-content/plugins/ssgwp-smoke-deps/captions.vtt'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/filter.svg'),
		'../../../wp-content/plugins/ssgwp-smoke-deps/icons/filter.png',
		'copied SVG assets rewrite filter image references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/filter.svg',
		'../../../wp-content/plugins/ssgwp-smoke-deps/icons/filter.png'
	);
	await assertAllLocalResourceTargetsExist();
}

async function verifyScopedExport() {
	currentExportDir = scopedExportDir;

	assertFile('index.html');
	assertFile('static-page/index.html');
	assertFile('comments/index.html');
	assertFile('deferred-link/index.html');
	assertFile('embed-only/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
	assertFile('wp-content/uploads/ssgwp-smoke-captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/manifest.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icon-192.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/icon.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/player.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/filter.svg');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/filter.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/tile-small.png');
	assertFile('static-export.json');

	const files = await listFiles(currentExportDir);
	const duplicatedScope = 'scope%3Asad-quiet-school/scope%3Asad-quiet-school';

	for (const file of files) {
		if (file.includes(duplicatedScope)) {
			throw new Error(`Duplicated Playground scope in exported path: ${file}`);
		}

		if (file.startsWith('scope%3Asad-quiet-school/')) {
			throw new Error(`Playground scope leaked into exported path: ${file}`);
		}
	}

	const staticPage = readText('static-page/index.html');
	const expectedTargets = [
		'../parent-page/child-page/index.html',
		'../parent-page/child-page/index.html#meta',
		'../parent-page/index.html',
		'../comments/index.html',
		'../deferred-link/index.html',
		'../embed-only/index.html',
		'../static-page/index.html#section',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?meta=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?audio=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?video=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-small=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-wide=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?stream=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?root=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?mixed=2x',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?image-set=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?object=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
		'../wp-content/uploads/ssgwp-smoke-captions.vtt?track=1',
		'../wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'../wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'../wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../wp-content/plugins/ssgwp-smoke-deps/filter.svg',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `scoped static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertIncludes(
		staticPage,
		'imagesrcset="../wp-content/uploads/ssgwp-smoke-asset.txt 1x, ../wp-content/uploads/ssgwp-smoke-asset.txt?preload=2x 2x"',
		'scoped static-page/index.html rewrites responsive image preload srcset'
	);
	assertIncludes(
		staticPage,
		'<base href="./">',
		'scoped static-page/index.html anchors same-site base hrefs to the static document'
	);
	assertIncludes(
		staticPage,
		'data-href="../deferred-link/index.html"',
		'scoped static-page/index.html rewrites deferred page data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-href="../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1"',
		'scoped static-page/index.html rewrites deferred asset data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites object page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe src="../embed-only/index.html"></iframe>',
		'scoped static-page/index.html rewrites iframe src page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../embed-only/index.html">',
		'scoped static-page/index.html rewrites embed page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1">',
		'scoped static-page/index.html rewrites embed media sources'
	);
	assertIncludes(
		staticPage,
		'<embed data-src="../embed-only/index.html" data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1">',
		'scoped static-page/index.html rewrites lazy embed sources'
	);
	assertIncludes(
		staticPage,
		'data="../wp-content/uploads/ssgwp-smoke-asset.txt?object=1"',
		'scoped static-page/index.html rewrites object media sources'
	);
	assertIncludes(
		staticPage,
		'data-src="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites lazy iframe page sources'
	);
	assertIncludes(
		staticPage,
		'data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1"',
		'scoped static-page/index.html rewrites lazy iframe media sources'
	);
	assertDoesNotInclude(staticPage, duplicatedScope);
	assertDoesNotInclude(staticPage, 'href="/scope:sad-quiet-school/static-page/"');
	assertDoesNotInclude(staticPage, 'href="scope%3Asad-quiet-school/');
	assertDoesNotInclude(
		staticPage,
		'"root":"\\/scope:sad-quiet-school\\/parent-page\\/child-page\\/"'
	);
	assertDoesNotInclude(staticPage, '"protocolChild":"//');
	assertDoesNotInclude(staticPage, '"protocolEscaped":"\\/\\/');
	assertIncludes(
		staticPage,
		'"plainRootAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=1"',
		'scoped static-page/index.html leaves root-level plain asset JSON outside the scope'
	);
	assertIncludes(
		staticPage,
		'"plainRootAssetEscaped":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=2"',
		'scoped static-page/index.html leaves root-level asset JSON outside the scope'
	);
	assertIncludes(
		staticPage,
		'https://playground.wordpress.net/scope:other-site/static-page/',
		'scoped static-page/index.html leaves another scope page link untouched'
	);
	assertIncludes(
		staticPage,
		'https://playground.wordpress.net/scope:other-site/wp-content/uploads/asset.txt',
		'scoped static-page/index.html leaves another scope asset link untouched'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icon-192.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icons/icon.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'icons/tile-small.png'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'../../../wp-content/plugins/ssgwp-smoke-deps/captions.vtt',
		'scoped copied JSON player configs rewrite WebVTT caption references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../../../wp-content/plugins/ssgwp-smoke-deps/captions.vtt'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/filter.svg'),
		'../../../wp-content/plugins/ssgwp-smoke-deps/icons/filter.png',
		'scoped copied SVG assets rewrite filter image references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/filter.svg',
		'../../../wp-content/plugins/ssgwp-smoke-deps/icons/filter.png'
	);
	await assertAllLocalResourceTargetsExist();
}

function assertFile(relativePath) {
	const target = path.join(currentExportDir, relativePath);

	if (!existsSync(target)) {
		throw new Error(`Missing exported file: ${relativePath}`);
	}
}

function readText(relativePath) {
	return readFileSync(path.join(currentExportDir, relativePath), 'utf8');
}

function assertIncludes(haystack, needle, message) {
	if (!haystack.includes(needle)) {
		throw new Error(`${message}. Missing ${JSON.stringify(needle)}.`);
	}
}

function assertDoesNotInclude(haystack, needle) {
	if (haystack.includes(needle)) {
		throw new Error(`Unexpected exported reference ${JSON.stringify(needle)}.`);
	}
}

function assertStaticTargetExists(fromFile, targetUrl) {
	const target = resolveExportReference(fromFile, targetUrl);

	if (target && !existsSync(target)) {
		throw new Error(
			`Broken static export reference from ${fromFile}: ${targetUrl}`
		);
	}
}

async function listFiles(dir, prefix = '') {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const relative = path.join(prefix, entry.name);
		const absolute = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await listFiles(absolute, relative)));
		} else {
			files.push(relative);
		}
	}

	return files;
}

async function assertAllLocalResourceTargetsExist() {
	const files = await listFiles(currentExportDir);
	const htmlFiles = files.filter((file) => /\.html$/i.test(file));
	const cssQueue = [];
	const inspectedCss = new Set();

	for (const file of htmlFiles) {
		const text = readText(file);
		const refs = [
			...extractAttributeRefs(text),
			...extractSrcsetRefs(text),
			...extractHtmlCssRefs(text),
		];

		for (const ref of refs) {
			const target = resolveExportReference(file, ref);

			if (target && !existsSync(target)) {
				throw new Error(`Broken local reference in ${file}: ${ref}`);
			}

			if (target && /\.css$/i.test(target)) {
				cssQueue.push(path.relative(currentExportDir, target));
			}
		}
	}

	while (cssQueue.length > 0) {
		const file = cssQueue.shift();

		if (!file || inspectedCss.has(file)) {
			continue;
		}

		inspectedCss.add(file);

		const text = readText(file);

		for (const ref of extractCssUrlRefs(text)) {
			const target = resolveExportReference(file, ref);

			if (target && !existsSync(target)) {
				throw new Error(`Broken local reference in ${file}: ${ref}`);
			}

			if (target && /\.css$/i.test(target)) {
				cssQueue.push(path.relative(currentExportDir, target));
			}
		}
	}
}

function extractAttributeRefs(text) {
	return [
		...text.matchAll(
			/\s(?:href|src|data-href|data-src|data-lazy-src|data|poster)=["']([^"']+)["']/gi
		),
	].map((match) => match[1]);
}

function extractSrcsetRefs(text) {
	const refs = [];

	for (const match of text.matchAll(/\ssrcset=["']([^"']+)["']/gi)) {
		for (const candidate of splitSrcsetCandidates(match[1])) {
			const [url] = candidate.trim().split(/\s+/);

			if (url) {
				refs.push(url);
			}
		}
	}

	return refs;
}

function splitSrcsetCandidates(srcset) {
	const candidates = [];
	let candidate = '';
	let urlStarted = false;
	let urlFinished = false;
	let dataUrlPrefix = false;

	for (let index = 0; index < srcset.length; index++) {
		const char = srcset[index];

		if (!urlStarted && !/\s/.test(char)) {
			urlStarted = true;
			dataUrlPrefix = srcset.slice(index, index + 5).toLowerCase() === 'data:';
		}

		if (urlStarted && !urlFinished && /\s/.test(char)) {
			urlFinished = true;
		}

		if (
			char === ',' &&
			(!dataUrlPrefix || urlFinished || /\s/.test(srcset[index + 1] || ''))
		) {
			candidates.push(candidate.trim());
			candidate = '';
			urlStarted = false;
			urlFinished = false;
			dataUrlPrefix = false;
			continue;
		}

		candidate += char;
	}

	if (candidate.trim()) {
		candidates.push(candidate.trim());
	}

	return candidates;
}

function extractCssUrlRefs(text) {
	return [
		...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi),
		...text.matchAll(/image-set\(\s*["']([^"']+)["']/gi),
		...text.matchAll(/-webkit-image-set\(\s*["']([^"']+)["']/gi),
	].map(
		(match) => match[1]
	);
}

function extractHtmlCssRefs(text) {
	const css = [];

	for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		css.push(match[1]);
	}

	for (const match of text.matchAll(/\sstyle=["']([^"']+)["']/gi)) {
		css.push(match[1]);
	}

	return css.flatMap((chunk) => extractCssUrlRefs(chunk));
}

function resolveExportReference(fromFile, ref) {
	if (!ref || ref.startsWith('#') || ref.startsWith('//')) {
		return null;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
		return null;
	}

	const withoutHash = ref.split('#', 1)[0];
	const withoutQuery = withoutHash.split('?', 1)[0];

	if (!withoutQuery || withoutQuery.startsWith('data:')) {
		return null;
	}

	const base = withoutQuery.startsWith('/')
		? currentExportDir
		: path.dirname(path.join(currentExportDir, fromFile));
	const resolved = path.resolve(base, withoutQuery.replace(/^\/+/, ''));

	if (!resolved.startsWith(path.resolve(currentExportDir) + path.sep)) {
		throw new Error(`Reference escapes export root from ${fromFile}: ${ref}`);
	}

	return resolved;
}
