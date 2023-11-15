import { createRoot } from 'react-dom/client';
import { DropdownMenu, MenuGroup } from '@wordpress/components';
import { menu } from '@wordpress/icons';
import PlaygroundViewport from './components/playground-viewport';
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

const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const currentConfiguration: PlaygroundConfiguration = {
	wp: blueprint.preferredVersions?.wp || 'latest',
	php: resolveVersion(blueprint.preferredVersions?.php, SupportedPHPVersions),
	storage: storage || 'none',
	withExtensions: blueprint.phpExtensionBundles?.[0] === 'kitchen-sink',
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

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		storage={storage}
		isSeamless={isSeamless}
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
				toggleProps={{
					className: `${buttonCss.button} ${buttonCss.isBrowserChrome}`,
				}}
			>
				{({ onClose }) => (
					<MenuGroup>
						<ResetSiteMenuItem
							storage={currentConfiguration.storage}
							onClose={onClose}
						/>
						<DownloadAsZipMenuItem onClose={onClose} />
						<RestoreFromZipMenuItem onClose={onClose} />
						<GithubImportMenuItem onClose={onClose} />
					</MenuGroup>
				)}
			</DropdownMenu>,
		]}
	>
		<GithubImportModal />
	</PlaygroundViewport>
);

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
