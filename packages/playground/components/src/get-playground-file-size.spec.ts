import { describe, expect, it, vi } from 'vitest';
import { getPlaygroundFileSize } from './get-playground-file-size';

describe('getPlaygroundFileSize', () => {
	it('asks PHP for the file size without reading the file into JavaScript', async () => {
		const playground = {
			run: vi.fn(async () => ({ text: '12345' })),
		};

		await expect(
			getPlaygroundFileSize(playground, '/wordpress/wp-content/big.zip')
		).resolves.toBe(12345);

		expect(playground.run).toHaveBeenCalledWith({
			code: expect.stringContaining('filesize($path)'),
			env: {
				PLAYGROUND_FILE_SIZE_PATH: '/wordpress/wp-content/big.zip',
			},
		});
	});

	it('throws when PHP does not print a numeric file size', async () => {
		const playground = {
			run: vi.fn(async () => ({ text: '' })),
		};

		await expect(
			getPlaygroundFileSize(playground, '/wordpress/missing.zip')
		).rejects.toThrow(
			'Could not read the file size: PHP did not return a numeric size.'
		);
	});

	it('throws when PHP prints a size JavaScript cannot represent safely', async () => {
		const playground = {
			run: vi.fn(async () => ({
				text: String(Number.MAX_SAFE_INTEGER + 1),
			})),
		};

		await expect(
			getPlaygroundFileSize(playground, '/wordpress/huge.zip')
		).rejects.toThrow(
			'Could not read the file size: size exceeds Number.MAX_SAFE_INTEGER.'
		);
	});
});
