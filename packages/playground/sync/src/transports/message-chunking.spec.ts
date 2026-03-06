import { describe, it, expect } from 'vitest';
import {
	serializeEnvelope,
	deserializeEnvelope,
	chunkMessage,
	MessageAssembler,
} from './message-chunking';
import type { TransportEnvelope } from '../transports';

function makeEnvelope(
	sqlCount = 1,
	binaryData?: Uint8Array
): TransportEnvelope {
	return {
		sql: Array.from({ length: sqlCount }, (_, i) => ({
			type: 'sql' as const,
			subtype: 'replay' as const,
			query: `INSERT INTO wp_posts VALUES (${i})`,
		})),
		fs: binaryData
			? [
					{
						operation: 'UPDATE_FILE' as const,
						path: '/wordpress/wp-content/test.txt',
						data: binaryData,
						nodeType: 'file' as const,
					},
				]
			: [],
	};
}

describe('serializeEnvelope / deserializeEnvelope', () => {
	it('should round-trip an envelope with no binary data', () => {
		const envelope = makeEnvelope(2);
		const serialized = serializeEnvelope(envelope);
		const deserialized = deserializeEnvelope(serialized);
		expect(deserialized).toEqual(envelope);
	});

	it('should round-trip an envelope with binary data', () => {
		const data = new Uint8Array([1, 2, 3, 4, 5]);
		const envelope = makeEnvelope(1, data);
		const serialized = serializeEnvelope(envelope);
		const deserialized = deserializeEnvelope(serialized);
		expect(deserialized.fs).toHaveLength(1);
		const fsOp = deserialized.fs[0] as { data: Uint8Array };
		expect(fsOp.data).toBeInstanceOf(Uint8Array);
		expect(Array.from(fsOp.data)).toEqual([1, 2, 3, 4, 5]);
	});

	it('should round-trip an envelope with large binary data', () => {
		const data = new Uint8Array(100_000);
		for (let i = 0; i < data.length; i++) {
			data[i] = i % 256;
		}
		const envelope = makeEnvelope(1, data);
		const serialized = serializeEnvelope(envelope);
		const deserialized = deserializeEnvelope(serialized);
		const fsOp = deserialized.fs[0] as { data: Uint8Array };
		expect(fsOp.data).toBeInstanceOf(Uint8Array);
		expect(fsOp.data.byteLength).toBe(100_000);
		expect(fsOp.data[0]).toBe(0);
		expect(fsOp.data[255]).toBe(255);
		expect(fsOp.data[256]).toBe(0);
	});

	it('should handle empty envelope', () => {
		const envelope: TransportEnvelope = { sql: [], fs: [] };
		const serialized = serializeEnvelope(envelope);
		const deserialized = deserializeEnvelope(serialized);
		expect(deserialized).toEqual(envelope);
	});
});

describe('chunkMessage', () => {
	it('should produce a single chunk for small messages', () => {
		const data = new Uint8Array([10, 20, 30]);
		const chunks = chunkMessage(1, data);
		expect(chunks).toHaveLength(1);
		// 5 bytes header + 3 bytes payload
		expect(chunks[0].byteLength).toBe(8);
	});

	it('should split large messages into multiple chunks', () => {
		// Use a small maxChunkSize so we get multiple chunks
		const data = new Uint8Array(100);
		const chunks = chunkMessage(42, data, 30);
		// maxPayload = 30 - 5 = 25, so 100/25 = 4 chunks
		expect(chunks).toHaveLength(4);

		// Only the last chunk should have the final flag
		for (let i = 0; i < chunks.length - 1; i++) {
			expect(chunks[i][0] & 0x01).toBe(0);
		}
		expect(chunks[chunks.length - 1][0] & 0x01).toBe(1);
	});

	it('should handle empty data', () => {
		const data = new Uint8Array(0);
		const chunks = chunkMessage(1, data);
		expect(chunks).toHaveLength(1);
		expect(chunks[0][0] & 0x01).toBe(1); // final flag set
	});
});

describe('MessageAssembler', () => {
	it('should assemble a single-chunk message', () => {
		const assembler = new MessageAssembler();
		const data = new Uint8Array([1, 2, 3]);
		const chunks = chunkMessage(1, data);
		const result = assembler.addChunk(chunks[0]);
		expect(result).not.toBeNull();
		expect(Array.from(result!)).toEqual([1, 2, 3]);
	});

	it('should assemble a multi-chunk message', () => {
		const assembler = new MessageAssembler();
		const data = new Uint8Array(100);
		for (let i = 0; i < data.length; i++) {
			data[i] = i % 256;
		}
		const chunks = chunkMessage(7, data, 30);
		expect(chunks.length).toBeGreaterThan(1);

		let result: Uint8Array | null = null;
		for (const chunk of chunks) {
			result = assembler.addChunk(chunk);
		}
		expect(result).not.toBeNull();
		expect(Array.from(result!)).toEqual(Array.from(data));
	});

	it('should handle concurrent message IDs', () => {
		const assembler = new MessageAssembler();
		const dataA = new Uint8Array([10, 20, 30, 40, 50]);
		const dataB = new Uint8Array([60, 70, 80, 90, 100]);

		const chunksA = chunkMessage(1, dataA, 8); // 3 byte payload per chunk
		const chunksB = chunkMessage(2, dataB, 8);

		// Interleave chunks from both messages
		let resultA: Uint8Array | null = null;
		let resultB: Uint8Array | null = null;
		const maxLen = Math.max(chunksA.length, chunksB.length);
		for (let i = 0; i < maxLen; i++) {
			if (i < chunksA.length) {
				const r = assembler.addChunk(chunksA[i]);
				if (r) resultA = r;
			}
			if (i < chunksB.length) {
				const r = assembler.addChunk(chunksB[i]);
				if (r) resultB = r;
			}
		}

		expect(resultA).not.toBeNull();
		expect(resultB).not.toBeNull();
		expect(Array.from(resultA!)).toEqual([10, 20, 30, 40, 50]);
		expect(Array.from(resultB!)).toEqual([60, 70, 80, 90, 100]);
	});

	it('should return null for intermediate chunks', () => {
		const assembler = new MessageAssembler();
		const data = new Uint8Array(100);
		const chunks = chunkMessage(1, data, 30);
		expect(chunks.length).toBeGreaterThan(1);

		for (let i = 0; i < chunks.length - 1; i++) {
			expect(assembler.addChunk(chunks[i])).toBeNull();
		}
		expect(assembler.addChunk(chunks[chunks.length - 1])).not.toBeNull();
	});
});

describe('full round-trip: serialize → chunk → reassemble → deserialize', () => {
	it('should round-trip a large envelope through chunking', () => {
		const bigData = new Uint8Array(200_000);
		for (let i = 0; i < bigData.length; i++) {
			bigData[i] = i % 256;
		}
		const envelope = makeEnvelope(3, bigData);

		const serialized = serializeEnvelope(envelope);
		const chunks = chunkMessage(1, serialized);

		const assembler = new MessageAssembler();
		let assembled: Uint8Array | null = null;
		for (const chunk of chunks) {
			assembled = assembler.addChunk(chunk);
		}
		expect(assembled).not.toBeNull();

		const deserialized = deserializeEnvelope(assembled!);
		expect(deserialized.sql).toEqual(envelope.sql);
		expect(deserialized.fs).toHaveLength(1);
		const fsOp = deserialized.fs[0] as { data: Uint8Array };
		expect(fsOp.data.byteLength).toBe(200_000);
		expect(fsOp.data[0]).toBe(0);
		expect(fsOp.data[255]).toBe(255);
	});
});
