import { Semaphore } from '@php-wasm/util';
import { Octokit } from 'octokit';
import {
	DELETE_FILE,
	createPullRequest,
} from 'octokit-plugin-create-pull-request';
import { Changeset } from './changeset';

export type GithubClient = ReturnType<typeof createClient>;

export function createClient(
	githubToken: string
): Octokit & ReturnType<typeof createPullRequest> {
	const MyOctokit = Octokit.plugin(createPullRequest as any);
	const octokit = new MyOctokit({
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

export function changesetToPRFiles(changeset: Changeset) {
	const files: Record<
		string,
		string | typeof DELETE_FILE | { content: string; encoding: string }
	> = {};
	for (const [path, content] of changeset.create) {
		files[path] = encodeChangesetContent(content);
	}
	for (const [path, content] of changeset.update) {
		files[path] = encodeChangesetContent(content);
	}
	for (const path of changeset.delete) {
		files[path] = DELETE_FILE;
	}
	return files;
}

function encodeChangesetContent(content: string | Uint8Array) {
	if (typeof content === 'string') {
		return content;
	}
	return {
		content: uint8ArrayToBase64(content),
		encoding: 'base64',
	};
}

function uint8ArrayToBase64(bytes: Uint8Array) {
	const binary = [];
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary.push(String.fromCharCode(bytes[i]));
	}
	return window.btoa(binary.join(''));
}
