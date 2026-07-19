import { filterStream } from '../utils/filter-stream';
import { concatUint8Array } from '../utils/concat-uint8-array';
import { collectBytes } from '../utils/collect-bytes';
import {
	readCentralDirectoryEntry,
	readFileEntry,
	decodeZip,
} from './decode-zip';
import type { CentralDirectoryEntry, FileEntry } from './types';
import { SIGNATURE_CENTRAL_DIRECTORY_END } from './types';
import type { IterableReadableStream } from '../utils/iterable-stream-polyfill';

const CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE = 110 * 1024;
const BATCH_DOWNLOAD_OF_FILES_IF_CLOSER_THAN = 10 * 1024;
// Leave room in a 50-request budget for the HEAD and range-capability requests.
const MAX_RANGE_REQUESTS = 48;
const PREFER_RANGES_IF_FILE_LARGER_THAN = 1024 * 1024 * 1;

const DEFAULT_PREDICATE = () => true;

/**
 * Streams the contents of a remote zip file.
 *
 * If the zip is large and the predicate is filtering the zip contents,
 * only the matching files will be downloaded using the Range header
 * (if supported by the server).
 *
 * @param url The URL of the zip file.
 * @param predicate Optional. A function that returns true if the file should be downloaded.
 * @returns A stream of zip entries.
 */
export async function decodeRemoteZip(
	url: string,
	predicate: (
		dirEntry: CentralDirectoryEntry | FileEntry
	) => boolean = DEFAULT_PREDICATE
) {
	if (predicate === DEFAULT_PREDICATE) {
		// If we're not filtering the zip contents, let's just
		// grab the entire zip.
		const response = await fetch(url);
		return decodeZip(response.body!);
	}

	const contentLength = await fetchContentLength(url);
	if (contentLength <= PREFER_RANGES_IF_FILE_LARGER_THAN) {
		// If the zip is small enough, let's just grab it.
		const response = await fetch(url);
		return decodeZip(response.body!);
	}

	// Ensure ranges query support:
	// Fetch one byte
	const response = await fetch(url, {
		headers: {
			// 0-0 looks weird, doesn't it?
			// The Range header is inclusive so it's actually
			// a valid header asking for the first byte.
			Range: 'bytes=0-0',
			'Accept-Encoding': 'none',
		},
	});

	// Fork the stream so that we can reuse it in case
	// the Range header is unsupported and we're now streaming
	// the entire file
	const [peekStream, responseStream] = response.body!.tee();

	// Read from the forked stream and close it.
	const peekReader = peekStream.getReader();
	const { value: peekBytes } = await peekReader.read();
	const { done: peekDone } = await peekReader.read();
	peekReader.releaseLock();
	peekStream.cancel();

	// Confirm our Range query worked as intended:
	const rangesSupported = peekBytes?.length === 1 && peekDone;
	if (!rangesSupported) {
		// Uh-oh, we're actually streaming the entire file.
		// Let's reuse the forked stream as our response stream.
		return decodeZip(responseStream);
	}

	// We're good, let's clean up the other branch of the response stream.
	responseStream.cancel();
	const source = await createFetchSource(url, contentLength);
	return streamCentralDirectoryEntries(source)
		.pipeThrough(filterStream(predicate))
		.pipeThrough(partitionNearbyEntries(source.length))
		.pipeThrough(
			fetchPartitionedEntries(source)
		) as IterableReadableStream<FileEntry>;
}

/**
 * Streams the central directory entries of a zip file.
 *
 * @param source
 * @returns
 */
function streamCentralDirectoryEntries(source: BytesSource) {
	const centralDirectoryStream = streamCentralDirectoryBytes(source);

	return new ReadableStream<CentralDirectoryEntry>({
		async pull(controller) {
			const entry = await readCentralDirectoryEntry(
				await centralDirectoryStream
			);
			if (!entry) {
				controller.close();
				return;
			}
			controller.enqueue(entry);
		},
	});
}

/**
 * Streams the central directory bytes of a zip file.
 *
 * @param source
 * @returns
 */
async function streamCentralDirectoryBytes(source: BytesSource) {
	const chunkSize = CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE;
	let centralDirectory: Uint8Array = new Uint8Array();

	let chunkStart = source.length;
	do {
		chunkStart = Math.max(0, chunkStart - chunkSize);
		const chunkEnd = Math.min(chunkStart + chunkSize, source.length);
		const bytes = await collectBytes(
			await source.streamBytes(chunkStart, chunkEnd)
		);
		centralDirectory = concatUint8Array(bytes!, centralDirectory);

		// Scan the buffer for the signature
		const view = new DataView(bytes!.buffer);
		for (let i = view.byteLength - 4; i >= 0; i--) {
			if (view.getUint32(i, true) !== SIGNATURE_CENTRAL_DIRECTORY_END) {
				continue;
			}

			// Confirm we have enough data to read the offset and the
			// length of the central directory.
			const centralDirectoryLengthAt = i + 12;
			const centralDirectoryOffsetAt = centralDirectoryLengthAt + 4;
			if (centralDirectory.byteLength < centralDirectoryOffsetAt + 4) {
				throw new Error('Central directory not found');
			}

			// Read where the central directory starts
			const dirStart = view.getUint32(centralDirectoryOffsetAt, true);
			if (dirStart < chunkStart) {
				// We're missing some bytes, let's grab them
				const missingBytes = await collectBytes(
					await source.streamBytes(dirStart, chunkStart)
				);
				centralDirectory = concatUint8Array(
					missingBytes!,
					centralDirectory
				);
			} else if (dirStart > chunkStart) {
				// We've read too many bytes, let's trim them
				centralDirectory = centralDirectory.slice(
					dirStart - chunkStart
				);
			}
			return new Blob([centralDirectory]).stream();
		}
	} while (chunkStart >= 0);

	throw new Error('Central directory not found');
}

/**
 * Partitions files that are no further apart in the zip
 * archive than BATCH_DOWNLOAD_OF_FILES_IF_CLOSER_THAN.
 * It may download some extra files living within the gaps
 * between the partitions.
 */
function partitionNearbyEntries(sourceLength: number) {
	let lastFileEndsAt = 0;
	let currentChunk: CentralDirectoryEntry[] = [];
	const batchDownloadThreshold = Math.max(
		BATCH_DOWNLOAD_OF_FILES_IF_CLOSER_THAN,
		Math.ceil(sourceLength / MAX_RANGE_REQUESTS)
	);
	return new TransformStream<CentralDirectoryEntry, CentralDirectoryEntry[]>({
		transform(zipEntry, controller) {
			// Byte distance too large, flush and start a new chunk
			if (
				zipEntry.firstByteAt >
				lastFileEndsAt + batchDownloadThreshold
			) {
				controller.enqueue(currentChunk);
				currentChunk = [];
			}
			lastFileEndsAt = zipEntry.lastByteAt;
			currentChunk.push(zipEntry);
		},
		flush(controller) {
			controller.enqueue(currentChunk);
		},
	});
}

/**
 * Fetches a chunk of files from the zip archive.
 *
 * If any extra files are present in the received
 * bytes stream, they are filtered out.
 */
function fetchPartitionedEntries(
	source: BytesSource
): ReadableWritablePair<FileEntry, CentralDirectoryEntry[]> {
	return new TransformStream<CentralDirectoryEntry[], FileEntry>({
		async transform(zipEntries, controller) {
			if (!zipEntries.length) {
				return;
			}

			const stream = await requestChunkRange(source, zipEntries);
			while (true) {
				const file = await readFileEntry(stream);
				if (!file) {
					return;
				}

				// A range can include files between the requested entries.
				if (
					zipEntries.some((entry) =>
						uint8ArraysEqual(entry.path, file.path)
					)
				) {
					controller.enqueue(file);
				}
			}
		},
	});
}

function uint8ArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

/**
 * Requests a chunk of bytes from the bytes source.
 *
 * @param source
 * @param zipEntries
 */
async function requestChunkRange(
	source: BytesSource,
	zipEntries: CentralDirectoryEntry[]
) {
	const lastZipEntry = zipEntries[zipEntries.length - 1];
	return await source.streamBytes(
		zipEntries[0].firstByteAt,
		lastZipEntry.lastByteAt
	);
}

/**
 * Fetches the Content-Length header from a remote URL.
 */
async function fetchContentLength(url: string) {
	return await fetch(url, { method: 'HEAD' })
		.then((response) => response.headers.get('Content-Length'))
		.then((contentLength) => {
			if (!contentLength) {
				throw new Error('Content-Length header is missing');
			}

			const parsedLength = parseInt(contentLength, 10);
			if (isNaN(parsedLength) || parsedLength < 0) {
				throw new Error('Content-Length header is invalid');
			}
			return parsedLength;
		});
}

/**
 * Private and experimental API: Range-based data sources.
 *
 * The idea is that if we can read arbitrary byte ranges from
 * a file, we can retrieve a specific subset of a zip file.
 */
type BytesSource = {
	length: number;
	streamBytes: (
		start: number,
		end: number
	) => Promise<ReadableStream<Uint8Array>>;
};

/**
 * Creates a BytesSource enabling fetching ranges of bytes
 * from a remote URL.
 */
async function createFetchSource(
	url: string,
	contentLength?: number
): Promise<BytesSource> {
	if (contentLength === undefined) {
		contentLength = await fetchContentLength(url);
	}

	return {
		length: contentLength,
		streamBytes: async (from: number, to: number) => {
			const response = await fetch(url, {
				headers: {
					// The Range header is inclusive, so we need to subtract 1
					Range: `bytes=${from}-${to - 1}`,
					'Accept-Encoding': 'none',
				},
			});
			if (response.status !== 206 || !response.body) {
				throw new Error(
					`Expected a partial zip range response, received ${response.status} ${response.statusText}`
				);
			}
			return response.body;
		},
	};
}
