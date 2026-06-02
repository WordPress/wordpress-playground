import { GitIndex } from 'isomorphic-git/src/models/GitIndex.js';
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
		gitFiles[
			`.git/refs/remotes/origin/${headInfo.branchName}`
		] = `${commitHash}\n`;
		gitFiles[
			'.git/refs/remotes/origin/HEAD'
		] = `ref: refs/remotes/origin/${headInfo.branchName}\n`;
	}

	if (headInfo.tagName) {
		gitFiles[`.git/refs/tags/${headInfo.tagName}`] = `${commitHash}\n`;
	}

	// Use loose objects only, no packfiles
	Object.assign(gitFiles, await createLooseGitObjectFiles(objects));

	// Create the git index
	const index = new GitIndex();
	for (const [path, oid] of Object.entries(fileOids)) {
		// Remove the path prefix to get the working tree relative path
		const workingTreePath = path
			.substring(pathPrefix.length)
			.replace(/^\/+/, '');
		index.insert({
			filepath: workingTreePath,
			oid,
			stats: {
				ctimeSeconds: 0,
				ctimeNanoseconds: 0,
				mtimeSeconds: 0,
				mtimeNanoseconds: 0,
				dev: 0,
				ino: 0,
				mode: 0o100644, // Regular file
				uid: 0,
				gid: 0,
				size: 0,
			},
		});
	}
	const indexBuffer = await index.toObject();
	// Convert Buffer to Uint8Array - copy the data to ensure it's a proper Uint8Array
	gitFiles['.git/index'] = Uint8Array.from(indexBuffer);

	return gitFiles;
}
