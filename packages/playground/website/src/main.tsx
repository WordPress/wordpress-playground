import { createRoot } from 'react-dom/client';
import './styles.css';
import css from './style.module.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { useBootPlayground } from './lib/use-boot-playground';
import { Provider } from 'react-redux';
import { useEffect } from '@wordpress/element';
import store, { useAppSelector } from './lib/redux-store';
import { __experimentalNavigatorProvider as NavigatorProvider } from '@wordpress/components';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';

collectWindowErrors(logger);

function Main() {
	const { slug, storage, originalBlueprint } = useAppSelector(
		(state) => state.activeSite!
	);

	useEffect(() => {
		if (slug && storage !== 'opfs') {
			alert(
				'Site slugs only work with browser storage. The site slug will be ignored.'
			);
		}
	}, [slug, storage]);

	const { playground, url, iframeRef } = useBootPlayground({
		blueprint: originalBlueprint,
	});

	// @TODO: Source query args from the `useSearchParams();` hook,
	//        not from the initial URL.
	return <Layout playground={playground!} url={url!} iframeRef={iframeRef} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<NavigatorProvider initialPath="/" className={css.playgroundNavigator}>
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Main />
			</EnsurePlaygroundSite>
		</Provider>
	</NavigatorProvider>
);
