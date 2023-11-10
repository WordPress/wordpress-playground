export interface GitHubPointer {
	owner: string;
	repo: string;
	type: 'pr' | 'branch' | 'zip' | 'unknown';
	ref: string | 'unknown';
	path: string;
	pr?: number;
}

export function analyzeGitHubURL(url: string): GitHubPointer {
	const urlObj = new URL(url);
	const [owner, repo, ...rest] = urlObj.pathname.substring(1).split('/');

	let pr,
		ref = 'unknown',
		type: GitHubPointer['type'] = 'unknown',
		path = '/';
	if (urlObj.hostname === 'raw.githubusercontent.com') {
		type = 'zip';
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
	}

	return { owner, repo, type, ref, path, pr };
}
