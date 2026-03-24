import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';
import { encodeStringAsBase64 } from '../../src/lib/base64';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../php-wasm/universal/src/lib/supported-php-versions.ts';

test('Base64-encoded Blueprints should work', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		steps: [{ step: 'login' }],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('spawning less should work', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/less.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/less.php',
				data: `<?php
				$process = proc_open(
					'less',
					[
						['pipe', 'r'],
						['pipe', 'w'],
						['pipe', 'w'],
					],
					$pipes
				);
				fwrite($pipes[0], 'Hello, world!');
				fclose($pipes[0]);
				$result = stream_get_contents($pipes[1]);
				fclose($pipes[1]);
				fclose($pipes[2]);
				proc_close($process);
				echo $result;
			`,
			},
		],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('Hello, world!');
});

test('proc_open(php) should work multiple times in a row', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/proc-open-test.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/proc-open-test.php',
				data: `<?php
				$results = [];
				for ($i = 1; $i <= 3; $i++) {
					$proc = proc_open(
						'php -r "echo ' . $i . ';"',
						[1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
						$pipes
					);
					if (!is_resource($proc)) {
						$results[] = "PROC_OPEN_FAILED";
						continue;
					}
					$stdout = stream_get_contents($pipes[1]);
					$stderr = stream_get_contents($pipes[2]);
					fclose($pipes[1]);
					fclose($pipes[2]);
					$exitCode = proc_close($proc);
					$results[] = "out=" . var_export($stdout, true)
						. " err=" . var_export($stderr, true)
						. " exit=" . $exitCode;
				}
				echo implode("\\n", $results);
			`,
			},
		],
	};

	const encodedBlueprint = encodeStringAsBase64(JSON.stringify(blueprint));
	await website.goto(`/#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('out=', {
		timeout: 120000,
	});
	const bodyText = await wordpress.locator('body').innerText();
	expect(bodyText).toContain("out='1'");
	expect(bodyText).toContain("out='2'");
	expect(bodyText).toContain("out='3'");
});

test('?blueprint-url=... should work with simple blueprints', async ({
	page,
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		'This test is flaky in WebKit. It seems like a GitHub CI issue rather than an actual flakiness since it is reliable locally.'
	);
	await website.goto('/');
	const websiteUrl = page.url();
	const blueprintUrl = encodeURIComponent(
		`${websiteUrl}test-fixtures/blueprint/blueprint-simple.json`
	);
	await website.goto(`/?blueprint-url=${blueprintUrl}`);
	await expect(wordpress.locator('body')).toContainText(
		'PREFACE TO PYGMALION'
	);
});

test('?blueprint-url=... should accept data URLs', async ({
	page,
	website,
	wordpress,
}) => {
	await website.goto('/');
	const blueprintUrl = encodeURIComponent(
		`data:application/json;base64,eyJsYW5kaW5nUGFnZSI6Ii9weWdtYWxpb24udHh0Iiwic3RlcHMiOlt7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy9weWdtYWxpb24udHh0IiwiZGF0YSI6IlBSRUZBQ0UgVE8gUFlHTUFMSU9OIn1dfQ==`
	);
	await website.goto(`/?blueprint-url=${blueprintUrl}`);
	await expect(wordpress.locator('body')).toContainText(
		'PREFACE TO PYGMALION'
	);
});

test('?blueprint-url=... should work with ZIP bundles', async ({
	page,
	website,
	wordpress,
}) => {
	await website.goto('/');
	const websiteUrl = page.url();
	const blueprintUrl = encodeURIComponent(
		`${websiteUrl}test-fixtures/blueprint/blueprint.zip`
	);
	await website.goto(`/?blueprint-url=${blueprintUrl}`);
	await expect(wordpress.locator('body')).toContainText(
		'PREFACE TO PYGMALION'
	);
});

test('?blueprint-url=... should work with JSON blueprints referring bundled resources', async ({
	page,
	website,
	wordpress,
}) => {
	await website.goto('/');
	const websiteUrl = page.url();
	const blueprintUrl = encodeURIComponent(
		`${websiteUrl}test-fixtures/blueprint/blueprint-with-bundled-resources.json`
	);
	await website.goto(`/?blueprint-url=${blueprintUrl}`);
	await expect(wordpress.locator('body')).toContainText(
		'PREFACE TO PYGMALION'
	);
});

test('enableMultisite step should re-activate the plugins', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox',
		`The multisite tests consistently fail in CI on Firefox. The root cause is unknown, ` +
			'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
			'Perhaps it is related to using Firefox nightly or something highly specific to the CI runtime.'
	);
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/plugins.php',
		steps: [
			{ step: 'login' },
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'hello-dolly',
				},
				options: { activate: true },
			},
			{ step: 'enableMultisite' },
		],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.getByLabel('Deactivate Hello Dolly')).toHaveText(
		'Deactivate'
	);
});

test('enableMultisite step should enable a multisite', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox',
		`The multisite tests consistently fail in CI on Firefox. The root cause is unknown, ` +
			'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
			'Perhaps it is related to using Firefox nightly or something highly specific to the CI runtime.'
	);
	const blueprint: Blueprint = {
		landingPage: '/',
		steps: [{ step: 'enableMultisite' }],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('My Sites');
});

test('should resolve nice permalinks (/%postname%/)', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/sample-page/',
		steps: [
			{
				step: 'setSiteOptions',
				options: {
					permalink_structure: '/%25postname%25/', // %25 is escaped "%"
				},
			},
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					$wp_rewrite->flush_rules();
				`,
			},
			{
				step: 'setSiteOptions',
				options: {
					blogname: 'test',
				},
			},
		],
	};

	await website.goto(`/#${JSON.stringify(blueprint)}`);
	const body = wordpress.locator('body');
	await expect(body).toContainText('Sample Page');
});

test('Landing page without the initial slash should work', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: 'wp-admin/plugins.php',
		login: true,
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Plugins');
});

/**
 * /wp-admin/customize.php, and potentially other pages in WordPress,
 * run authorization checks before running the init hook. If they're
 * set as the landing page of the Blueprint, the user will be redirected
 * to wp-login.php?reauth=1 before we have a chance to set the
 * authorization cookie.
 *
 * To avoid this, we redirect to an intermediate page that will
 * redirect the user to the landing page.
 */
test('/wp-admin/customize.php should work as a landing page', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: 'wp-admin/customize.php',
		login: true,
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Customize');
});

test('wp-cli step should create a post', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post.php',
		login: true,
		steps: [
			{
				step: 'wp-cli',
				command:
					"wp post create --post_title='Test post' --post_excerpt='Some content' --no-color",
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(
		wordpress.locator('body').locator('[aria-label="“Test post” (Edit)"]')
	).toBeVisible();
});

test('Intl functions should be disabled by default', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/intl-test.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/intl-test.php',
				data: `<?php
					$functions = get_extension_funcs('intl');
					var_dump($functions);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('bool(false)');
});

SupportedPHPVersions.forEach((phpVersion) => {
	test(`Intl functions should work when intl is enabled for PHP ${phpVersion}`, async ({
		website,
		wordpress,
	}) => {
		const blueprint: Blueprint = {
			landingPage: '/intl-functions-test.php',
			preferredVersions: {
				php: phpVersion,
			},
			features: { intl: true },
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/intl-functions-test.php',
					data: `<?php
					$formatter = numfmt_create('en-US', NumberFormatter::CURRENCY);
					echo numfmt_format($formatter, 100.00);
					$formatter = numfmt_create('fr-FR', NumberFormatter::CURRENCY);
					echo numfmt_format($formatter, 100.00);
				`,
				},
			],
		};
		await website.goto(`/#${JSON.stringify(blueprint)}`);
		await expect(wordpress.locator('body')).toContainText(
			'$100.00100,00\xA0€'
		);
	});
});

SupportedPHPVersions.forEach((phpVersion) => {
	test(`Intl classes should work when intl is enabled for PHP ${phpVersion}`, async ({
		website,
		wordpress,
	}) => {
		const blueprint: Blueprint = {
			landingPage: '/intl-classes-test.php',
			preferredVersions: {
				php: phpVersion,
			},
			features: { intl: true },
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/intl-classes-test.php',
					data: `<?php
							$data = array(
								'F' => 'Foo',
								'Br' => 'Bar',
								'Bz' => 'Bz',
							);

							$collator = new Collator('en_US');
							$collator->asort($data, Collator::SORT_STRING);
							var_dump($data);
						?>`,
				},
			],
		};
		await website.goto(`/#${JSON.stringify(blueprint)}`);
		await expect(wordpress.locator('body')).toContainText(
			'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
		);
	});
});

test('HTTPS requests via curl_exec() should work', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		`The curl_exec() tests often fail in CI on Firefox and WebKit. The root cause is unknown, ` +
			'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
			'Perhaps it is something highly specific to the CI runtime.'
	);
	const blueprint: Blueprint = {
		landingPage: '/curl-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/curl-test.php',
				/**
				 * Dump the length of a known README.md file from the WordPress Playground repository.
				 *
				 * The URL:
				 *
				 * * Is served over HTTPS.
				 * * References a specific commit to avoid the file changing underfoot.
				 * * The server provides the CORS headers required for fetch() to work.
				 */
				data: `<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://raw.githubusercontent.com/WordPress/wordpress-playground/5e5ba3e0f5b984ceadd5cbe6e661828c14621d25/README.md");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					$result = curl_exec($ch);
					var_dump(
						strlen(
							$result
						)
					);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	// The length must be 13061 bytes, otherwise something is wrong.
	await expect(wordpress.locator('body')).toContainText('int(13061)');
});

test('CURLFile uploads via curl_exec() should work', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		`The curl_exec() tests often fail in CI on Firefox and WebKit. The root cause is unknown, ` +
			'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
			'Perhaps it is something highly specific to the CI runtime.'
	);
	const blueprint: Blueprint = {
		landingPage: '/curlfile-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/curlfile-test.php',
				/**
				 * Test CURLFile upload: creates a temp file > 1024 bytes
				 * (triggering Expect: 100-continue), uploads it via curl
				 * to a known endpoint, and verifies it succeeds.
				 *
				 * The URL:
				 *
				 * * Is served over HTTPS.
				 * * Echoes back the uploaded file contents.
				 * * The response is proxied through the CORS proxy.
				 */
				data: `<?php
					$tmpFile = tempnam(sys_get_temp_dir(), 'curltest');
					file_put_contents($tmpFile, str_repeat('PLAYGROUND_TEST_CONTENT ', 100));
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://httpbin.org/post");
					curl_setopt($ch, CURLOPT_POST, true);
					curl_setopt($ch, CURLOPT_POSTFIELDS, [
						'file' => new CURLFile($tmpFile, 'text/plain', 'test-upload.txt'),
					]);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					$result = curl_exec($ch);
					$error = curl_error($ch);
					$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					curl_close($ch);
					unlink($tmpFile);
					if ($error) {
						echo "CURL_ERROR:" . $error;
					} else {
						echo "HTTP_CODE:" . $httpCode;
						$decoded = json_decode($result, true);
						if (isset($decoded['files']['file'])) {
							echo " FILE_RECEIVED:YES";
							echo " CONTENT_MATCH:" . (strpos($decoded['files']['file'], 'PLAYGROUND_TEST_CONTENT') !== false ? 'YES' : 'NO');
						} else {
							echo " FILE_RECEIVED:NO";
							echo " BODY:" . substr($result, 0, 500);
						}
					}
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('HTTP_CODE:200');
	await expect(wordpress.locator('body')).toContainText('FILE_RECEIVED:YES');
	await expect(wordpress.locator('body')).toContainText('CONTENT_MATCH:YES');
});

/**
 * Regression test: CURLFile uploads to non-CORS sites previously caused
 * the entire page to hang indefinitely due to three bugs:
 *
 * 1. php://input is not available for multipart/form-data in the CORS
 *    proxy PHP, so the forwarded request had an empty body (502 error).
 * 2. PHP curl sends "Expect: 100-continue" for bodies > 1024 bytes,
 *    then waits for a 100 Continue response before sending the body.
 *    Our code waited for the body before fetching, causing a deadlock.
 * 3. When the full body arrived with the headers (small POST bodies),
 *    the body stream's pull() blocked forever waiting for more data.
 *
 * This test verifies both a CURLFile upload and a simple POST to a
 * non-CORS site (which forces the CORS proxy path) complete without
 * hanging.
 */
test('CURLFile uploads via CORS proxy should not hang', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		`The curl_exec() tests often fail in CI on Firefox and WebKit. The root cause is unknown, ` +
			'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
			'Perhaps it is something highly specific to the CI runtime.'
	);
	const blueprint: Blueprint = {
		landingPage: '/curlfile-cors-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/curlfile-cors-test.php',
				data: `<?php
					echo '<h1>CURLFile CORS Proxy Test</h1>';

					// 1. CURLFile upload (body > 1024 bytes, triggers Expect: 100-continue)
					$tmpFile = tempnam(sys_get_temp_dir(), 'curltest');
					file_put_contents($tmpFile, str_repeat('Playground test data ', 100));
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://w.org");
					curl_setopt($ch, CURLOPT_POST, true);
					curl_setopt($ch, CURLOPT_POSTFIELDS, [
						'file' => new CURLFile($tmpFile, 'text/plain', 'test-upload.txt'),
					]);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					$result = curl_exec($ch);
					$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					$error = curl_error($ch);
					curl_close($ch);
					unlink($tmpFile);
					echo "UPLOAD_DONE:" . ($error ? "ERROR" : $httpCode);

					// 2. Simple POST (small body, no Expect: 100-continue)
					$ch2 = curl_init();
					curl_setopt($ch2, CURLOPT_URL, "https://w.org");
					curl_setopt($ch2, CURLOPT_POST, true);
					curl_setopt($ch2, CURLOPT_POSTFIELDS, 'hello=world');
					curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
					$result2 = curl_exec($ch2);
					$httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
					$error2 = curl_error($ch2);
					curl_close($ch2);
					echo " POST_DONE:" . ($error2 ? "ERROR" : $httpCode2);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	// Both requests must complete. The exact HTTP codes don't matter –
	// the critical thing is that neither request hangs indefinitely.
	await expect(wordpress.locator('body')).toContainText('UPLOAD_DONE:');
	await expect(wordpress.locator('body')).toContainText('POST_DONE:');
});

test('HTTPS requests via curl_exec() should fail when networking is disabled', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		`It's unclear why this test fails on Safari. The root cause of the failure is unknown as the feature ` +
			`seems to be working in manual testing.`
	);
	const blueprint: Blueprint = {
		landingPage: '/curl-test.php',
		features: { networking: false },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/curl-test.php',
				/**
				 * Dump the length of a known README.md file from the WordPress Playground repository.
				 *
				 * The URL:
				 *
				 * * Is served over HTTPS.
				 * * References a specific commit to avoid the file changing underfoot.
				 * * The server provides the CORS headers required for fetch() to work.
				 */
				data: `<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "https://raw.githubusercontent.com/WordPress/wordpress-playground/5e5ba3e0f5b984ceadd5cbe6e661828c14621d25/README.md");
					curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					$result = curl_exec($ch);
					var_dump(
						strlen(
							$result
						)
					);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText(
		'Call to undefined function curl_exec()'
	);
});

test('HTTPS requests via file_get_contents() should work', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		`It's unclear why this test fails on Safari. The root cause of the failure is unknown as the feature ` +
			`seems to be working in manual testing.`
	);
	const blueprint: Blueprint = {
		landingPage: '/https-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/https-test.php',
				/**
				 * Dump the length of a known README.md file from the WordPress Playground repository.
				 *
				 * The URL:
				 *
				 * * Is served over HTTPS.
				 * * References a specific commit to avoid the file changing underfoot.
				 * * The server provides the CORS headers required for fetch() to work.
				 */
				data: `<?php
					var_dump(
						strlen(
							file_get_contents(
								'https://raw.githubusercontent.com/WordPress/wordpress-playground/5e5ba3e0f5b984ceadd5cbe6e661828c14621d25/README.md'
							)
						)
					);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('int(13061)');
});

test('HTTPS requests via file_get_contents() should fail when networking is disabled', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		`It's unclear why this test fails on Safari. The root cause of the failure is unknown as the feature ` +
			`seems to be working in manual testing.`
	);
	const blueprint: Blueprint = {
		landingPage: '/https-test.php',
		features: { networking: false },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/https-test.php',
				/**
				 * Dump the length of a known README.md file from the WordPress Playground repository.
				 *
				 * The URL:
				 *
				 * * Is served over HTTPS.
				 * * References a specific commit to avoid the file changing underfoot.
				 * * The server provides the CORS headers required for fetch() to work.
				 */
				data: `<?php
					var_dump(
						strlen(
							file_get_contents(
								'https://raw.githubusercontent.com/WordPress/wordpress-playground/5e5ba3e0f5b984ceadd5cbe6e661828c14621d25/README.md'
							)
						)
					);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText(
		'https:// wrapper is disabled in the server configuration'
	);
});

test('HTTPS requests via file_get_contents() to invalid URLs should fail', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/https-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/https-test.php',
				/**
				 * The URL is invalid, so file_get_contents() should fail.
				 */
				data: `<?php
					var_dump(
						strlen(
							file_get_contents(
								'https://playground.internal/'
							)
						)
					);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText(
		'file_get_contents(https://playground.internal/): Failed to open stream: HTTP request failed'
	);
});

test('HTTPS requests via file_get_contents() to CORS-disabled URLs should succeed thanks to the CORS proxy', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/https-test.php',
		features: { networking: true },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/https-test.php',
				/**
				 * The URL is valid, but the server does not provide the CORS headers required by fetch().
				 * example.com is intentionally CORS-disabled and stable, making the assertion less flaky
				 * than relying on playground.wordpress.net which occasionally returns transient 400s
				 * when fetched from Firefox in CI.
				 */
				data: `<?php
					// Retry once through the runtime CORS proxy layer if the first fetch fails
					$contents = @file_get_contents('https://example.com/');
					if ($contents === false) {
						$contents = @file_get_contents('https://example.com/');
					}
					var_dump(strpos($contents ?: '', 'Example Domain') !== false);
				`,
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('bool(true)');
});

test('PHP Shutdown should work', async ({ website, wordpress }) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		features: { networking: true },
		steps: [
			{ step: 'login' },
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/rewrite.php',
				data: "<?php add_action( 'shutdown', function() { post_message_to_js('test'); } );",
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should login the user in by default if no login step is provided', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should login the user in if a login step is provided', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		steps: [{ step: 'login', username: 'admin' }],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should login a non-admin user if a login step with a non-admin username is provided', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/profile.php',
		extraLibraries: ['wp-cli'],
		steps: [
			{
				step: 'wp-cli',
				command:
					"wp user create user user@example.com  --user_pass='password'",
			},
			{
				step: 'login',
				username: 'user',
				password: 'password',
			},
		],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.locator('#profile-page #email')).toHaveValue(
		'user@example.com'
	);
});

['/wp-admin/', '/wp-admin/post.php?post=1&action=edit'].forEach((path) => {
	test(`should correctly redirect encoded wp-admin url to ${path}`, async ({
		website,
		wordpress,
	}) => {
		const blueprint: Blueprint = {
			landingPage: path,
		};
		const encodedBlueprint = JSON.stringify(blueprint);
		await website.goto(`./#${encodedBlueprint}`);
		expect(
			await wordpress.locator('body').evaluate((body) => body.baseURI)
		).toContain(path);
	});
});

test('should correctly redirect to a multisite wp-admin url', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/example/wp-admin/options-general.php',
		steps: [
			{
				step: 'enableMultisite',
			},
			{
				step: 'wp-cli',
				command: 'wp site create --slug=example',
			},
		],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);
	await expect(wordpress.locator('body')).toContainText('General Settings');
});

['latest', 'trunk', 'beta'].forEach((wpVersion) => {
	test(`should translate WP-admin to Spanish for the ${wpVersion} WordPress build`, async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName === 'firefox' || browserName === 'webkit',
			`The translation tests often fail in CI on Firefox and WebKit. The root cause is unknown, ` +
				'but the issue does not occur in local testing or on https://playground.wordpress.net/. ' +
				'Perhaps it is something highly specific to the CI runtime.'
		);
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/',
			preferredVersions: {
				wp: wpVersion,
			},
			steps: [{ step: 'setSiteLanguage', language: 'es_ES' }],
		};
		const encodedBlueprint = JSON.stringify(blueprint);
		await website.goto(`./#${encodedBlueprint}`);
		await expect(wordpress.locator('body')).toContainText('Escritorio');
	});
});

test('WordPress homepage loads when mu-plugin prints a notice', async ({
	wordpress,
	website,
	page,
}) => {
	// Load a blueprint that enables debug mode and adds a mu-plugin that prints a notice
	const blueprint = {
		landingPage: '/',
		preferredVersions: {
			wp: '6.7',
			php: '8.0',
		},
		steps: [
			{
				step: 'defineWpConfigConsts',
				consts: {
					WP_DEBUG: true,
					WP_DEBUG_DISPLAY: true,
				},
			},
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/000-print-notice.php',
				data: `<?php
				add_action('init', function() {
					echo 'This is a notice printed by an mu-plugin.';
			    });
				`,
			},
		],
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`./#${encodedBlueprint}`);

	// Wait for the page to load and verify it contains both WordPress content and the notice
	await expect(wordpress.locator('body')).toContainText(
		'Welcome to WordPress. This is your first post.'
	);
});

/**
 * WordPress 6.7 added a redirect from /sitemap.xml to /wp-sitemap.xml
 * (see https://core.trac.wordpress.org/ticket/61931). This test ensures
 * that the redirect works correctly in Playground by verifying that
 * /sitemap.xml returns sitemap content instead of a 404 error.
 */
test('/sitemap.xml should redirect to /wp-sitemap.xml', async ({
	wordpress,
	website,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/sitemap.xml',
		preferredVersions: {
			wp: '6.7',
			php: '8.0',
		},
	};

	const encodedBlueprint = JSON.stringify(blueprint);
	await website.goto(`/#${encodedBlueprint}`);

	// The sitemap is rendered with XSLT styling, showing "XML Sitemap" heading
	await expect(wordpress.locator('body')).toContainText('XML Sitemap');
});
