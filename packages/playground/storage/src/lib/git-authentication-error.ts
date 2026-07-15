/**
 * Custom error class for git authentication failures.
 */
export class GitAuthenticationError extends Error {
	public repoUrl: string;
	public status: number;

	constructor(repoUrl: string, status: number) {
		super(
			`Authentication required to access private repository: ${repoUrl}`
		);
		this.name = 'GitAuthenticationError';
		this.repoUrl = repoUrl;
		this.status = status;
	}
}
