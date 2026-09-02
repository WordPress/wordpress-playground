import { Icon } from '@wordpress/components';
import { useMemo } from 'react';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	PlaygroundFileEditor,
	type PathBadge,
} from '@wp-playground/components';
import { GitHubIcon } from '../../../github/github';

export function SiteFileBrowser({
	site,
	isVisible = true,
	documentRoot,
	mobileHeaderTarget,
}: {
	site: SiteInfo;
	isVisible?: boolean;
	documentRoot: string;
	mobileHeaderTarget?: Element | null;
}) {
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client);
	const pathBadges = useGitDirectoryPathBadges(site);

	return (
		<PlaygroundFileEditor
			filesystem={filesystem}
			documentRoot={documentRoot}
			isVisible={isVisible}
			initialPath={`${documentRoot}/wp-config.php`}
			placeholderText="Start this Playground to browse and edit its files."
			dockPresentation
			mobileHeaderTarget={mobileHeaderTarget}
			pathBadges={pathBadges}
		/>
	);
}

/**
 * Builds a "from GitHub" badge for every plugin/theme folder that was
 * installed via a Blueprint's `git:directory` resource.
 */
function useGitDirectoryPathBadges(
	site: SiteInfo
): Record<string, PathBadge> | undefined {
	return useMemo(() => {
		const sources = site.metadata.gitDirectorySources;
		if (!sources || Object.keys(sources).length === 0) {
			return undefined;
		}
		const badges: Record<string, PathBadge> = {};
		for (const [path, source] of Object.entries(sources)) {
			const refLabel =
				source.refType && source.refType !== 'branch'
					? `${source.refType} ${source.ref}`
					: `branch ${source.ref}`;
			const repoLabel = source.url
				.replace(/^https?:\/\//, '')
				.replace(/\.git$/, '');
			badges[path] = {
				icon: <Icon width={14} icon={GitHubIcon} />,
				tooltip: `From GitHub: ${repoLabel} (${refLabel})`,
			};
		}
		return badges;
	}, [site.metadata.gitDirectorySources]);
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
