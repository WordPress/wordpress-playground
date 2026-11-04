import { redactReprintPrivateKeys } from './keys';
import { joinPaths } from '@php-wasm/util';
import type { PlaygroundClient } from '@wp-playground/client';

/** Read saved transfer records, or return partial records if the worker stops answering. */
export async function getTransferDiagnostics(
	playground: PlaygroundClient
): Promise<string> {
	const root = '/tmp/playground-reprint-state';
	const sections: string[] = [];
	let pendingPath = root;
	let cancelled = false;
	/** Read each available record without making a stalled worker block the UI. */
	const read = async () => {
		if (await playground.fileExists(root)) {
			if (cancelled) return '';
			for (const directory of await playground.listFiles(root)) {
				for (const relative of [
					'operation.json',
					'pull-state/progress.json',
					'pull-state/audit.log',
				]) {
					if (cancelled) return '';
					const path = joinPaths(root, directory, relative);
					pendingPath = path;
					if (!(await playground.fileExists(path))) continue;
					if (cancelled) return '';
					const contents = await playground.readFileAsText(path);
					if (cancelled) return '';
					// Redact before taking the tail, so its boundary cannot expose
					// part of a key that appeared in an upstream error message.
					const redacted = redactReprintPrivateKeys(contents);
					sections.push(`${path}\n${redacted.slice(-12000)}`);
				}
			}
		}
		return sections.length
			? sections.join('\n\n')
			: 'No saved transfer log is available in this Playground.';
	};
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			read(),
			new Promise<string>((resolve) => {
				timeout = setTimeout(() => {
					// Do not queue more reads if the blocked worker answers later.
					cancelled = true;
					// File reads use the same worker as PHP and OPFS saving. They
					// cannot answer while that worker is blocked by synchronous work.
					resolve(
						[
							...sections,
							`Playground did not answer the log request within 10 seconds. Last path: ${pendingPath}. The worker may still be busy. These are the records received so far; try again to read the rest.`,
						].join('\n\n')
					);
				}, 10000);
			}),
		]);
	} finally {
		clearTimeout(timeout);
	}
}
