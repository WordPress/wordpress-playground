import { createRoot } from 'react-dom/client';
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { menu, external } from '@wordpress/icons';
import PlaygroundViewport, {
	DisplayMode,
	supportedDisplayModes,
} from './components/playground-viewport';
import css from './style.module.css';
import buttonCss from './components/button/style.module.css';
import './styles.css';

import PlaygroundConfigurationGroup from './components/playground-configuration-group';
import { PlaygroundConfiguration } from './components/playground-configuration-group/form';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { StorageType, StorageTypes } from './types';
import { ResetSiteMenuItem } from './components/toolbar-buttons/reset-site';
import { DownloadAsZipMenuItem } from './components/toolbar-buttons/download-as-zip';
import { RestoreFromZipMenuItem } from './components/toolbar-buttons/restore-from-zip';
import { resolveBlueprint } from './lib/resolve-blueprint';
import { GithubImportMenuItem } from './components/toolbar-buttons/github-import-menu-item';
import { acquireOAuthTokenIfNeeded } from './github/acquire-oauth-token-if-needed';
import { GithubImportModal } from './github/github-import-form';
import { GithubExportMenuItem } from './components/toolbar-buttons/github-export-menu-item';
import { GithubExportModal } from './github/github-export-form';
import { useState } from 'react';
import { ExportFormValues } from './github/github-export-form/form';
import { joinPaths } from '@php-wasm/util';
import { PlaygroundContext } from './playground-context';
import { collectWindowErrors, logger } from '@php-wasm/logger';

collectWindowErrors(logger);

const query = new URL(document.location.href).searchParams;
const blueprint = await resolveBlueprint();

// @ts-ignore
const opfsSupported = typeof navigator?.storage?.getDirectory !== 'undefined';
let storageRaw = query.get('storage');
if (StorageTypes.includes(storageRaw as any) && !opfsSupported) {
	storageRaw = 'none';
} else if (!StorageTypes.includes(storageRaw as any)) {
	storageRaw = 'none';
}
const storage = storageRaw as StorageType;

const displayMode: DisplayMode = supportedDisplayModes.includes(
	query.get('mode') as any
)
	? (query.get('mode') as DisplayMode)
	: 'browser-full-screen';

const currentConfiguration: PlaygroundConfiguration = {
	wp: blueprint.preferredVersions?.wp || 'latest',
	php: resolveVersion(blueprint.preferredVersions?.php, SupportedPHPVersions),
	storage: storage || 'none',
	withExtensions: blueprint.phpExtensionBundles?.[0] === 'kitchen-sink',
	withNetworking: blueprint.features?.networking || false,
	resetSite: false,
};

/*
 * The 6.3 release includes a caching bug where
 * registered styles aren't enqueued when they
 * should be. This isn't present in all environments
 * but it does here in the Playground. For now,
 * the fix is to define `WP_DEVELOPMENT_MODE = all`
 * to bypass the style cache.
 *
 * @see https://core.trac.wordpress.org/ticket/59056
 */
if (currentConfiguration.wp === '6.3') {
	blueprint.steps?.unshift({
		step: 'defineWpConfigConsts',
		consts: {
			WP_DEVELOPMENT_MODE: 'all',
		},
	});
}

acquireOAuthTokenIfNeeded();

function Main() {
	const [githubExportFiles, setGithubExportFiles] = useState<any[]>();
	const [githubExportValues, setGithubExportValues] = useState<
		Partial<ExportFormValues>
	>({});

	return (
		<PlaygroundContext.Provider value={{ storage }}>
			<PlaygroundViewport
				storage={storage}
				displayMode={displayMode}
				blueprint={blueprint}
				toolbarButtons={[
					<PlaygroundConfigurationGroup
						key="configuration"
						initialConfiguration={currentConfiguration}
					/>,
					<DropdownMenu
						key="menu"
						icon={menu}
						label="Additional actions"
						className={css.dropdownMenu}
						toggleProps={
							{
								className: `${buttonCss.button} ${buttonCss.isBrowserChrome}`,
								'data-cy': 'dropdown-menu',
							} as any
						}
					>
						{({ onClose }) => (
							<>
								<MenuGroup>
									<ResetSiteMenuItem
										storage={currentConfiguration.storage}
										onClose={onClose}
									/>
									<DownloadAsZipMenuItem onClose={onClose} />
									<RestoreFromZipMenuItem onClose={onClose} />
									<GithubImportMenuItem onClose={onClose} />
									<GithubExportMenuItem onClose={onClose} />
								</MenuGroup>
								<MenuGroup label="More resources">
									<MenuItem
										icon={external}
										iconPosition="left"
										aria-label="Go to WordPress PR previewer"
										href={
											joinPaths(
												document.location.pathname,
												'wordpress.html'
											) as any
										}
										target="_blank"
									>
										Preview WordPress Pull Request
									</MenuItem>
									<MenuItem
										icon={external}
										iconPosition="left"
										aria-label="Go to a list of Playground demos"
										href={
											joinPaths(
												document.location.pathname,
												'demos/index.html'
											) as any
										}
										target="_blank"
									>
										More demos
									</MenuItem>
									<MenuItem
										icon={external}
										iconPosition="left"
										aria-label="Go to Playground documentation"
										href={
											'https://wordpress.github.io/wordpress-playground/' as any
										}
										target="_blank"
									>
										Documentation
									</MenuItem>
								</MenuGroup>
							</>
						)}
					</DropdownMenu>,
				]}
			>
				<GithubImportModal
					onImported={({
						url,
						path,
						files,
						pluginOrThemeName,
						contentType,
						urlInformation: { owner, repo, type, pr },
					}) => {
						setGithubExportValues({
							repoUrl: url,
							prNumber: pr?.toString(),
							pathInRepo: path,
							prAction: pr ? 'update' : 'create',
							contentType,
							plugin: pluginOrThemeName,
							theme: pluginOrThemeName,
						});
						setGithubExportFiles(files);
					}}
				/>
				<GithubExportModal
					initialValues={githubExportValues}
					initialFilesBeforeChanges={githubExportFiles}
					onExported={(prUrl, formValues) => {
						setGithubExportValues(formValues);
						setGithubExportFiles(undefined);
					}}
				/>
			</PlaygroundViewport>
		</PlaygroundContext.Provider>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(<Main />);

function resolveVersion<T>(
	version: string | undefined,
	allVersions: readonly T[],
	defaultVersion: T = allVersions[0]
): T {
	if (
		!version ||
		!allVersions.includes(version as any) ||
		version === 'latest'
	) {
		return defaultVersion;
	}
	return version as T;
}
