import { useCallback, useMemo, useRef } from 'react';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import { PlaygroundFileEditor } from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import {
	FILE_BROWSER_INVALID_PATH_NOTICE,
	resolveFileBrowserPath,
} from '../../../lib/state/url/filebrowser-query';
import type { FileBrowserQuery } from '../../../lib/state/url/filebrowser-query';

export function SiteFileBrowser({
	site,
	isVisible = true,
	documentRoot,
	fileBrowserQuery = null,
}: {
	site: SiteInfo;
	isVisible?: boolean;
	documentRoot: string;
	fileBrowserQuery?: FileBrowserQuery | null;
}) {
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client);
	const clientRef = useRef<PlaygroundClient | null>(client);
	const initialTarget = resolveInitialTarget(documentRoot, fileBrowserQuery);

	// Keep clientRef in sync
	clientRef.current = client;

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

	// Custom save handler that writes directly to the client
	const handleSaveFile = useCallback(
		async (path: string, content: string) => {
			if (!clientRef.current) {
				throw new Error('No client available');
			}
			await clientRef.current.writeFile(path, content);
		},
		[]
	);

	return (
		<PlaygroundFileEditor
			filesystem={filesystem}
			documentRoot={documentRoot}
			isVisible={isVisible}
			initialPath={initialTarget.path}
			initialLine={initialTarget.line}
			initialNotice={initialTarget.notice}
			placeholderText="Start this Playground to browse and edit its files."
			onSaveFile={handleSaveFile}
			onBeforeFilesystemChange={handleBeforeFilesystemChange}
		/>
	);
}

/**
 * Resolves the file browser startup target from the `filebrowser` URL query.
 *
 * Invalid query values are returned as notices so the editor can show feedback
 * without falling back to the default `wp-config.php` file.
 */
function resolveInitialTarget(
	documentRoot: string,
	fileBrowserQuery: FileBrowserQuery | null
) {
	if (!fileBrowserQuery?.isRequested) {
		return {
			path: joinPaths(documentRoot, 'wp-config.php'),
			line: null,
			notice: null,
		};
	}
	if (fileBrowserQuery.error) {
		return {
			path: null,
			line: null,
			notice: fileBrowserQuery.error,
		};
	}
	if (!fileBrowserQuery.path) {
		return {
			path: null,
			line: null,
			notice: null,
		};
	}

	const resolvedPath = resolveFileBrowserPath(
		documentRoot,
		fileBrowserQuery.path
	);
	if (!resolvedPath) {
		return {
			path: null,
			line: null,
			notice: FILE_BROWSER_INVALID_PATH_NOTICE,
		};
	}
	return {
		path: resolvedPath,
		line: fileBrowserQuery.line,
		notice: null,
	};
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

function useFilesystem(
	client: PlaygroundClient | null
): AsyncWritableFilesystem | null {
	return useMemo(() => {
		if (!client) {
			return null;
		}
		return new ClientFilesystemWrapper(client);
	}, [client]);
}
