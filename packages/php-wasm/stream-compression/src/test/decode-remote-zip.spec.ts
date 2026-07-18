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
				'first.txt',
				'second.txt',
			]);
			expect(files.map((file) => decoder.decode(file.bytes))).toEqual([
				'first contents',
				'second contents',
			]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

async function createLargeZip(): Promise<Uint8Array> {
	let state = 0x12345678;
	const noise = new Uint8Array(1_200_000);
	for (let i = 0; i < noise.length; i++) {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		noise[i] = state;
	}

	return await collectBytes(
		encodeZip([
			new File(['first contents'], 'first.txt'),
			...Array.from(
				{ length: 2_500 },
				(_, index) => new File([], `ignored-${index}.bin`)
			),
			new File(['second contents'], 'second.txt'),
			new File([noise], 'noise.bin'),
		])
	);
}

function createRangeFetch(zipBytes: Uint8Array): typeof fetch {
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

		const match = /^bytes=(\d+)-(\d+)$/.exec(range);
		if (!match) {
			throw new Error(`Unexpected Range header: ${range}`);
		}
		const from = Number(match[1]);
		const to = Number(match[2]);
		return new Response(zipBytes.slice(from, to + 1), { status: 206 });
	};
}
