import { collectBytes } from '../utils/collect-bytes';
import { decodeRemoteZip } from '../zip/decode-remote-zip';
import { encodeZip } from '../zip/encode-zip';

describe('decodeRemoteZip', () => {
	it('emits selected files from range responses', async () => {
		const zipBytes = await createLargeZip();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = createRangeFetch(zipBytes);

		try {
			const decoder = new TextDecoder();
			const stream = await decodeRemoteZip(
				'https://example.com/archive.zip',
				(entry) => decoder.decode(entry.path).endsWith('.txt')
			);
			const files = [];
			for await (const file of stream) {
				files.push(file);
			}

			expect(files).toHaveLength(2);
			expect(files.map((file) => decoder.decode(file.path))).toEqual([
				'selected-0.txt',
				'selected-1.txt',
			]);
			expect(files.map((file) => decoder.decode(file.bytes))).toEqual([
				'contents 0',
				'contents 1',
			]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	}, 30_000);

	it('bounds range requests for widely distributed selected files', async () => {
		const zipBytes = await createLargeZip(100);
		const originalFetch = globalThis.fetch;
		let rangeRequests = 0;
		globalThis.fetch = createRangeFetch(zipBytes, () => rangeRequests++);

		try {
			const decoder = new TextDecoder();
			const stream = await decodeRemoteZip(
				'https://example.com/archive.zip',
				(entry) => decoder.decode(entry.path).endsWith('.txt')
			);
			const files = [];
			for await (const file of stream) {
				files.push(file);
			}

			expect(files).toHaveLength(100);
			expect(rangeRequests).toBeLessThanOrEqual(49);
		} finally {
			globalThis.fetch = originalFetch;
		}
	}, 30_000);

	it('propagates range failures through the returned stream', async () => {
		const zipBytes = await createLargeZip();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = createRangeFetch(zipBytes, () => {
			throw new Error('Range request failed');
		});

		try {
			const stream = await decodeRemoteZip(
				'https://example.com/archive.zip',
				() => true
			);
			await expect(readAll(stream)).rejects.toThrow(
				'Range request failed'
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	}, 30_000);
});

async function createLargeZip(selectedFiles = 2): Promise<Uint8Array> {
	let state = 0x12345678;
	const files = [];
	const noiseLength = selectedFiles === 2 ? 600_000 : 40_000;
	for (let index = 0; index < selectedFiles; index++) {
		files.push(new File([`contents ${index}`], `selected-${index}.txt`));
		const noise = new Uint8Array(noiseLength);
		for (let byteIndex = 0; byteIndex < noise.length; byteIndex++) {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			noise[byteIndex] = state;
		}
		files.push(new File([noise], `ignored-${index}.bin`));
	}

	return await collectBytes(
		encodeZip([
			...files,
			...Array.from(
				{ length: 2_500 },
				(_, index) => new File([], `ignored-${index}.bin`)
			),
		])
	);
}

async function readAll(stream: ReadableStream<unknown>) {
	for await (const file of stream) {
		// Consume the stream so asynchronous range errors surface to the reader.
		void file;
	}
}

function createRangeFetch(
	zipBytes: Uint8Array,
	onRangeRequest?: () => void
): typeof fetch {
	return async (_input, init) => {
		if (init?.method === 'HEAD') {
			return new Response(null, {
				headers: { 'Content-Length': String(zipBytes.byteLength) },
			});
		}

		const range = new Headers(init?.headers).get('Range');
		if (!range) {
			return new Response(zipBytes);
		}
		if (range !== 'bytes=0-0') {
			onRangeRequest?.();
		}

		const match = /^bytes=(\d+)-(\d*)$/.exec(range);
		if (!match) {
			throw new Error(`Unexpected Range header: ${range}`);
		}
		const from = Number(match[1]);
		const to = match[2]
			? Math.min(Number(match[2]), zipBytes.byteLength - 1)
			: zipBytes.byteLength - 1;
		const bytes = zipBytes.slice(from, to + 1);
		return new Response(bytes, {
			status: 206,
			headers: {
				'Content-Length': String(bytes.byteLength),
				'Content-Range': `bytes ${from}-${to}/${zipBytes.byteLength}`,
			},
		});
	};
}
