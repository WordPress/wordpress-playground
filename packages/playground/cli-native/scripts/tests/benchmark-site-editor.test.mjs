import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aggregateSamples,
	formatTsv,
	meaningfulPaintTime,
	parseArgs,
	parseCookieHeader,
	percentile,
	scopedValue,
	siteEditorUrl,
} from '../benchmark-site-editor.mjs';

test('parseArgs accepts labelled targets and global or scoped authentication', () => {
	const options = parseArgs(
		[
			'--target',
			'wasmtime=http://127.0.0.1:9400',
			'--target=php-fpm=http://127.0.0.1:8081/wordpress/',
			'--storage-state',
			'./auth.json',
			'--auth-cookie',
			'php-fpm::wordpress_logged_in=abc==; session=two',
			'--bootstrap',
			'wasmtime::./bootstrap.mjs',
			'--warmups=3',
			'--samples',
			'9',
			'--timeout-ms=12000',
			'--fully-loaded-timeout-ms',
			'18000',
			'--quiet-window-ms=900',
			'--ignore-request-pattern=/custom-long-poll',
			'--meaningful-selector=.edit-site',
			'--executable-path=./bin/chromium',
			'--json-out=out/result.json',
			'--tsv-out',
			'out/result.tsv',
		],
		{
			PLAYWRIGHT_EXECUTABLE_PATH: '/environment/chromium',
		}
	);

	assert.deepEqual(options.targets, [
		{ label: 'wasmtime', baseUrl: 'http://127.0.0.1:9400' },
		{ label: 'php-fpm', baseUrl: 'http://127.0.0.1:8081/wordpress' },
	]);
	assert.equal(options.warmups, 3);
	assert.equal(options.samples, 9);
	assert.equal(options.timeoutMs, 12_000);
	assert.equal(options.fullyLoadedTimeoutMs, 18_000);
	assert.equal(options.quietWindowMs, 900);
	assert.deepEqual(options.ignoredRequestPatterns, [
		'/wp-admin/admin-ajax.php',
		'wp_site_preview=1',
		'/wp-json/wp/v2/navigation',
		'/wp-json/wp/v2/settings',
		'/custom-long-poll',
	]);
	assert.deepEqual(options.meaningfulSelectors, ['.edit-site']);
	assert.equal(options.executablePath, './bin/chromium');
	assert.equal(scopedValue(options.storageStates, 'wasmtime'), './auth.json');
	assert.equal(scopedValue(options.storageStates, 'php-fpm'), './auth.json');
	assert.equal(
		scopedValue(options.authCookies, 'php-fpm'),
		'wordpress_logged_in=abc==; session=two'
	);
	assert.equal(scopedValue(options.authCookies, 'wasmtime'), undefined);
	assert.equal(
		scopedValue(options.bootstraps, 'wasmtime'),
		'./bootstrap.mjs'
	);
	assert.equal(options.jsonOut, 'out/result.json');
	assert.equal(options.tsvOut, 'out/result.tsv');
});

test('parseArgs uses the browser executable environment fallback', () => {
	const options = parseArgs(
		[
			'--target=one=http://127.0.0.1:9400',
			'--target=two=http://127.0.0.1:8081',
			'--allow-unauthenticated',
		],
		{ PLAYWRIGHT_EXECUTABLE_PATH: '/environment/chromium' }
	);
	assert.equal(options.executablePath, '/environment/chromium');
});

test('parseArgs rejects incomplete or ambiguous benchmark configurations', () => {
	assert.throws(
		() =>
			parseArgs([
				'--target',
				'only=http://127.0.0.1:9400',
				'--allow-unauthenticated',
			]),
		/at least two --target/
	);
	assert.throws(
		() =>
			parseArgs([
				'--target',
				'duplicate=http://127.0.0.1:9400',
				'--target',
				'duplicate=http://127.0.0.1:8081',
				'--allow-unauthenticated',
			]),
		/duplicate target label/
	);
	assert.throws(
		() =>
			parseArgs([
				'--target',
				'one=http://127.0.0.1:9400',
				'--target',
				'two=http://127.0.0.1:8081',
				'--storage-state',
				'other::auth.json',
			]),
		/unknown target label/
	);
	assert.throws(
		() =>
			parseArgs([
				'--target',
				'one=http://127.0.0.1:9400',
				'--target',
				'two=http://127.0.0.1:8081',
			]),
		/target one has no authentication/
	);
});

test('percentile and aggregation are deterministic', () => {
	assert.equal(percentile([40, 10, 30, 20], 0.5), 25);
	assert.equal(percentile([40, 10, 30, 20], 0.95), 38.5);
	assert.equal(percentile([], 0.5), null);

	const samples = [10, 20, 30, 40].map((value) => ({
		navigationTtfbMs: value,
		firstContentfulPaintMs: value + 100,
		firstMeaningfulPaintMs: value + 200,
		fullyLoadedMs: value + 300,
	}));
	assert.deepEqual(aggregateSamples(samples), {
		navigationTtfbMs: { observations: 4, median: 25, p95: 38.5 },
		firstContentfulPaintMs: { observations: 4, median: 125, p95: 138.5 },
		firstMeaningfulPaintMs: { observations: 4, median: 225, p95: 238.5 },
		fullyLoadedMs: { observations: 4, median: 325, p95: 338.5 },
	});

	samples[0].fullyLoadedMs = null;
	assert.deepEqual(aggregateSamples(samples).fullyLoadedMs, {
		observations: 3,
		median: 330,
		p95: 339,
	});
});

test('meaningful paint cannot precede first contentful paint', () => {
	assert.equal(meaningfulPaintTime(1_200, 900), 1_200);
	assert.equal(meaningfulPaintTime(800, 1_100), 1_100);
});

test('cookie, Site Editor URL, and TSV helpers preserve machine-readable values', () => {
	assert.deepEqual(parseCookieHeader('token=a=b; session=two'), [
		{ name: 'token', value: 'a=b' },
		{ name: 'session', value: 'two' },
	]);
	assert.equal(
		siteEditorUrl(
			'http://example.test/wordpress',
			'/wp-admin/site-editor.php'
		),
		'http://example.test/wordpress/wp-admin/site-editor.php'
	);

	const output = formatTsv({
		results: [
			{
				label: 'wasmtime',
				baseUrl: 'http://127.0.0.1:9400',
				successfulSamples: 4,
				failedSamples: 1,
				fullyLoadedStatuses: {
					ok: 3,
					quietWindowTimeout: 1,
					error: 0,
				},
				metrics: aggregateSamples([
					{
						navigationTtfbMs: 10,
						firstContentfulPaintMs: 20,
						firstMeaningfulPaintMs: 30,
						fullyLoadedMs: 40,
					},
				]),
			},
		],
	});
	const lines = output.trimEnd().split('\n');
	assert.equal(lines.length, 5);
	assert.equal(
		lines[0],
		'label\tbase_url\tsuccessful_samples\tfailed_samples\tfully_loaded_ok\tfully_loaded_quiet_timeouts\tfully_loaded_errors\tmetric\tobservations\tmedian_ms\tp95_ms'
	);
	assert.equal(
		lines[1],
		'wasmtime\thttp://127.0.0.1:9400\t4\t1\t3\t1\t0\tttfb\t1\t10\t10'
	);
});
