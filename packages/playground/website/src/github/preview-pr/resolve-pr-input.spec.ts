import {
	isWordPressPrBeforePreviewer,
	resolvePrInput,
} from './resolve-pr-input';

describe('resolvePrInput', () => {
	it('resolves bare numbers against the preferred repository', () => {
		expect(resolvePrInput('123', 'wordpress')).toEqual({
			ok: true,
			value: { target: 'wordpress', ref: '123', isBranch: false },
		});
		expect(resolvePrInput('123', 'gutenberg')).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: '123', isBranch: false },
		});
	});

	it('resolves official WordPress Core and Gutenberg pull request URLs', () => {
		expect(
			resolvePrInput(
				'https://github.com/WordPress/wordpress-develop/pull/456',
				'gutenberg'
			)
		).toEqual({
			ok: true,
			value: { target: 'wordpress', ref: '456', isBranch: false },
		});
		expect(
			resolvePrInput(
				'github.com/WordPress/gutenberg/pull/789',
				'wordpress'
			)
		).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: '789', isBranch: false },
		});
	});

	it('rejects zero as a pull request number', () => {
		expect(resolvePrInput('0', 'wordpress')).toEqual({
			ok: false,
			error: 'Enter a valid pull request number.',
		});
		expect(resolvePrInput('0', 'gutenberg')).toEqual({
			ok: false,
			error: 'Enter a valid pull request number.',
		});
		expect(
			resolvePrInput(
				'https://github.com/WordPress/gutenberg/pull/0',
				'gutenberg'
			)
		).toEqual({
			ok: false,
			error: expect.stringContaining('Paste a WordPress Core'),
		});
	});

	it('accepts GitHub URL owner, repository, and route casing', () => {
		expect(
			resolvePrInput(
				'https://github.com/wordpress/Gutenberg/PULL/789',
				'wordpress'
			)
		).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: '789', isBranch: false },
		});
	});

	it('accepts www.github.com URLs', () => {
		expect(
			resolvePrInput(
				'https://www.github.com/WordPress/gutenberg/pull/789',
				'wordpress'
			)
		).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: '789', isBranch: false },
		});
	});

	it('resolves official Gutenberg branch URLs without including query parameters', () => {
		expect(
			resolvePrInput(
				'https://github.com/WordPress/gutenberg/tree/feature/foo?plain=1',
				'wordpress'
			)
		).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: 'feature/foo', isBranch: true },
		});
	});

	it('rejects WordPress Core branch URLs', () => {
		expect(
			resolvePrInput(
				'https://github.com/WordPress/wordpress-develop/tree/trunk',
				'wordpress'
			)
		).toEqual({
			ok: false,
			error: expect.stringContaining("Branch names aren't supported"),
		});
	});

	it('does not treat unsupported GitHub URLs as bare Gutenberg branch names', () => {
		expect(
			resolvePrInput(
				'https://github.com/someone/gutenberg/pull/123',
				'gutenberg'
			)
		).toEqual({
			ok: false,
			error: expect.stringContaining('Only WordPress'),
		});
	});

	it('rejects malformed GitHub URLs instead of throwing', () => {
		expect(() =>
			resolvePrInput(
				'https://github.com/WordPress/gutenberg/tree/%E0%A4%A',
				'gutenberg'
			)
		).not.toThrow();
		expect(
			resolvePrInput(
				'https://github.com/WordPress/gutenberg/tree/%E0%A4%A',
				'gutenberg'
			)
		).toEqual({
			ok: false,
			error: expect.stringContaining('Paste a WordPress Core'),
		});
	});

	it('still accepts bare Gutenberg branch names', () => {
		expect(resolvePrInput('feature/foo', 'gutenberg')).toEqual({
			ok: true,
			value: { target: 'gutenberg', ref: 'feature/foo', isBranch: true },
		});
	});
});

describe('isWordPressPrBeforePreviewer', () => {
	it('only applies the old-PR cutoff to WordPress Core PRs', () => {
		expect(
			isWordPressPrBeforePreviewer({
				target: 'wordpress',
				ref: '5748',
				isBranch: false,
			})
		).toBe(true);
		expect(
			isWordPressPrBeforePreviewer({
				target: 'wordpress',
				ref: '5749',
				isBranch: false,
			})
		).toBe(false);
		expect(
			isWordPressPrBeforePreviewer({
				target: 'gutenberg',
				ref: '100',
				isBranch: false,
			})
		).toBe(false);
		expect(
			isWordPressPrBeforePreviewer({
				target: 'wordpress',
				ref: 'trunk',
				isBranch: true,
			})
		).toBe(false);
	});
});
