import { describe, expect, it } from 'vitest';

import { normalizeDashPrefixedOptionValues, splitShellWords } from './cli';

describe('normalizeDashPrefixedOptionValues', () => {
	it('keeps configure and compiler flags as option values', () => {
		expect(
			normalizeDashPrefixedOptionValues([
				'--config-args',
				'--disable-feature --with-libxml=/opt/libxml2',
				'--extra-cflags',
				'-Dsetsockopt=wasm_setsockopt',
				'--extra-ldflags',
				'-sERROR_ON_UNDEFINED_SYMBOLS=0',
			])
		).toEqual([
			'--config-args=--disable-feature --with-libxml=/opt/libxml2',
			'--extra-cflags=-Dsetsockopt=wasm_setsockopt',
			'--extra-ldflags=-sERROR_ON_UNDEFINED_SYMBOLS=0',
		]);
	});
});

describe('splitShellWords', () => {
	it('splits plain configure arguments', () => {
		expect(splitShellWords('--with-libxml=/root/lib --enable-foo')).toEqual(
			['--with-libxml=/root/lib', '--enable-foo']
		);
	});

	it('keeps quoted values together', () => {
		expect(splitShellWords('--with-name="hello world"')).toEqual([
			'--with-name=hello world',
		]);
	});

	it('throws on unterminated quotes', () => {
		expect(() => splitShellWords('"oops')).toThrow('Unterminated quote');
	});
});
