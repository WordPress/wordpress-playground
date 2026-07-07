import { describe, expect, it, vi } from 'vitest';
import { readFileForInlinePreview } from './file-utils';

describe('readFileForInlinePreview', () => {
	it('reads files within the inline preview limit', async () => {
		const file = {
			size: 5,
			arrayBuffer: vi.fn(
				async () => new TextEncoder().encode('hello').buffer
			),
		};

		const result = await readFileForInlinePreview(file, 10);

		expect(result).toEqual({
			type: 'inline',
			data: new TextEncoder().encode('hello'),
		});
		expect(file.arrayBuffer).toHaveBeenCalledOnce();
	});

	it('rejects oversized files before buffering them', async () => {
		const file = {
			size: 11,
			arrayBuffer: vi.fn(async () => new Uint8Array(11).buffer),
		};

		const result = await readFileForInlinePreview(file, 10);

		expect(result).toEqual({ type: 'too-large', downloadUrl: undefined });
		expect(file.arrayBuffer).not.toHaveBeenCalled();
	});

	it('falls back to measured bytes when the known size is invalid', async () => {
		const file = {
			filesize: Number.NaN,
			arrayBuffer: vi.fn(async () => new Uint8Array(11).buffer),
		};

		const result = await readFileForInlinePreview(file, 10);

		expect(result).toEqual({ type: 'too-large', downloadUrl: undefined });
		expect(file.arrayBuffer).toHaveBeenCalledOnce();
	});
});
