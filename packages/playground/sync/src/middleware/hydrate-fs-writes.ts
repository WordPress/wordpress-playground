import {
	FilesystemOperation,
	hydrateUpdateFileOps,
	normalizeFilesystemOperations,
} from '@php-wasm/fs-journal';
import { SyncMiddleware } from '.';
import { UniversalPHP } from '@php-wasm/universal';

export function hydrateFsWritesMiddleware(php: UniversalPHP): SyncMiddleware {
	return {
		beforeSend: async (envelopes) => {
			let fsEnvelopes = envelopes.filter(({ scope }) => scope === 'fs');
			const otherEnvelopes = envelopes.filter(
				({ scope }) => scope !== 'fs'
			);
			if (fsEnvelopes.length > 0) {
				let fsOps = fsEnvelopes.map(
					({ contents: fsOp }) => fsOp
				) as FilesystemOperation[];
				fsOps = normalizeFilesystemOperations(fsOps);
				await hydrateUpdateFileOps(php, fsOps);
				fsEnvelopes = fsOps.map((fsOp) => ({
					scope: 'fs',
					contents: fsOp,
				}));
			}
			return [...otherEnvelopes, ...fsEnvelopes];
		},
		afterReceive: (envelopes) => envelopes,
	};
}
