import { describe, expect, it } from 'vitest';

import { detectExtensionNameFromConfig } from './detect';

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
