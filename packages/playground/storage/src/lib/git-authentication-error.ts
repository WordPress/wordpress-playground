import { redactSensitiveUrl } from '@php-wasm/util';

/**
 * Custom error class for git authentication failures.
 */
export class GitAuthenticationError extends Error {
	public repoUrl: string;
	public status: number;

	constructor(repoUrl: string, status: number) {
		super(
			`Authentication required to access private repository: ${redactSensitiveUrl(repoUrl)}`
		);
		this.name = 'GitAuthenticationError';
		this.repoUrl = redactSensitiveUrl(repoUrl);
		this.status = status;
	}
}
