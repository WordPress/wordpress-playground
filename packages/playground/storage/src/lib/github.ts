import { Semaphore } from '@php-wasm/util';
import { Octokit } from 'octokit';
import { Changeset } from './changeset';

export type GithubClient = ReturnType<typeof createClient>;

export function createClient(githubToken: string): Octokit {
	const octokit = new Octokit({
		auth: githubToken,
	});
	return octokit;
}

export type Files = Record<string, Uint8Array>;
export function filesListToObject(files: any[], root = '') {
	if (root.length && !root.endsWith('/')) {
		root += '/';
	}
	const result: Files = {};
	for (const file of files) {
		if (file.path.startsWith(root)) {
			result[file.path.substring(root.length)] = file.content;
		}
	}
	return result;
}

export interface GetFilesProgress {
	foundFiles: number;
	downloadedFiles: number;
}
export interface GetFilesOptions {
	onProgress?: ({ foundFiles, downloadedFiles }: GetFilesProgress) => void;
	progress?: GetFilesProgress;
}
export async function getFilesFromDirectory(
	octokit: GithubClient,
	owner: string,
	repo: string,
	ref: string,
	path: string,
	options: GetFilesOptions = {}
) {
	if (!options.progress) {
		options.progress = {
			foundFiles: 0,
			downloadedFiles: 0,
		};
	}
	const { onProgress } = options;
	const filePromises: Promise<any>[] = [];
	const directoryPromises: Promise<any>[] = [];

	// Fetch the content of the directory
	const { data: content } = await octokit.rest.repos.getContent({
		owner,
		repo,
		path,
		ref,
	});
	if (!Array.isArray(content)) {
		throw new Error(
			`Expected the list of files to be an array, but got ${typeof content}`
		);
	}

	for (const item of content) {
		if (item.type === 'file') {
			++options.progress.foundFiles;
			onProgress?.(options.progress);
			filePromises.push(
				getFileContent(octokit, owner, repo, ref, item).then((file) => {
					++options.progress!.downloadedFiles;
					onProgress?.(options.progress!);
					return file;
				})
			);
		} else if (item.type === 'dir') {
			directoryPromises.push(
				getFilesFromDirectory(
					octokit,
					owner,
					repo,
					ref,
					item.path,
					options
				)
			);
		}
	}

	const files = await Promise.all(filePromises);
	const filesInDirs = (await Promise.all(directoryPromises)).flatMap(
		(dir) => dir
	);
	return [...files, ...filesInDirs];
}

const semaphore = new Semaphore({ concurrency: 15 });
async function getFileContent(
	octokit: GithubClient,
	owner: string,
	repo: string,
	ref: string,
	item: { path: string; name: string }
) {
	const release = await semaphore.acquire();
	try {
		const { data: fileContent } = await octokit.rest.repos.getContent({
			owner,
			repo,
			ref,
			path: item.path,
		});
		if (!('content' in fileContent)) {
			throw new Error(`No content found for ${item.path}`);
		}
		return {
			name: item.name,
			path: item.path,
			content: base64ToUint8Array(fileContent.content),
		};
	} finally {
		release();
	}
}

function base64ToUint8Array(base64: string) {
	const binaryString = window.atob(base64); // This will convert base64 to binary string
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

/**
 * Usage:
 * > await getArtifact('wordpress', 'wordpress-develop', 5511, 'build.yml')
 *
 * To get the first artifact produced by the "build.yml" workflow running
 * as a part of the PR 5511
 *
 * @returns
 */
export async function getArtifact(
	octokit: GithubClient,
	owner: string,
	repo: string,
	pull_number: number,
	workflow_id: string
) {
	const { data: pullRequest } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number,
	});
	const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
		owner,
		repo,
		branch: pullRequest.head.ref,
		workflow_id,
	});
	const runId = workflowRuns.data.workflow_runs[0]?.id;
	const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
		owner,
		repo,
		run_id: runId,
	});

	const artifact = await octokit.rest.actions.downloadArtifact({
		owner,
		repo,
		artifact_id: artifacts.data.artifacts[0].id,
		archive_format: 'zip',
	});
	return artifact.data;
}

export async function mayPush(octokit: Octokit, owner: string, repo: string) {
	const { data: repository, headers } = await octokit.request(
		'GET /repos/{owner}/{repo}',
		{
			owner,
			repo,
		}
	);
	if (!headers['x-oauth-scopes'] || !repository.permissions?.push) {
		return false;
	}

	// @TODO Find a way to bubble up the following error earlier than on the
	//       first push attempt:
	//       "organization has enabled OAuth App access restrictions"
	return true;
}

export async function createOrUpdateBranch(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
	newHead: string
) {
	const branchExists = await octokit
		.request('GET /repos/{owner}/{repo}/branches/{branch}', {
			owner,
			repo,
			branch,
		})
		.then(
			() => true,
			() => false
		);

	if (branchExists) {
		await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
			owner,
			repo,
			sha: newHead,
			ref: `heads/${branch}`,
		});
	} else {
		await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
			owner,
			repo,
			sha: newHead,
			ref: `refs/heads/${branch}`,
		});
	}
}

/**
 * @param octokit
 * @param owner
 * @param repo
 * @returns The owner of the forked repository
 */
export async function fork(octokit: Octokit, owner: string, repo: string) {
	const user = await octokit.request('GET /user');
	const forks = await octokit.request('GET /repos/{owner}/{repo}/forks', {
		owner,
		repo,
	});
	const hasFork = forks.data.find(
		(fork: any) => fork.owner && fork.owner.login === user.data.login
	);

	if (!hasFork) {
		await octokit.request('POST /repos/{owner}/{repo}/forks', {
			owner,
			repo,
		});
	}

	return user.data.login;
}

export async function createCommit(
	octokit: Octokit,
	owner: string,
	repo: string,
	message: string,
	parentSha: string,
	treeSha: string
): Promise<string> {
	const {
		data: { sha },
	} = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
		owner,
		repo,
		message,
		tree: treeSha,
		parents: [parentSha],
	});

	return sha;
}

export async function createTree(
	octokit: Octokit,
	owner: string,
	repo: string,
	parentSha: string,
	changeset: Changeset
) {
	const tree = await createTreeNodes(
		octokit,
		owner,
		repo,
		parentSha,
		changeset
	);
	if (tree.length === 0) {
		return null;
	}

	const {
		data: { sha: newTreeSha },
	} = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
		owner,
		repo,
		base_tree: parentSha,
		tree,
	});
	return newTreeSha;
}

export type GitHubTreeNode = {
	path: string;
	mode: '100644';
} & (
	| {
			sha: string | null;
	  }
	| {
			content: string;
	  }
);
export async function createTreeNodes(
	octokit: Octokit,
	owner: string,
	repo: string,
	parentSha: string,
	changeset: Changeset
): Promise<GitHubTreeNode[]> {
	const blobsPromises = [];
	for (const [path, content] of changeset.create) {
		blobsPromises.push(createTreeNode(octokit, owner, repo, path, content));
	}
	for (const [path, content] of changeset.update) {
		blobsPromises.push(createTreeNode(octokit, owner, repo, path, content));
	}
	for (const path of changeset.delete) {
		blobsPromises.push(deleteFile(octokit, owner, repo, parentSha, path));
	}
	return Promise.all(blobsPromises).then(
		(blobs) => blobs.filter((blob) => !!blob) as GitHubTreeNode[]
	);
}

const blobSemaphore = new Semaphore({ concurrency: 10 });
export async function createTreeNode(
	octokit: Octokit,
	owner: string,
	repo: string,
	path: string,
	content: string | Uint8Array
): Promise<GitHubTreeNode> {
	const release = await blobSemaphore.acquire();
	try {
		if (ArrayBuffer.isView(content)) {
			try {
				// Attempt to decode the byteArray as a UTF-8 string
				const stringContent = new TextDecoder('utf-8', {
					fatal: true,
				}).decode(content);
				return {
					path,
					content: stringContent,
					mode: '100644',
				};
			} catch (e) {
				// If an error occurs, the byteArray is not valid UTF-8 and we must
				// create a blob first
				const {
					data: { sha },
				} = await octokit.rest.git.createBlob({
					owner,
					repo,
					encoding: 'base64',
					content: uint8ArrayToBase64(content),
				});
				return {
					path,
					sha,
					mode: '100644',
				};
			}
		} else {
			// Content is a string
			return {
				path,
				content,
				mode: '100644',
			};
		}
	} finally {
		release();
	}
}

export async function deleteFile(
	octokit: Octokit,
	owner: string,
	repo: string,
	parentSha: string,
	path: string
): Promise<GitHubTreeNode | undefined> {
	const release = await blobSemaphore.acquire();
	try {
		// Deleting a non-existent file from a tree leads to an
		// "GitRPC::BadObjectState" error, so we only attempt to delete the file if
		// it exists.
		await octokit.request('HEAD /repos/{owner}/{repo}/contents/:path', {
			owner,
			repo,
			ref: parentSha,
			path,
		});

		return {
			path,
			mode: '100644',
			sha: null,
		};
	} catch (error) {
		// Pass
		return undefined;
	} finally {
		release();
	}
}

function uint8ArrayToBase64(bytes: Uint8Array) {
	const binary = [];
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary.push(String.fromCharCode(bytes[i]));
	}
	return window.btoa(binary.join(''));
}
