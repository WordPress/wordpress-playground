import { Icon } from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
	type StepDefinition,
} from '@wp-playground/client';
import {
	updateSiteMetadata,
	type SiteInfo,
} from '../../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../../lib/state/redux/store';
import {
	deriveFolderNameFromGitUrl,
	extractGitDirectorySource,
	normalizeGitUrl,
} from '../../../lib/state/redux/git-directory-sources';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import {
	type AsyncWritableFilesystem,
	OpfsFilesystemBackend,
	EventedFilesystem,
} from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	PlaygroundFileEditor,
	MountGitDirectoryModal,
	type MountGitDirectorySubmission,
	type PathBadge,
	type PlaygroundFileEditorHandle,
} from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import { getDirectoryPathForSlug } from '../../../lib/state/opfs/opfs-site-storage';
import { GitIcon } from './git-icon';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export function SiteFileBrowser({
	site,
	isVisible = true,
	documentRoot,
}: {
	site: SiteInfo;
	isVisible?: boolean;
	documentRoot: string;
}) {
	const dispatch = useAppDispatch();
	// In dependent mode the client only exposes navigation methods, so we
	// can't use it for filesystem access. Treat it as absent and fall back
	// to direct OPFS access below.
	const clientInfo = usePlaygroundClientInfo(site.slug);
	const client =
		clientInfo && !clientInfo.isDependentMode ? clientInfo.client : null;
	const filesystem = useFilesystem(client, site);
	const pathBadges = useGitDirectoryPathBadges(site);
	const fileEditorRef = useRef<PlaygroundFileEditorHandle | null>(null);
	const [mountRequest, setMountRequest] = useState<{
		kind: 'plugin' | 'theme';
		parentPath: string;
	} | null>(null);
	const [isMounting, setIsMounting] = useState(false);
	const [mountError, setMountError] = useState<string | null>(null);

	const handleMountSubmit = async (
		submission: MountGitDirectorySubmission
	) => {
		if (!client || !mountRequest) {
			return;
		}
		const { kind, parentPath } = mountRequest;
		setIsMounting(true);
		setMountError(null);
		try {
			const url = normalizeGitUrl(submission.url);
			const resource = {
				resource: 'git:directory' as const,
				url,
				ref: submission.ref,
				path: submission.path,
			};
			const targetFolderName = deriveFolderNameFromGitUrl(url);
			const step: StepDefinition =
				kind === 'plugin'
					? {
							step: 'installPlugin',
							pluginData: resource,
							ifAlreadyInstalled: 'error',
							options: { activate: false, targetFolderName },
						}
					: {
							step: 'installTheme',
							themeData: resource,
							ifAlreadyInstalled: 'error',
							options: { activate: false, targetFolderName },
						};

			let extracted: ReturnType<typeof extractGitDirectorySource> = null;
			const compiled = await compileBlueprintV1(
				{ steps: [step] },
				{
					corsProxy: corsProxyUrl,
					onStepCompleted: (result, completedStep) => {
						extracted = extractGitDirectorySource(
							completedStep,
							result
						);
					},
				}
			);
			await runBlueprintV1Steps(compiled, client as any);

			const mountedSource = extracted as ReturnType<
				typeof extractGitDirectorySource
			>;
			if (!mountedSource) {
				await fileEditorRef.current?.refreshPath(parentPath);
				throw new Error(
					'The repository was fetched, but Playground could not determine where it was installed.'
				);
			}
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					metadata: {
						gitDirectorySources: {
							...site.metadata.gitDirectorySources,
							[mountedSource.assetPath]: mountedSource.source,
						},
					},
				})
			);
			await fileEditorRef.current?.revealPath(mountedSource.assetPath);
			setMountRequest(null);
		} catch (error) {
			logger.error('Failed to mount git directory', error);
			setMountError(
				error instanceof Error
					? error.message
					: 'Could not mount the repository.'
			);
		} finally {
			setIsMounting(false);
		}
	};

	const handlePathRenamed = async (oldPath: string, newPath: string) => {
		const source = site.metadata.gitDirectorySources?.[oldPath];
		if (!source) {
			return;
		}
		const gitDirectorySources = { ...site.metadata.gitDirectorySources };
		delete gitDirectorySources[oldPath];
		gitDirectorySources[newPath] = source;
		await dispatch(
			updateSiteMetadata({
				slug: site.slug,
				metadata: { gitDirectorySources },
			})
		);
	};

	return (
		<>
			<PlaygroundFileEditor
				ref={fileEditorRef}
				filesystem={filesystem}
				documentRoot={documentRoot}
				isVisible={isVisible}
				// Nothing is auto-opened: the browser used to greet people with
				// wp-config.php, which put database credentials on screen as the
				// first thing anyone saw here.
				initialPath={null}
				placeholderText="Start this Playground to browse and edit its files."
				pathBadges={pathBadges}
				onMountFromGit={
					client
						? (kind, parentPath) => {
								setMountError(null);
								setMountRequest({ kind, parentPath });
							}
						: undefined
				}
				onPathRenamed={handlePathRenamed}
			/>
			{mountRequest ? (
				<MountGitDirectoryModal
					kind={mountRequest.kind}
					isBusy={isMounting}
					error={mountError}
					onSubmit={handleMountSubmit}
					onCancel={() => setMountRequest(null)}
				/>
			) : null}
		</>
	);
}

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
			const refLabel = source.refType
				? `${source.refType} ${source.ref}`
				: source.ref;
			const repoLabel = source.url
				.replace(/^https?:\/\//, '')
				.replace(/\.git$/, '');
			badges[path] = {
				icon: <Icon width={14} icon={GitIcon} />,
				tooltip: `Mounted from ${repoLabel} (${refLabel})`,
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
