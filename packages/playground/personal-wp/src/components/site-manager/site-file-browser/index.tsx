import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import {
	type AsyncWritableFilesystem,
	OpfsFilesystemBackend,
	EventedFilesystem,
} from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import { PlaygroundFileEditor } from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import { getDirectoryPathForSlug } from '../../../lib/state/opfs/opfs-site-storage';

export function SiteFileBrowser({
	site,
	isVisible = true,
	documentRoot,
}: {
	site: SiteInfo;
	isVisible?: boolean;
	documentRoot: string;
}) {
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client, site);
	const clientRef = useRef<PlaygroundClient | null>(client);
	const filesystemRef = useRef<AsyncWritableFilesystem | null>(filesystem);

	// Keep refs in sync
	clientRef.current = client;
	filesystemRef.current = filesystem;

	// Handle filesystem changes - flush pending saves to the old filesystem
	const handleBeforeFilesystemChange = useCallback(
		async (_oldFilesystem: AsyncWritableFilesystem) => {
			// The old filesystem was a wrapper around a client
			// We need to save any pending changes before switching
			// This is handled by the fact that we're just writing to the filesystem
			// which proxies to the client
			logger.debug(
				'Filesystem changing, any pending saves will be flushed'
			);
		},
		[]
	);

	// Custom save handler that writes to either the client or OPFS directly
	const handleSaveFile = useCallback(
		async (path: string, content: string) => {
			// Prefer the client if available (keeps memfs and OPFS in sync)
			if (clientRef.current) {
				await clientRef.current.writeFile(path, content);
				return;
			}
			// Fall back to direct OPFS filesystem
			if (filesystemRef.current) {
				await filesystemRef.current.writeFile(path, content);
				return;
			}
			throw new Error('No filesystem available');
		},
		[]
	);

	return (
		<PlaygroundFileEditor
			filesystem={filesystem}
			documentRoot={documentRoot}
			isVisible={isVisible}
			initialPath={`${documentRoot}/wp-config.php`}
			placeholderText="Start this Playground to browse and edit its files."
			onSaveFile={handleSaveFile}
			onBeforeFilesystemChange={handleBeforeFilesystemChange}
		/>
	);
}

/**
 * Wraps a PlaygroundClient to satisfy AsyncWritableFilesystem interface
 * which requires EventTarget methods.
 */
class ClientFilesystemWrapper
	extends EventTarget
	implements AsyncWritableFilesystem
{
	private client: PlaygroundClient;

	constructor(client: PlaygroundClient) {
		super();
		this.client = client;
	}
	isDir(path: string) {
		return this.client.isDir(path);
	}
	fileExists(path: string) {
		return this.client.fileExists(path);
	}
	async read(path: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
		const buffer = await this.client.readFileAsBuffer(path);
		return {
			arrayBuffer: async () => buffer.buffer as ArrayBuffer,
		};
	}
	readFileAsText(path: string) {
		return this.client.readFileAsText(path);
	}
	listFiles(path: string) {
		return this.client.listFiles(path);
	}
	writeFile(path: string, data: string | Uint8Array) {
		return this.client.writeFile(path, data);
	}
	mkdir(path: string) {
		return this.client.mkdir(path);
	}
	rmdir(path: string, options?: { recursive?: boolean }) {
		return this.client.rmdir(path, options);
	}
	mv(source: string, destination: string) {
		return this.client.mv(source, destination);
	}
	unlink(path: string) {
		return this.client.unlink(path);
	}
}

/**
 * Hook that provides a filesystem for the file browser.
 * Prefers the PlaygroundClient when available, but falls back to direct OPFS
 * access when the client is unavailable (e.g., when Playground crashed).
 */
function useFilesystem(
	client: PlaygroundClient | null,
	site: SiteInfo
): AsyncWritableFilesystem | null {
	const [opfsFilesystem, setOpfsFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);

	useEffect(() => {
		// If we have a client, we don't need direct OPFS access
		if (client) {
			setOpfsFilesystem(null);
			return;
		}

		// If site uses OPFS storage and no client is available, access OPFS directly.
		// This allows file browsing/editing even when Playground crashed.
		if (site.metadata.storage === 'opfs') {
			let cancelled = false;
			const opfsPath = getDirectoryPathForSlug(site.slug);
			OpfsFilesystemBackend.fromPath(opfsPath)
				.then((backend) => {
					if (cancelled) return;
					setOpfsFilesystem(new EventedFilesystem(backend));
				})
				.catch((err) => {
					if (cancelled) return;
					logger.error('Failed to access OPFS directly:', err);
					setOpfsFilesystem(null);
				});
			return () => {
				cancelled = true;
			};
		} else {
			setOpfsFilesystem(null);
		}
	}, [client, site.slug, site.metadata.storage]);

	return useMemo(() => {
		// Prefer client-based filesystem when available
		if (client) {
			return new ClientFilesystemWrapper(client);
		}
		// Fall back to direct OPFS access
		return opfsFilesystem;
	}, [client, opfsFilesystem]);
}
