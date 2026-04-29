import { describe, expect, it } from 'vitest';

import {
	detectExtensionNameFromConfig,
	detectRustCrateNameFromCargo,
} from './detect';

describe('detectExtensionNameFromConfig', () => {
	it('detects PHP_ARG_ENABLE names', () => {
		expect(
			detectExtensionNameFromConfig(
				'PHP_ARG_ENABLE([wp_mysql_parser], [whether to enable it])'
			)
		).toBe('wp_mysql_parser');
	});

	it('detects PHP_ARG_WITH names', () => {
		expect(
			detectExtensionNameFromConfig(
				'PHP_ARG_WITH(example_ext, for example support)'
			)
		).toBe('example_ext');
	});

	it('falls back to PHP_NEW_EXTENSION names', () => {
		expect(
			detectExtensionNameFromConfig(
				'PHP_NEW_EXTENSION([hello], hello.c, $ext_shared)'
			)
		).toBe('hello');
	});
});

describe('detectRustCrateNameFromCargo', () => {
	it('reads [package].name', () => {
		expect(
			detectRustCrateNameFromCargo(
				`[package]\nname = "wp_mysql_parser"\nversion = "0.1.0"\n`
			)
		).toBe('wp_mysql_parser');
	});

	it('prefers [lib].name when set', () => {
		expect(
			detectRustCrateNameFromCargo(
				`[package]\nname = "wp-mysql-parser"\n[lib]\nname = "wp_mysql_parser"\n`
			)
		).toBe('wp_mysql_parser');
	});

	it('returns null when no package name is present', () => {
		expect(detectRustCrateNameFromCargo(`[dependencies]\nfoo = "1"\n`)).toBeNull();
	});
});
