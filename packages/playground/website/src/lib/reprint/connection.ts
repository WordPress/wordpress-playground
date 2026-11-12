import type { PlaygroundClient } from '@wp-playground/client';
import { joinPaths } from '@php-wasm/util';

/** The address travels with the saved site; its key stays in this browser tab. */
export async function readReprintConnection(
	playground: PlaygroundClient
): Promise<string | null> {
	try {
		const path = joinPaths(
			await playground.documentRoot,
			'.playground-reprint/connection.json'
		);
		if (!(await playground.fileExists(path))) return null;
		const connection = JSON.parse(await playground.readFileAsText(path));
		return typeof connection.url === 'string' ? connection.url : null;
	} catch {
		// An unreadable saved address must not prevent a new connection.
		return null;
	}
}
