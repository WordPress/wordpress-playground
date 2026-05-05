import { describe, expect, it } from 'vitest';

import {
	normalizeDashPrefixedOptionValues,
	splitShellWords,
	validateCliMode,
} from './cli';

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

describe('validateCliMode', () => {
	it('accepts extension compile mode', () => {
		expect(validateCliMode({ source: './ext-src' })).toBe(true);
	});

	it('accepts prepare-image mode', () => {
		expect(validateCliMode({ 'prepare-image': true })).toBe(true);
	});

	it('requires one CLI mode', () => {
		expect(() => validateCliMode({})).toThrow(
			'--source is required unless --prepare-image is set.'
		);
	});

	it('rejects conflicting CLI modes', () => {
		expect(() =>
			validateCliMode({
				source: './ext-src',
				'prepare-image': true,
			})
		).toThrow('--source and --prepare-image cannot be used together.');
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
