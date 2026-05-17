import type { SparseCheckoutObject } from './git-sparse-checkout';
import pako from 'pako';
const deflate = pako.deflate;

type GitDirectoryRefType = 'branch' | 'tag' | 'commit' | 'refname';

type GitHeadInfo = {
	headContent: string;
	branchName?: string;
	branchRef?: string;
	tagName?: string;
};

type GitIndexEntry = {
	filepath: string;
	oid: string;
	stats: {
		ctimeSeconds: number;
		ctimeNanoseconds: number;
		mtimeSeconds: number;
		mtimeNanoseconds: number;
		dev: number;
		ino: number;
		mode: number;
		uid: number;
		gid: number;
		size: number;
	};
};

const FULL_SHA_REGEX = /^[0-9a-f]{40}$/i;

/**
 * Creates loose Git object files from sparse checkout objects.
 * Each object is compressed using deflate and stored in the Git objects directory.
 */
async function createLooseGitObjectFiles(
	objects: SparseCheckoutObject[]
): Promise<Record<string, Uint8Array>> {
	const files: Record<string, Uint8Array> = {};
	const encoder = new TextEncoder();

	await Promise.all(
		objects.map(async ({ oid, type, body }) => {
			if (!oid || body.length === 0) {
				return;
			}
			const header = encoder.encode(`${type} ${body.length}\0`);
			const combined = new Uint8Array(header.length + body.length);
			combined.set(header, 0);
			combined.set(body, header.length);
			const compressed = await deflate(combined);
			const prefix = oid.slice(0, 2);
			const suffix = oid.slice(2);
			files[`.git/objects/${prefix}/${suffix}`] = compressed;
		})
	);

	return files;
}

/**
 * Resolves the HEAD reference information based on the ref type and value.
 */
function resolveHeadInfo(
	ref: string,
	refType: GitDirectoryRefType | undefined,
	commitHash: string
): GitHeadInfo {
	const trimmed = ref?.trim() ?? '';
	let fullRef: string | null = null;

	switch (refType) {
		case 'branch':
			if (trimmed) {
				fullRef = `refs/heads/${trimmed}`;
			}
			break;
		case 'refname':
			fullRef = trimmed || null;
			break;
		case 'tag':
			if (trimmed.startsWith('refs/')) {
				fullRef = trimmed;
			} else if (trimmed) {
				fullRef = `refs/tags/${trimmed}`;
			}
			break;
		case 'commit':
			fullRef = null;
			break;
		default:
			if (trimmed.startsWith('refs/')) {
				fullRef = trimmed;
			} else if (FULL_SHA_REGEX.test(trimmed)) {
				fullRef = null;
			} else if (trimmed && trimmed !== 'HEAD') {
				fullRef = `refs/heads/${trimmed}`;
			}
			break;
	}

	const headContent = fullRef ? `ref: ${fullRef}\n` : `${commitHash}\n`;

	const branchRef =
		fullRef && fullRef.startsWith('refs/heads/') ? fullRef : undefined;
	const branchName = branchRef?.slice('refs/heads/'.length);

	const tagRef =
		fullRef && fullRef.startsWith('refs/tags/') ? fullRef : undefined;
	const tagName = tagRef?.slice('refs/tags/'.length);

	return {
		headContent,
		branchName,
		branchRef,
		tagName,
	};
}

/**
 * Builds a Git config file content with remote and branch configuration.
 */
function buildGitConfig(
	repoUrl: string,
	{
		branchName,
		partialCloneFilter,
	}: { branchName?: string; partialCloneFilter?: string }
): string {
	const repositoryFormatVersion = partialCloneFilter ? 1 : 0;
	const lines = [
		'[core]',
		`\trepositoryformatversion = ${repositoryFormatVersion}`,
		'\tfilemode = true',
		'\tbare = false',
		'\tlogallrefupdates = true',
		'\tignorecase = true',
		'\tprecomposeunicode = true',
		'[remote "origin"]',
		`\turl = ${repoUrl}`,
		'\tfetch = +refs/heads/*:refs/remotes/origin/*',
		'\tfetch = +refs/tags/*:refs/tags/*',
	];
	if (partialCloneFilter) {
		lines.push('\tpromisor = true');
		lines.push(`\tpartialclonefilter = ${partialCloneFilter}`);
		lines.push('[extensions]');
		lines.push('\tpartialclone = origin');
	}
	if (branchName) {
		lines.push(
			`[branch "${branchName}"]`,
			'\tremote = origin',
			`\tmerge = refs/heads/${branchName}`
		);
	}
	return lines.join('\n') + '\n';
}

/**
 * Creates a complete .git directory structure with all necessary files.
 * This includes HEAD, config, refs, objects, and the Git index.
 */
export async function createDotGitDirectory({
	repoUrl,
	commitHash,
	ref,
	refType,
	objects,
	fileOids,
	pathPrefix,
}: {
	repoUrl: string;
	commitHash: string;
	ref: string;
	refType?: GitDirectoryRefType;
	objects: SparseCheckoutObject[];
	fileOids: Record<string, string>;
	pathPrefix: string;
}): Promise<Record<string, string | Uint8Array>> {
	const gitFiles: Record<string, string | Uint8Array> = {};
	const headInfo = resolveHeadInfo(ref, refType, commitHash);

	gitFiles['.git/HEAD'] = headInfo.headContent;
	gitFiles['.git/config'] = buildGitConfig(repoUrl, {
		branchName: headInfo.branchName,
	});
	gitFiles['.git/description'] = 'WordPress Playground clone\n';
	gitFiles['.git/shallow'] = `${commitHash}\n`;

	// Create refs/ directory structure
	gitFiles['.git/refs/heads/.gitkeep'] = '';
	gitFiles['.git/refs/tags/.gitkeep'] = '';
	gitFiles['.git/refs/remotes/.gitkeep'] = '';

	if (headInfo.branchRef && headInfo.branchName) {
		gitFiles['.git/logs/HEAD'] = `ref: ${headInfo.branchRef}\n`;
		gitFiles[`.git/${headInfo.branchRef}`] = `${commitHash}\n`;
		gitFiles[`.git/refs/remotes/origin/${headInfo.branchName}`] =
			`${commitHash}\n`;
		gitFiles['.git/refs/remotes/origin/HEAD'] =
			`ref: refs/remotes/origin/${headInfo.branchName}\n`;
	}

	if (headInfo.tagName) {
		gitFiles[`.git/refs/tags/${headInfo.tagName}`] = `${commitHash}\n`;
	}

	// Use loose objects only, no packfiles
	Object.assign(gitFiles, await createLooseGitObjectFiles(objects));

	const indexEntries = Object.entries(fileOids).map(([path, oid]) => ({
		filepath: path.substring(pathPrefix.length).replace(/^\/+/, ''),
		oid,
		stats: {
			ctimeSeconds: 0,
			ctimeNanoseconds: 0,
			mtimeSeconds: 0,
			mtimeNanoseconds: 0,
			dev: 0,
			ino: 0,
			mode: 0o100644,
			uid: 0,
			gid: 0,
			size: 0,
		},
	}));
	gitFiles['.git/index'] = await createGitIndex(indexEntries);

	return gitFiles;
}

async function createGitIndex(entries: GitIndexEntry[]) {
	const sortedEntryBuffers = entries
		.sort((a, b) => a.filepath.localeCompare(b.filepath))
		.map(createGitIndexEntry);
	const header = new Uint8Array(12);
	const headerView = new DataView(header.buffer);
	header.set(new TextEncoder().encode('DIRC'), 0);
	headerView.setUint32(4, 2);
	headerView.setUint32(8, entries.length);
	const body = concatUint8Arrays([header, ...sortedEntryBuffers]);
	const checksum = new Uint8Array(await crypto.subtle.digest('SHA-1', body));
	return concatUint8Arrays([body, checksum]);
}

function createGitIndexEntry({ filepath, oid, stats }: GitIndexEntry) {
	const pathBytes = new TextEncoder().encode(filepath);
	const length = Math.ceil((62 + pathBytes.length + 1) / 8) * 8;
	const entry = new Uint8Array(length);
	const view = new DataView(entry.buffer);

	view.setUint32(0, stats.ctimeSeconds);
	view.setUint32(4, stats.ctimeNanoseconds);
	view.setUint32(8, stats.mtimeSeconds);
	view.setUint32(12, stats.mtimeNanoseconds);
	view.setUint32(16, stats.dev);
	view.setUint32(20, stats.ino);
	view.setUint32(24, normalizeGitFileMode(stats.mode));
	view.setUint32(28, stats.uid);
	view.setUint32(32, stats.gid);
	view.setUint32(36, stats.size);
	entry.set(hexToBytes(oid), 40);
	view.setUint16(60, Math.min(pathBytes.length, 0xfff));
	entry.set(pathBytes, 62);
	return entry;
}

function normalizeGitFileMode(mode: number) {
	let type = mode > 0 ? mode >> 12 : 0;
	if (![0b0100, 0b1000, 0b1010, 0b1110].includes(type)) {
		type = 0b1000;
	}
	let permissions = mode & 0o777;
	permissions = permissions & 0b001001001 ? 0o755 : 0o644;
	if (type !== 0b1000) {
		permissions = 0;
	}
	return (type << 12) + permissions;
}

function hexToBytes(hex: string) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function concatUint8Arrays(arrays: Uint8Array[]) {
	const length = arrays.reduce((sum, array) => sum + array.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}
