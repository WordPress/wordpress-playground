import { describe, expect, it, vi } from 'vitest';
import { readFileForInlinePreview } from './file-utils';

describe('readFileForInlinePreview', () => {
	it('returns small files for inline preview', async () => {
		const file = {
			arrayBuffer: vi.fn(
				async () => new TextEncoder().encode('hello').buffer
			),
		};

		const result = await readFileForInlinePreview(file, 10);

		expect(result.type).toBe('inline');
		expect(result.type === 'inline' ? decode(result.data) : '').toBe(
			'hello'
		);
	});

	it('uses a known streamed filesize instead of buffering large files', async () => {
		const file = {
			filesize: 11,
			arrayBuffer: vi.fn(async () => {
				throw new Error('should not buffer');
			}),
		};

		const result = await readFileForInlinePreview(file, 10);

		expect(result).toEqual({ type: 'too-large' });
		expect(file.arrayBuffer).not.toHaveBeenCalled();
	});

	it('stops reading a stream once it exceeds the inline preview limit', async () => {
		const file = {
			arrayBuffer: vi.fn(async () => {
				throw new Error('should not buffer');
			}),
			stream: () =>
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode('hello'));
					},
				}),
		};

		const result = await readFileForInlinePreview(file, 4);

		expect(result).toEqual({ type: 'too-large' });
		expect(file.arrayBuffer).not.toHaveBeenCalled();
	});
});

/**
 * Converts bytes back to text for inline preview assertions.
 */
function decode(data: Uint8Array) {
	return new TextDecoder().decode(data);
}
