import { useMemo } from 'react';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import { PlaygroundFileEditor } from '@wp-playground/components';
import { joinPaths } from '@php-wasm/util';
import { isLocalDirectoryPhpApp } from '../../../lib/local-directory-site';

/**
 * Browses from `filesystemRoot` while opening the conventional initial file inside
 * the PHP document root. For local projects, using the mount root exposes files
 * such as `vendor/` that intentionally sit outside a public document root.
 */
export function SiteFileBrowser({
	site,
	isVisible = true,
	documentRoot,
	filesystemRoot,
	mobileHeaderTarget,
}: {
	site: SiteInfo;
	isVisible?: boolean;
	documentRoot: string;
	filesystemRoot: string;
	mobileHeaderTarget?: Element | null;
}) {
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client);

	return (
		<PlaygroundFileEditor
			filesystem={filesystem}
			documentRoot={filesystemRoot}
			isVisible={isVisible}
			initialPath={joinPaths(
				documentRoot,
				isLocalDirectoryPhpApp(
					site.metadata.localDirectoryBootConfiguration
				)
					? 'index.php'
					: 'wp-config.php'
			)}
			placeholderText="Start this Playground to browse and edit its files."
			dockPresentation
			mobileHeaderTarget={mobileHeaderTarget}
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
