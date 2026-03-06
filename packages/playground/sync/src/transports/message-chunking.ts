import type { TransportEnvelope } from '../transports';

/**
 * Binary serialization format for TransportEnvelope:
 *
 * [4 bytes: JSON length][JSON bytes][for each binary segment:
 *   [4 bytes: segment length][segment bytes]]
 *
 * Uint8Array fields in the envelope are replaced with
 * {"__binary__": <index>} placeholders in the JSON portion.
 * The actual binary data is appended as length-prefixed segments.
 */

type JsonReplacer = (key: string, value: unknown) => unknown;

export function serializeEnvelope(envelope: TransportEnvelope): Uint8Array {
	const binaries: Uint8Array[] = [];

	const replacer: JsonReplacer = (_key, value) => {
		if (value instanceof Uint8Array) {
			const index = binaries.length;
			binaries.push(value);
			return { __binary__: index };
		}
		return value;
	};

	const json = JSON.stringify(envelope, replacer);
	const jsonBytes = new TextEncoder().encode(json);

	// Calculate total size:
	// 4 (json length) + jsonBytes + for each binary: 4 (length) + data
	let totalSize = 4 + jsonBytes.byteLength;
	for (const bin of binaries) {
		totalSize += 4 + bin.byteLength;
	}

	const result = new Uint8Array(totalSize);
	const view = new DataView(result.buffer);
	let offset = 0;

	// Write JSON length + data
	view.setUint32(offset, jsonBytes.byteLength);
	offset += 4;
	result.set(jsonBytes, offset);
	offset += jsonBytes.byteLength;

	// Write each binary segment
	for (const bin of binaries) {
		view.setUint32(offset, bin.byteLength);
		offset += 4;
		result.set(bin, offset);
		offset += bin.byteLength;
	}

	return result;
}

interface BinaryPlaceholder {
	__binary__: number;
}

function isBinaryPlaceholder(value: unknown): value is BinaryPlaceholder {
	return (
		typeof value === 'object' &&
		value !== null &&
		'__binary__' in value &&
		typeof (value as BinaryPlaceholder).__binary__ === 'number'
	);
}

function restoreBinaries(obj: unknown, binaries: Uint8Array[]): unknown {
	if (isBinaryPlaceholder(obj)) {
		return binaries[obj.__binary__];
	}
	if (Array.isArray(obj)) {
		return obj.map((item) => restoreBinaries(item, binaries));
	}
	if (typeof obj === 'object' && obj !== null) {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = restoreBinaries(value, binaries);
		}
		return result;
	}
	return obj;
}

export function deserializeEnvelope(data: Uint8Array): TransportEnvelope {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let offset = 0;

	// Read JSON
	const jsonLength = view.getUint32(offset);
	offset += 4;
	const jsonBytes = data.subarray(offset, offset + jsonLength);
	offset += jsonLength;
	const json = new TextDecoder().decode(jsonBytes);
	const parsed = JSON.parse(json);

	// Read binary segments
	const binaries: Uint8Array[] = [];
	while (offset < data.byteLength) {
		const segmentLength = view.getUint32(offset);
		offset += 4;
		binaries.push(data.slice(offset, offset + segmentLength));
		offset += segmentLength;
	}

	return restoreBinaries(parsed, binaries) as TransportEnvelope;
}

/**
 * Chunk header format:
 * [1 byte: flags][4 bytes: messageId][payload]
 *
 * Flags byte:
 *   bit 0: 1 = final chunk, 0 = more chunks follow
 */
const CHUNK_HEADER_SIZE = 5;
const FLAG_FINAL = 0x01;

export function chunkMessage(
	messageId: number,
	data: Uint8Array,
	maxChunkSize = 48_000
): Uint8Array[] {
	const maxPayload = maxChunkSize - CHUNK_HEADER_SIZE;
	if (maxPayload <= 0) {
		throw new Error('maxChunkSize must be greater than header size');
	}

	const chunks: Uint8Array[] = [];
	let offset = 0;

	while (offset < data.byteLength) {
		const remaining = data.byteLength - offset;
		const payloadSize = Math.min(remaining, maxPayload);
		const isFinal = offset + payloadSize >= data.byteLength;

		const chunk = new Uint8Array(CHUNK_HEADER_SIZE + payloadSize);
		const chunkView = new DataView(chunk.buffer);

		chunkView.setUint8(0, isFinal ? FLAG_FINAL : 0);
		chunkView.setUint32(1, messageId);
		chunk.set(
			data.subarray(offset, offset + payloadSize),
			CHUNK_HEADER_SIZE
		);

		chunks.push(chunk);
		offset += payloadSize;
	}

	// Handle empty data — produce a single final chunk with no payload
	if (chunks.length === 0) {
		const chunk = new Uint8Array(CHUNK_HEADER_SIZE);
		const chunkView = new DataView(chunk.buffer);
		chunkView.setUint8(0, FLAG_FINAL);
		chunkView.setUint32(1, messageId);
		chunks.push(chunk);
	}

	return chunks;
}

interface PendingMessage {
	chunks: Uint8Array[];
	totalSize: number;
}

export class MessageAssembler {
	private pending = new Map<number, PendingMessage>();

	/**
	 * Feed a chunk into the assembler.
	 * Returns the complete message if all chunks have arrived, or null.
	 */
	addChunk(chunk: Uint8Array): Uint8Array | null {
		const view = new DataView(
			chunk.buffer,
			chunk.byteOffset,
			chunk.byteLength
		);
		const flags = view.getUint8(0);
		const messageId = view.getUint32(1);
		const payload = chunk.subarray(CHUNK_HEADER_SIZE);

		let pending = this.pending.get(messageId);
		if (!pending) {
			pending = { chunks: [], totalSize: 0 };
			this.pending.set(messageId, pending);
		}

		pending.chunks.push(payload);
		pending.totalSize += payload.byteLength;

		if (flags & FLAG_FINAL) {
			this.pending.delete(messageId);

			// Fast path for single-chunk messages
			if (pending.chunks.length === 1) {
				return pending.chunks[0];
			}

			// Concatenate all chunks
			const result = new Uint8Array(pending.totalSize);
			let offset = 0;
			for (const part of pending.chunks) {
				result.set(part, offset);
				offset += part.byteLength;
			}
			return result;
		}

		return null;
	}
}
