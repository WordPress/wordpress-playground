/**
 * Re-export OpfsFilesystemBackend from storage package.
 * This file maintains backwards compatibility for existing imports
 * and adds website-specific helper functions.
 */
import { OpfsFilesystemBackend as BaseOpfsFilesystemBackend } from '@wp-playground/storage';

export type {
	WritableFilesystemBackend,
	ReadableFilesystemBackend,
} from '@wp-playground/storage';

/**
 * Default OPFS path for the last edited blueprint bundle.
 */
export const OPFS_BASE_PATH = ['blueprints', 'last-edited-bundle'];

/**
 * Extended OpfsFilesystemBackend with website-specific helper methods
 * for the blueprint editor's autosave functionality.
 */
export class OpfsFilesystemBackend extends BaseOpfsFilesystemBackend {
	/**
	 * Check if there's a saved blueprint bundle in the default location.
	 */
	static async hasSavedBundle(): Promise<boolean> {
		try {
			const backend =
				await BaseOpfsFilesystemBackend.fromPath(OPFS_BASE_PATH);
			const files = await backend.listFiles('/');
			return files.length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Create a backend for the default blueprint bundle location.
	 * Creates the directories if they don't exist.
	 */
	static async create(): Promise<OpfsFilesystemBackend> {
		const backend = await BaseOpfsFilesystemBackend.fromPath(
			OPFS_BASE_PATH,
			true
		);
		// Cast to the extended type since we know it's compatible
		return backend as unknown as OpfsFilesystemBackend;
	}
}
