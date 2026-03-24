import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import path from 'path';

export default class implements Reporter {
	private currentFile: string | null = null;

	/* eslint-disable no-console */
	onTestBegin(test: TestCase) {
		const file = path.basename(test.location.file);
		if (file !== this.currentFile) {
			console.groupEnd();
			this.currentFile = file;
			console.log(`\n> ${file}`);
			console.group();
		}
	}

	/* eslint-disable no-console */
	onTestEnd(test: TestCase, result: TestResult) {
		const status =
			result.status === 'passed'
				? '\x1b[32m✓\x1b[0m'
				: '\x1b[31m✖\x1b[0m';
		console.log(`${status} ${test.titlePath().slice(3).join(' > ')}`);

		if (result.error)
			console.log(
				`\n\x1b[31m${JSON.stringify(result.error, null, 2)}\x1b[0m\n`
			);
	}
}
