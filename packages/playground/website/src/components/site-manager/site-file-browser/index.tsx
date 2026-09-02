import { Icon, Notice } from '@wordpress/components';
import { useMemo, useRef, useState } from 'react';
import { logger } from '@php-wasm/logger';
import { basename } from '@php-wasm/util';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
	type StepDefinition,
} from '@wp-playground/client';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { createGitAuthHeaders } from '../../../github/git-auth-helpers';
import { useAppDispatch } from '../../../lib/state/redux/store';
import {
	updateSiteMetadata,
	type SiteInfo,
	type SiteMetadataChanges,
} from '../../../lib/state/redux/slice-sites';
import {
	appendGitDirectoryStepToOriginalBlueprint,
	deriveFolderNameFromGitUrl,
	extractGitDirectorySource,
	normalizeGitUrl,
	patchGitDirectoryStepFolderName,
	type ExtractedGitDirectorySource,
} from '../../../lib/state/redux/git-directory-sources';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	PlaygroundFileEditor,
	type PathBadge,
	type PlaygroundFileEditorHandle,
} from '@wp-playground/components';
import { GitIcon } from './git-icon';
import { GitHubIcon } from '../../../github/github';
import {
	MountGitDirectoryModal,
	type MountGitDirectorySubmission,
} from './mount-git-directory-modal';

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
	const dispatch = useAppDispatch();
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client);
	const pathBadges = useGitDirectoryPathBadges(site);
	const fileEditorRef = useRef<PlaygroundFileEditorHandle | null>(null);
	const [mountRequest, setMountRequest] = useState<{
		kind: 'plugin' | 'theme';
		parentPath: string;
	} | null>(null);
	const [isMounting, setIsMounting] = useState(false);
	const [mountError, setMountError] = useState<string | null>(null);
	const [blueprintNotice, setBlueprintNotice] = useState<string | null>(null);

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
							options: {
								activate: false,
								targetFolderName,
							},
						}
					: {
							step: 'installTheme',
							themeData: resource,
							options: {
								activate: false,
								targetFolderName,
							},
						};

			let extracted: ExtractedGitDirectorySource | null = null;
			const compiled = await compileBlueprintV1(
				{ steps: [step] },
				{
					corsProxy: corsProxyUrl,
					gitAdditionalHeadersCallback: createGitAuthHeaders(),
					onStepCompleted: (result, completedStep) => {
						extracted = extractGitDirectorySource(
							completedStep,
							result
						);
					},
				}
			);
			await runBlueprintV1Steps(compiled, client as any);

			// Read through a fresh binding cast to the full union: TS can't
			// track a `let` reassigned from inside the `onStepCompleted`
			// closure above as narrowable at this point.
			const mountedSource =
				extracted as ExtractedGitDirectorySource | null;
			if (!mountedSource) {
				throw new Error(
					'The repository was fetched, but Playground could not determine where it was installed.'
				);
			}

			const appended = await appendGitDirectoryStepToOriginalBlueprint(
				site.metadata.originalBlueprint,
				step
			);

			const changes: SiteMetadataChanges = {
				gitDirectorySources: {
					...site.metadata.gitDirectorySources,
					[mountedSource.assetPath]: {
						...mountedSource.source,
						...(appended
							? { blueprintStepIndex: appended.stepIndex }
							: {}),
					},
				},
			};
			if (appended) {
				changes.originalBlueprint = appended.updated;
			} else {
				setBlueprintNotice(
					`${targetFolderName} was mounted, but this Playground's Blueprint bundles local files, so it couldn't be updated automatically. Add an "${step.step}" step for ${url} yourself if you want it reflected there.`
				);
			}
			await dispatch(updateSiteMetadata({ slug: site.slug, changes }));

			// The folder was written directly through the live PlaygroundClient,
			// bypassing the tree's own filesystem calls, so its cached listing
			// of `parentPath` is now stale — refresh it to reveal the new folder.
			await fileEditorRef.current?.refreshPath(parentPath);

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
		const newGitDirectorySources = {
			...site.metadata.gitDirectorySources,
		};
		delete newGitDirectorySources[oldPath];
		newGitDirectorySources[newPath] = source;

		const changes: SiteMetadataChanges = {
			gitDirectorySources: newGitDirectorySources,
		};
		if (source.blueprintStepIndex !== undefined) {
			const patched = await patchGitDirectoryStepFolderName(
				site.metadata.originalBlueprint,
				source.blueprintStepIndex,
				basename(newPath)
			);
			if (patched) {
				changes.originalBlueprint = patched;
			} else {
				setBlueprintNotice(
					`${basename(newPath)} was renamed, but this Playground's Blueprint could no longer be updated to match — its step still uses the old folder name.`
				);
			}
		}
		await dispatch(updateSiteMetadata({ slug: site.slug, changes }));
	};

	return (
		<div style={{ position: 'relative', height: '100%' }}>
			{blueprintNotice ? (
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						zIndex: 10,
					}}
				>
					<Notice
						status="warning"
						onRemove={() => setBlueprintNotice(null)}
					>
						{blueprintNotice}
					</Notice>
				</div>
			) : null}
			<PlaygroundFileEditor
				ref={fileEditorRef}
				filesystem={filesystem}
				documentRoot={documentRoot}
				isVisible={isVisible}
				initialPath={`${documentRoot}/wp-config.php`}
				placeholderText="Start this Playground to browse and edit its files."
				dockPresentation
				mobileHeaderTarget={mobileHeaderTarget}
				pathBadges={pathBadges}
				onMountFromGit={(kind, parentPath) => {
					setMountError(null);
					setBlueprintNotice(null);
					setMountRequest({ kind, parentPath });
				}}
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
		</div>
	);
}

/**
 * Whether a git remote URL points at github.com, to show the recognizable
 * GitHub mark instead of the generic git icon.
 */
function isGitHubUrl(url: string): boolean {
	try {
		const { hostname } = new URL(url);
		return hostname === 'github.com' || hostname === 'www.github.com';
	} catch {
		return false;
	}
}

/**
 * Builds a "mounted from a git repository" badge for every plugin/theme
 * folder that was installed via a Blueprint's `git:directory` resource.
 * Host-agnostic (GitHub, GitLab, Bitbucket, ...) since `git:directory`
 * works with any git remote — a GitHub URL gets the recognizable GitHub
 * mark, anything else gets a generic git icon.
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
				icon: (
					<Icon
						width={14}
						icon={isGitHubUrl(source.url) ? GitHubIcon : GitIcon}
					/>
				),
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
