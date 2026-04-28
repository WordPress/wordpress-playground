import { describe, expect, it } from 'vitest';

import { splitShellWords } from './cli';

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
