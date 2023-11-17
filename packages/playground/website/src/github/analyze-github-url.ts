import { GithubClient } from '@wp-playground/storage';

export interface GitHubPointer {
	owner: string;
	repo: string;
	type: 'pr' | 'repo' | 'branch' | 'rawfile' | 'unknown';
	ref: string | 'unknown';
	path: string;
	pr?: number;
	contentType?: 'theme' | 'plugin' | 'wp-content';
}

const invalidPointer: GitHubPointer = {
	owner: '',
	repo: '',
	type: 'unknown',
	ref: 'unknown',
	path: '',
	pr: undefined,
	contentType: undefined,
};

export async function analyzeGitHubURL(
	octokit: GithubClient,
	url: string
): Promise<GitHubPointer> {
	const pointer = staticAnalyzeGitHubURL(url);
	if (pointer === invalidPointer) {
		return invalidPointer;
	}
	if (pointer.type === 'pr') {
		const prDetails = await octokit.rest.pulls.get({
			owner: pointer.owner!,
			repo: pointer.repo!,
			pull_number: pointer.pr!,
		});
		pointer.ref = prDetails.data.head.ref;
	}
	if (pointer.type === 'repo') {
		const repoDetails = await octokit.rest.repos.get({
			owner: pointer.owner!,
			repo: pointer.repo!,
		});
		pointer.ref = repoDetails.data.default_branch;
	}

	// Guess the content type
	const { data: files } = await octokit.rest.repos.getContent({
		owner: pointer.owner!,
		repo: pointer.repo!,
		path: pointer.path!,
		ref: pointer.ref!,
	});
	if (Array.isArray(files)) {
		if (files.some(({ name }) => name === 'theme.json')) {
			pointer.contentType = 'theme';
		} else if (
			files.some(({ name }) =>
				['plugins', 'themes', 'mu-plugins'].includes(name)
			)
		) {
			pointer.contentType = 'wp-content';
		} else if (files.some(({ name }) => name.endsWith('.php'))) {
			pointer.contentType = 'plugin';
		}
	}

	return pointer as GitHubPointer;
}

export function staticAnalyzeGitHubURL(url: string): Partial<GitHubPointer> {
	let urlObj;
	try {
		urlObj = new URL(url);
	} catch (e) {
		return invalidPointer;
	}
	const [owner, repo, ...rest] = urlObj.pathname
		.replace(/^\/+|\/+$/g, '')
		.split('/');

	let pr,
		ref = 'unknown',
		type: GitHubPointer['type'] = 'unknown',
		path = '';
	if (urlObj.hostname === 'raw.githubusercontent.com') {
		type = 'rawfile';
		path = urlObj.pathname.substring(1);
	} else if (rest[0] === 'pull') {
		type = 'pr';
		pr = parseInt(rest[1]);
		if (isNaN(pr) || !pr) {
			throw new Error(
				`Invalid Pull Request  number ${pr} parsed from the following GitHub URL: ${url}`
			);
		}
	} else if (['blob', 'tree'].includes(rest[0])) {
		type = 'branch';
		ref = rest[1];
		path = rest.slice(2).join('/');
	} else if (rest.length === 0) {
		type = 'repo';
	}

	return { owner, repo, type, ref, path, pr };
}
