import {
	hydrateUpdateFileOps,
	normalizeFilesystemOperations,
} from '@php-wasm/fs-journal';
import type { SyncMiddleware } from '.';
import type { UniversalPHP } from '@php-wasm/universal';

export const hydrateFsWritesMiddleware = (
	php: UniversalPHP
): SyncMiddleware => ({
	beforeSend: async (envelope) => ({
		...envelope,
		fs: await hydrateUpdateFileOps(
			php,
			normalizeFilesystemOperations(envelope.fs)
		),
	}),
	afterReceive: (envelopes) => envelopes,
});
