import { createRoot } from 'react-dom/client';
import './styles.css';
import css from './style.module.css';

import { PlaygroundConfiguration } from './components/playground-configuration-group/form';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { resolveBlueprint } from './lib/resolve-blueprint';
import { collectWindowErrors, logger } from '@php-wasm/logger';
import { StorageTypes, StorageType } from './types';
import { useBootPlayground } from './lib/use-boot-playground';
import { Provider } from 'react-redux';
import { useEffect, useState } from '@wordpress/element';
import store from './lib/redux-store';
import { __experimentalNavigatorProvider as NavigatorProvider } from '@wordpress/components';
import { Layout } from './components/layout';
import { EnsurePlaygroundSiteSlug } from './components/ensure-playground-site-slug';
import { useSearchParams } from './lib/router-hooks';

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

const currentConfiguration: PlaygroundConfiguration = {
	wp: blueprint.preferredVersions?.wp || 'latest',
	php: resolveVersion(blueprint.preferredVersions?.php, SupportedPHPVersions),
	storage: storage || 'none',
	withExtensions: blueprint.phpExtensionBundles?.[0] !== 'light',
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

function Main() {
	const [query] = useSearchParams();
	const [siteSlug, setSiteSlug] = useState<string | undefined>(
		query.get('site-slug') ?? undefined
	);

	useEffect(() => {
		if (siteSlug && query.get('storage') !== 'browser') {
			alert(
				'Site slugs only work with browser storage. The site slug will be ignored.'
			);
		}
	}, [siteSlug]);

	const { playground, url, iframeRef } = useBootPlayground({ blueprint });

	// @TODO: Source query args from the `useSearchParams();` hook,
	//        not from the initial URL.
	return (
		<Layout
			playground={playground!}
			url={url!}
			iframeRef={iframeRef}
			blueprint={blueprint}
			storage={storage}
			currentConfiguration={currentConfiguration}
			siteSlug={siteSlug}
			setSiteSlug={setSiteSlug}
		/>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<NavigatorProvider initialPath="/" className={css.playgroundNavigator}>
		<Provider store={store}>
			<EnsurePlaygroundSiteSlug>
				<Main />
			</EnsurePlaygroundSiteSlug>
		</Provider>
	</NavigatorProvider>
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
