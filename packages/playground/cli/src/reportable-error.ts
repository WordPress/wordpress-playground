/**
 * Specialized error class for CLI errors that should be reported to the user
 * as text messages. Any error of this type thrown in the CLI call stack will
 * be printed as a regular text, not a stack trace, and will cause the process
 * to exit with a non-zero exit code.
 */
import { logger } from '@php-wasm/logger';

export class ReportableError extends Error {
	public isReportableInCLI = true;

	constructor(message: string, options?: ErrorOptions) {
		super(message, {
			...options,
			cause: {
				isReportableInCLI: true,
			},
		});
		this.isReportableInCLI = true;
	}

	static getReportableCause(error: unknown): Error | null {
		let iterations = 0;
		const maxIterations = 15;

		const errorStack = [error];
		while (errorStack.length > 0 && iterations < maxIterations) {
			const subError = errorStack.pop();
			if (!(subError instanceof Error)) {
				continue;
			}
			if ((subError as any).isReportableInCLI) {
				return subError;
			}
			if (Array.isArray(subError.cause)) {
				errorStack.push(...subError.cause);
			} else {
				errorStack.push(subError.cause);
			}
			iterations++;
			if (iterations >= maxIterations) {
				logger.warn(
					'Recursion limit exceeded while checking if error is reportable'
				);
			}
		}

		return null;
	}
}
