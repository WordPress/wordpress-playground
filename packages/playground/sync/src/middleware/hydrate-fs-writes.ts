import {
	hydrateUpdateFileOps,
	normalizeFilesystemOperations,
} from '@php-wasm/fs-journal';
import { SyncMiddleware } from '.';
import { UniversalPHP } from '@php-wasm/universal';

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
