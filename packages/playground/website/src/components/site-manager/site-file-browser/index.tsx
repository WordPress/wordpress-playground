import { Icon } from '@wordpress/components';
import { useMemo, useRef, useState } from 'react';
import { logger } from '@php-wasm/logger';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
	type StepDefinition,
} from '@wp-playground/client';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import {
	createGitAuthHeaders,
	isGitHubUrl,
} from '../../../github/git-auth-helpers';
import {
	type PlaygroundDispatch,
	type PlaygroundReduxState,
	useAppDispatch,
} from '../../../lib/state/redux/store';
import {
	selectSiteBySlug,
	updateSiteMetadata,
	type SiteInfo,
} from '../../../lib/state/redux/slice-sites';
import {
	deriveFolderNameFromGitUrl,
	extractGitDirectorySource,
	normalizeGitUrl,
	type ExtractedGitDirectorySource,
} from '../../../lib/state/redux/git-directory-sources';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	PlaygroundFileEditor,
	MountGitDirectoryModal,
	type MountGitDirectorySubmission,
	type PathBadge,
	type PlaygroundFileEditorHandle,
} from '@wp-playground/components';
import { joinPaths } from '@php-wasm/util';
import {
	FILE_BROWSER_INVALID_PATH_NOTICE,
	parseFileBrowserQuery,
	resolveFileBrowserPath,
	shouldUseFileBrowserQuery,
} from '../../../lib/state/url/filebrowser-query';
import type { FileBrowserQuery } from '../../../lib/state/url/filebrowser-query';
import { GitIcon } from './git-icon';
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
	const query = new URL(window.location.href).searchParams;
	const initialTarget = resolveInitialTarget(
		documentRoot,
		shouldUseFileBrowserQuery(query, window.self !== window.top)
			? parseFileBrowserQuery(query)
			: null
	);
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
			// A repository's derived folder name can collide with a plugin
			// or theme that's already installed — refuse to overwrite it
			// rather than silently deleting the existing folder's contents.
			const step: StepDefinition =
				kind === 'plugin'
					? {
							step: 'installPlugin',
							pluginData: resource,
							ifAlreadyInstalled: 'error',
							options: {
								activate: false,
								targetFolderName,
							},
						}
					: {
							step: 'installTheme',
							themeData: resource,
							ifAlreadyInstalled: 'error',
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
				// The files are already on disk at this point — reveal them
				// before reporting that provenance couldn't be recorded.
				await fileEditorRef.current?.refreshPath(parentPath);
				throw new Error(
					'The repository was fetched, but Playground could not determine where it was installed.'
				);
			}

			await dispatch(
				addGitDirectorySource(
					site.slug,
					mountedSource.assetPath,
					mountedSource.source
				)
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
		await dispatch(moveGitDirectorySource(site.slug, oldPath, newPath));
	};

	return (
		<>
			<PlaygroundFileEditor
				ref={fileEditorRef}
				filesystem={filesystem}
				documentRoot={documentRoot}
				isVisible={isVisible}
				initialPath={initialTarget.path}
				initialLine={initialTarget.line}
				initialNotice={initialTarget.notice}
				placeholderText="Start this Playground to browse and edit its files."
				dockPresentation
				mobileHeaderTarget={mobileHeaderTarget}
				pathBadges={pathBadges}
				onMountFromGit={(kind, parentPath) => {
					setMountError(null);
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
		</>
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

function addGitDirectorySource(
	slug: string,
	path: string,
	source: ExtractedGitDirectorySource['source']
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		await enqueueGitDirectorySourceUpdate(slug, async () => {
			const site = selectSiteBySlug(getState(), slug);
			if (!site) {
				throw new Error(`Site not found: ${slug}`);
			}
			await dispatch(
				updateSiteMetadata({
					slug,
					changes: {
						gitDirectorySources: {
							...site.metadata.gitDirectorySources,
							[path]: source,
						},
					},
				})
			);
		});
	};
}

function moveGitDirectorySource(
	slug: string,
	oldPath: string,
	newPath: string
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		await enqueueGitDirectorySourceUpdate(slug, async () => {
			const site = selectSiteBySlug(getState(), slug);
			const source = site?.metadata.gitDirectorySources?.[oldPath];
			if (!source) {
				return;
			}
			const gitDirectorySources = {
				...site.metadata.gitDirectorySources,
			};
			delete gitDirectorySources[oldPath];
			gitDirectorySources[newPath] = source;
			await dispatch(
				updateSiteMetadata({
					slug,
					changes: { gitDirectorySources },
				})
			);
		});
	};
}

const gitDirectorySourceUpdateQueues = new Map<string, Promise<void>>();

async function enqueueGitDirectorySourceUpdate(
	slug: string,
	update: () => Promise<void>
): Promise<void> {
	const previousUpdate = gitDirectorySourceUpdateQueues.get(slug);
	const currentUpdate = (previousUpdate ?? Promise.resolve())
		.catch(() => undefined)
		.then(update);
	gitDirectorySourceUpdateQueues.set(slug, currentUpdate);
	try {
		await currentUpdate;
	} finally {
		if (gitDirectorySourceUpdateQueues.get(slug) === currentUpdate) {
			gitDirectorySourceUpdateQueues.delete(slug);
		}
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
			// `refType` is only known when the Blueprint step declared it
			// explicitly — the "Mount via git…" form accepts a branch, tag,
			// or commit in one free-text field and never sets it. Falling
			// back to "branch" here would mislabel a tag or commit, so show
			// the bare ref instead when the type isn't actually known.
			const refLabel = source.refType
				? `${source.refType} ${source.ref}`
				: source.ref;
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
