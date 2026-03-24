import test from '@playwright/test';
// Importing SupportedPHPVersions from '@php-wasm/universal' causes
// tests to crash in Node due to a 'mime-type.json' import error
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../universal/src/lib/supported-php-versions';

// To test PHP.wasm in the browser with Playwright, the required
// functions and classes must first be injected into window using
// page.addScriptTag. Tests can then be executed via page.evaluate,
// which must wrap the entire process.
SupportedPHPVersions.forEach((phpVersion) => {
	test.describe(`Intl - PHP ${phpVersion}`, () => {
		test.beforeEach(async ({ page }) => {
			page.on('console', (log) => console.log(log.text()));

			await page.goto('/');

			await page.addScriptTag({
				type: 'module',
				url: '/src/test/playwright/globals.ts',
			});
		});

		test('does not load dynamically by default', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any)
				);

				const response = await php.runStream({
					code: `<?php
						var_dump(extension_loaded('intl'));
						var_dump(class_exists('Collator'));`,
				});

				php.exit();

				return await response.stdoutText;
			}, phpVersion);

			test.expect(result).toEqual('bool(false)\nbool(false)\n');
		});

		test('supports dynamic loading', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				const response = await php.runStream({
					code: `<?php
						var_dump(extension_loaded('intl'));
						var_dump(class_exists('Collator'));`,
				});

				php.exit();

				return await response.stdoutText;
			}, phpVersion);

			test.expect(result).toEqual('bool(true)\nbool(true)\n');
		});

		test('has its own ini file and entries', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				const text = php.readFileAsText(
					'/internal/shared/extensions/intl.ini'
				);

				php.exit();

				return text;
			}, phpVersion);

			const expected = [
				'extension=/internal/shared/extensions/intl.so',
			].join('\n');

			test.expect(result).toEqual(expected);
		});

		test('loads the icu data file', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				const list = php.listFiles('/internal/shared');

				php.exit();

				return list;
			}, phpVersion);

			/*
			 * The Intl extension is hard-coded to look for the `icudt74l` filename,
			 * which means the ICU data file must use that exact name.
			 */
			test.expect(result).toContain('icudt74l.dat');
		});

		test('reads the icu data in PROXYFS', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const oldPhp = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);
				const newPhp = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				await window.proxyFileSystem(oldPhp, newPhp, ['/internal/shared']);

				const response = await newPhp.runStream({
					code: `<?php
							$data = array(
								'F' => 'Foo',
								'Br' => 'Bar',
								'Bz' => 'Bz',
							);

							$collator = new Collator('en_US');
							$collator->asort($data, Collator::SORT_STRING);
							var_dump($data);
						?>`,
				});

				newPhp.exit();
				oldPhp.exit();

				return await response.stdoutText;
			}, phpVersion);

			test.expect(result).toEqual(
				'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
			);
		});

		test('uses intl functions', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				const response = await php.runStream({
					code: `<?php
							$formatter = numfmt_create('en-US', NumberFormatter::CURRENCY);
							echo numfmt_format($formatter, 100.00);
							$formatter = numfmt_create('fr-FR', NumberFormatter::CURRENCY);
							echo numfmt_format($formatter, 100.00);
						?>`,
				});

				php.exit();

				return await response.stdoutText;
			}, phpVersion);

			test.expect(result).toEqual('$100.00100,00\xA0€');
		});

		test('uses intl classes', async ({ page }) => {
			const result = await page.evaluate(async (phpVersion) => {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any, {
						withIntl: true,
					})
				);

				const response = await php.runStream({
					code: `<?php
							$data = array(
								'F' => 'Foo',
								'Br' => 'Bar',
								'Bz' => 'Bz',
							);

							$collator = new Collator('en_US');
							$collator->asort($data, Collator::SORT_STRING);
							var_dump($data);
						?>`,
				});

				php.exit();

				return await response.stdoutText;
			}, phpVersion);

			test.expect(result).toEqual(
				'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
			);
		});
	});
});
