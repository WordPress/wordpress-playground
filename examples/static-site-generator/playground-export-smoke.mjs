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

wp_update_post(array(
	'ID' => $child_id,
	'post_parent' => $parent_id,
));

$child_url = get_permalink($child_id);
$static_content = '<p id="section">Static smoke page.</p>'
	. '<p><a class="child-link" href="' . esc_url($child_url) . '">Child</a></p>'
	. '<p><a class="self-link" href="/static-page/#section">Self</a></p>'
	. '<p><img class="asset-link" src="' . esc_url($asset_url) . '" alt=""></p>'
	. '<style>.hero{background-image:url("' . esc_url($asset_url) . '")}</style>'
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

if ((int) $result['pages_exported'] < 4) {
	throw new Exception('Expected at least four exported pages.');
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
$scoped_asset_url = trailingslashit(content_url('uploads')) . 'ssgwp-smoke-asset.txt';
$scoped_static_content = '<p id="section">Static smoke page.</p>'
	. '<p><a class="child-link" href="' . esc_url($scoped_child_url) . '">Child</a></p>'
	. '<p><a class="self-link" href="' . esc_url(home_url('/static-page/#section')) . '">Self</a></p>'
	. '<p><img class="asset-link" src="' . esc_url($scoped_asset_url) . '" alt=""></p>'
	. '<style>.hero{background-image:url("' . esc_url($scoped_asset_url) . '")}</style>'
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

if ((int) $scoped_result['pages_exported'] < 4) {
	throw new Exception('Expected at least four scoped exported pages.');
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
	assertFile('parent-page/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
	assertFile('static-export.json');

	const staticPage = readText('static-page/index.html');
	const expectedTargets = [
		'../parent-page/child-page/index.html',
		'../static-page/index.html#section',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertDoesNotInclude(staticPage, 'href="/static-page/"');
	await assertAllLocalResourceTargetsExist();
}

async function verifyScopedExport() {
	currentExportDir = scopedExportDir;

	assertFile('index.html');
	assertFile('static-page/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
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
		'../static-page/index.html#section',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `scoped static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertDoesNotInclude(staticPage, duplicatedScope);
	assertDoesNotInclude(staticPage, 'href="/scope:sad-quiet-school/static-page/"');
	assertDoesNotInclude(staticPage, 'href="scope%3Asad-quiet-school/');
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
	return [...text.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)].map(
		(match) => match[1]
	);
}

function extractSrcsetRefs(text) {
	const refs = [];

	for (const match of text.matchAll(/\ssrcset=["']([^"']+)["']/gi)) {
		for (const candidate of match[1].split(',')) {
			const [url] = candidate.trim().split(/\s+/);

			if (url) {
				refs.push(url);
			}
		}
	}

	return refs;
}

function extractCssUrlRefs(text) {
	return [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(
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
