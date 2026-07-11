import { describeError } from '../lib/error-reporting';

describe('describeError', () => {
	it('falls back to Error cause when message is empty', () => {
		const error = new Error('', {
			cause: new Error(
				'Error when executing the blueprint step #1: PHP.run() failed with exit code 255.'
			),
		});

		const description = describeError(error);
		expect(description).toContain(
			'Error when executing the blueprint step #1'
		);
		expect(description.startsWith('Error —')).toBe(false);
	});

	it('terminates circular cause chains', () => {
		const error = new Error('');
		error.cause = error;

		expect(describeError(error)).toContain('[Circular error cause]');
	});

	it('preserves empty-message formatting through nested causes', () => {
		const error = new Error('', {
			cause: new Error('', {
				cause: new Error('Inner failure'),
			}),
		});

		const description = describeError(error);
		expect(description).toContain('Inner failure');
		expect(description).not.toContain('Error — caused by:');
	});

	it('describes local fields before cause', () => {
		const description = describeError({
			name: 'ErrnoError',
			errno: 20,
			code: 'ENOTDIR',
			cause: new Error('Inner failure'),
		});

		expect(description).toBe(
			'ErrnoError — errno: 20 — code: ENOTDIR — caused by: Inner failure'
		);
	});
});
