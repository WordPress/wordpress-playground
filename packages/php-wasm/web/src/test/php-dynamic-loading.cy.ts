/// <reference types="cypress" />

import { loadWebRuntime } from '..';
import { PHP, SupportedPHPVersions } from '@php-wasm/universal';

SupportedPHPVersions.forEach((phpVersion) => {
	describe(`Intl - PHP ${phpVersion}`, () => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(
				await loadWebRuntime(phpVersion as any, { withIntl: true })
			);
		});

		afterEach(async () => {
			php.exit();
		});

		it('does not load dynamically by default', async () => {
			php = new PHP(await loadWebRuntime(phpVersion as any));

			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`,
			});

			expect(await result.stdoutText).to.equal(
				'bool(false)\nbool(false)\n'
			);
		});

		it('supports dynamic loading', async () => {
			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`,
			});

			expect(await result.stdoutText).to.equal(
				'bool(true)\nbool(true)\n'
			);
		});

		it('has its own ini file and entries', async () => {
			const entries = php.readFileAsText(
				'/internal/shared/extensions/intl.ini'
			);

			const expected = [
				'extension=/internal/shared/extensions/intl.so',
			].join('\n');

			expect(entries).to.equal(expected);
		});

		it('loads the icu data file', async () => {
			expect(php.listFiles('/internal/shared')).to.contain(
				'icudt74l.dat'
			);
		});

		it('uses intl functions', async () => {
			const response = await php.runStream({
				code: `<?php
						$formatter = numfmt_create('en-US', NumberFormatter::CURRENCY);
						echo numfmt_format($formatter, 100.00);
						$formatter = numfmt_create('fr-FR', NumberFormatter::CURRENCY);
						echo numfmt_format($formatter, 100.00);
					?>`,
			});
			expect(await response.stdoutText).to.equal('$100.00100,00\xA0€');
		});

		it('uses intl classes', async () => {
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
			expect(await response.stdoutText).to.equal(
				'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
			);
		});
	});
});
