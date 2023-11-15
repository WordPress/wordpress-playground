import { normalizePath } from '@php-wasm/util';
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
		const prDetails = await octokit.rest.pulls.get({
			owner: owner,
			repo: repo,
			pull_number: pr,
		});
		ref = prDetails.data.head.ref;
	} else if (['blob', 'tree'].includes(rest[0])) {
		type = 'branch';
		ref = rest[1];
		path = rest.slice(2).join('/');
	} else if (rest.length === 0) {
		type = 'repo';
		const repoDetails = await octokit.rest.repos.get({
			owner: owner,
			repo: repo,
		});
		ref = repoDetails.data.default_branch;
	}

	if (path) {
		path = normalizePath('/' + path);
	}

	// Guess the content type
	const { data: files } = await octokit.rest.repos.getContent({
		owner,
		repo,
		path,
		ref,
	});
	let contentType: GitHubPointer['contentType'] | undefined;
	if (Array.isArray(files)) {
		if (files.some(({ name }) => name === 'theme.json')) {
			contentType = 'theme';
		} else if (
			files.some(({ name }) =>
				['plugins', 'themes', 'mu-plugins'].includes(name)
			)
		) {
			contentType = 'wp-content';
		} else if (files.some(({ name }) => name.endsWith('.php'))) {
			contentType = 'plugin';
		}
	}

	return { owner, repo, type, ref, path, pr, contentType };
}
