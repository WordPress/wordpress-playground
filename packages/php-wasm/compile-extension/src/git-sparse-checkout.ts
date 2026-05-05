import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	indexPack,
	init,
	listServerRefs,
	readObject,
	type CommitObject,
	type TreeEntry,
	type TreeObject,
} from 'isomorphic-git';
import http from 'isomorphic-git/http/node';

/**
 * Sparse-fetches blobs from a Git repository using the same protocol shape as
 * https://github.com/adamziel/git-sparse-checkout-in-js, with isomorphic-git
 * handling ref discovery, pack indexing, and object reads.
 */
export async function sparseCheckoutFiles({
	repoUrl,
	ref,
	paths,
	outDir,
	workDir,
}: {
	repoUrl: string;
	ref: string;
	paths: string[];
	outDir: string;
	workDir: string;
}): Promise<string[]> {
	if (paths.length === 0) {
		return [];
	}

	await rm(workDir, { recursive: true, force: true });
	await mkdir(workDir, { recursive: true });
	await init({ fs, dir: workDir, defaultBranch: 'trunk' });

	const commitHash = await resolveRemoteCommit(repoUrl, ref);
	await fetchAndIndexPack({
		repoUrl,
		dir: workDir,
		packfileName: 'trees.pack',
		body: createTreeFetchRequest(commitHash),
	});

	const commit = await readParsedObject<CommitObject>(
		workDir,
		commitHash,
		'commit'
	);
	const rootTree = await readParsedObject<TreeObject>(
		workDir,
		commit.tree,
		'tree'
	);
	const entries = new Map<string, TreeEntry>();
	for (const filepath of paths) {
		for (const [matchedPath, entry] of await resolveTreeEntries(
			workDir,
			rootTree,
			filepath
		)) {
			entries.set(matchedPath, entry);
		}
	}

	await fetchAndIndexPack({
		repoUrl,
		dir: workDir,
		packfileName: 'blobs.pack',
		body: createObjectFetchRequest(
			Array.from(entries.values(), (entry) => entry.oid)
		),
	});

	await Promise.all(
		Array.from(entries, async ([filepath, entry]) => {
			const blob = await readObject({
				fs,
				dir: workDir,
				oid: entry.oid,
				format: 'content',
			});
			if (blob.type !== 'blob') {
				throw new Error(
					`Expected ${filepath} to resolve to a Git blob, got ${blob.type}.`
				);
			}
			const outputPath = path.join(outDir, filepath);
			await mkdir(path.dirname(outputPath), { recursive: true });
			await writeFile(outputPath, blob.object);
		})
	);

	return Array.from(entries.keys()).sort();
}

async function resolveRemoteCommit(
	repoUrl: string,
	ref: string
): Promise<string> {
	const fullRef = ref.startsWith('refs/') ? ref : refToFullRef(ref);
	const refs = await listServerRefs({
		http,
		url: repoUrl,
		prefix: fullRef,
		peelTags: true,
		protocolVersion: 2,
	});
	const exactRef = refs.find((entry) => entry.ref === fullRef);
	if (!exactRef) {
		throw new Error(`Could not resolve ${fullRef} from ${repoUrl}.`);
	}
	return exactRef.peeled ?? exactRef.oid;
}

function refToFullRef(ref: string): string {
	if (ref === 'trunk') {
		return 'refs/heads/trunk';
	}
	if (/^v?\d+\.\d+\.\d+/.test(ref)) {
		return `refs/tags/${ref.startsWith('v') ? ref : `v${ref}`}`;
	}
	return `refs/heads/${ref}`;
}

async function fetchAndIndexPack({
	repoUrl,
	dir,
	packfileName,
	body,
}: {
	repoUrl: string;
	dir: string;
	packfileName: string;
	body: Buffer;
}) {
	const response = await fetch(`${repoUrl}/git-upload-pack`, {
		method: 'POST',
		headers: {
			accept: 'application/x-git-upload-pack-result',
			'content-type': 'application/x-git-upload-pack-request',
			'content-length': String(body.length),
		},
		body,
	});

	if (!response.ok) {
		throw new Error(
			`Git upload-pack request failed with ${response.status} ${response.statusText}.`
		);
	}

	const packfile = parseUploadPackResponse(
		Buffer.from(await response.arrayBuffer())
	);
	if (packfile.length === 0) {
		throw new Error('Git upload-pack response did not contain a packfile.');
	}

	const packPath = path.join(dir, '.git/objects/pack', packfileName);
	await mkdir(path.dirname(packPath), { recursive: true });
	await writeFile(packPath, packfile);
	await indexPack({
		fs,
		dir,
		filepath: path.relative(dir, packPath).split(path.sep).join('/'),
	});
}

async function readParsedObject<T>(
	dir: string,
	oid: string,
	expectedType: 'commit' | 'tree'
): Promise<T> {
	const result = await readObject({
		fs,
		dir,
		oid,
		format: 'parsed',
	});
	if (result.type !== expectedType) {
		throw new Error(`Expected ${oid} to be a ${expectedType}, got ${result.type}.`);
	}
	return result.object as T;
}

async function resolveTreeEntries(
	dir: string,
	rootTree: TreeObject,
	filepath: string
): Promise<Array<[string, TreeEntry]>> {
	const entries = await resolveTreeEntriesFromSegments(
		dir,
		rootTree,
		filepath.split('/'),
		[]
	);
	if (entries.length === 0) {
		throw new Error(`Path not found in the repo: ${filepath}`);
	}
	return entries;
}

async function resolveTreeEntriesFromSegments(
	dir: string,
	tree: TreeObject,
	segments: string[],
	resolvedSegments: string[]
): Promise<Array<[string, TreeEntry]>> {
	const [segment, ...remainingSegments] = segments;
	const matchedEntries = tree.filter((entry) =>
		pathSegmentMatchesPattern(entry.path, segment)
	);

	if (matchedEntries.length === 0) {
		return [];
	}

	const matches: Array<[string, TreeEntry]> = [];
	for (const entry of matchedEntries) {
		const nextResolvedSegments = [...resolvedSegments, entry.path];
		if (remainingSegments.length === 0) {
			if (entry.type !== 'blob') {
				throw new Error(
					`Expected ${nextResolvedSegments.join('/')} to resolve to a file.`
				);
			}
			matches.push([nextResolvedSegments.join('/'), entry]);
			continue;
		}
		if (entry.type !== 'tree') {
			continue;
		}
		matches.push(
			...(await resolveTreeEntriesFromSegments(
				dir,
				await readParsedObject<TreeObject>(dir, entry.oid, 'tree'),
				remainingSegments,
				nextResolvedSegments
			))
		);
	}

	return matches;
}

export function pathSegmentMatchesPattern(
	segment: string,
	pattern: string
): boolean {
	if (!pattern.includes('*')) {
		return segment === pattern;
	}
	return new RegExp(
		`^${pattern
			.split('*')
			.map(escapeRegExp)
			.join('.*')}$`
	).test(segment);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createTreeFetchRequest(commitHash: string): Buffer {
	return Buffer.concat([
		pktLine(
			`want ${commitHash} multi_ack_detailed no-done side-band-64k thin-pack ofs-delta agent=git/2.37.3 filter \n`
		),
		pktLine('filter blob:none\n'),
		pktLine(`shallow ${commitHash}\n`),
		pktLine('deepen 1\n'),
		flushPkt(),
		pktLine('done\n'),
	]);
}

function createObjectFetchRequest(objectHashes: string[]): Buffer {
	return Buffer.concat([
		...objectHashes.map((objectHash) =>
			pktLine(
				`want ${objectHash} multi_ack_detailed no-done side-band-64k thin-pack ofs-delta agent=git/2.37.3 \n`
			)
		),
		flushPkt(),
		pktLine('done\n'),
	]);
}

export function parseUploadPackResponse(response: Buffer): Buffer {
	const packChunks: Buffer[] = [];
	let offset = 0;

	while (offset + 4 <= response.length) {
		const lineLength = Number.parseInt(
			response.subarray(offset, offset + 4).toString('ascii'),
			16
		);
		offset += 4;
		if (!Number.isFinite(lineLength)) {
			throw new Error('Invalid Git pkt-line response.');
		}
		if (lineLength === 0) {
			continue;
		}
		if (lineLength === 1) {
			continue;
		}
		if (lineLength === 2) {
			break;
		}
		if (lineLength < 4) {
			throw new Error('Invalid Git pkt-line response.');
		}
		const payloadLength = lineLength - 4;
		const payload = response.subarray(offset, offset + payloadLength);
		offset += payloadLength;

		if (payload.length === 0 || payload.toString('utf8') === 'NAK\n') {
			continue;
		}

		const sideband = payload[0];
		if (sideband === 1) {
			packChunks.push(payload.subarray(1));
		} else if (sideband === 2) {
			continue;
		} else if (sideband === 3) {
			throw new Error(payload.subarray(1).toString('utf8'));
		} else if (payload.subarray(0, 4).toString('ascii') === 'PACK') {
			packChunks.push(payload);
		}
	}

	return Buffer.concat(packChunks);
}

function pktLine(value: string | Buffer): Buffer {
	const payload = Buffer.isBuffer(value) ? value : Buffer.from(value);
	const header = Buffer.from((payload.length + 4).toString(16).padStart(4, '0'));
	return Buffer.concat([header, payload]);
}

function flushPkt(): Buffer {
	return Buffer.from('0000');
}

export function stableHash(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export async function readJsonFile<T>(filename: string): Promise<T> {
	return JSON.parse(await readFile(filename, 'utf8')) as T;
}
