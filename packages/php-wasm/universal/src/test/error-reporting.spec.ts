import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHPResponse } from '../lib/php-response';
import {
	describeError,
	prettyPrintFullStackTrace,
	printResponseDebugDetails,
} from '../lib/error-reporting';

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

describe('error reporting', () => {
	let stderr = '';
	let writeSpy: { mockRestore(): void } | undefined;

	afterEach(() => {
		writeSpy?.mockRestore();
		stderr = '';
	});

	it('redacts sensitive URLs from debug stack traces', async () => {
		writeSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation((chunk: string | Uint8Array) => {
				stderr += chunk.toString();
				return true;
			});
		const error = new Error(
			'Failed https://user:pass@example.com/file.zip?token=secret'
		);

		await prettyPrintFullStackTrace(error);

		expect(stderr).toContain('REDACTED');
		expect(stderr).not.toContain('user:pass');
		expect(stderr).not.toContain('token=secret');
	});

	it('redacts sensitive URLs from response debug details', () => {
		writeSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation((chunk: string | Uint8Array) => {
				stderr += chunk.toString();
				return true;
			});
		const response = new PHPResponse(
			200,
			{
				'X-Source': [
					'https://user:pass@example.com/header?token=secret',
				],
			},
			new TextEncoder().encode(
				'https://user:pass@example.com/stdout?token=secret'
			),
			'https://user:pass@example.com/stderr?token=secret'
		);

		printResponseDebugDetails(response);

		expect(stderr).toContain('REDACTED');
		expect(stderr).not.toContain('user:pass');
		expect(stderr).not.toContain('token=secret');
	});
});
