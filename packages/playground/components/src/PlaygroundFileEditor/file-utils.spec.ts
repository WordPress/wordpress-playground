import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileForInlinePreview } from './file-utils';

describe('readFileForInlinePreview', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

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

		expect(result).toEqual({ type: 'too-large', downloadUrl: undefined });
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

		expect(result).toEqual({ type: 'too-large', downloadUrl: undefined });
		expect(file.arrayBuffer).not.toHaveBeenCalled();
	});

	it('creates a download URL for native blobs without buffering', async () => {
		vi.useFakeTimers();
		const file = new Blob(['hello']);
		const arrayBuffer = vi.spyOn(file, 'arrayBuffer');
		const createObjectURL = vi
			.spyOn(URL, 'createObjectURL')
			.mockReturnValue('blob:test');
		const revokeObjectURL = vi
			.spyOn(URL, 'revokeObjectURL')
			.mockImplementation(() => undefined);

		const result = await readFileForInlinePreview(file, 4);

		expect(result).toEqual({ type: 'too-large', downloadUrl: 'blob:test' });
		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(createObjectURL).toHaveBeenCalledWith(file);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
	});
});

function decode(data: Uint8Array) {
	return new TextDecoder().decode(data);
}
