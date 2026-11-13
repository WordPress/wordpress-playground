import { getOverlaySection } from '../../../components/dock/tool-registry';
import { BREAKPOINTS } from '../../constants/breakpoints';
import type { InitialDockState } from '../redux/slice-ui';
import { shouldUseFileBrowserQuery } from './filebrowser-query';
import { isSiteSavingDisabled } from './router';

export function getInitialDockState(url: URL): InitialDockState {
	const query = url.searchParams;
	if (query.get('mode') === 'seamless') {
		return { dockPaneIsOpen: false, dockPaneSection: 'settings' };
	}
	const overlay = query.get('overlay');
	const cloneSiteUrl = query.get('clone-site')?.trim();
	const isEmbeddedInAnIframe = window.self !== window.top;

	const shouldOpenDockPaneByDefault = false;
	const useFileBrowserQuery = shouldUseFileBrowserQuery(
		query,
		isEmbeddedInAnIframe
	);

	const overlaySection =
		overlay === null || (overlay === 'save' && isSiteSavingDisabled(url))
			? undefined
			: getOverlaySection(overlay);
	const requestedSection = cloneSiteUrl
		? 'transfer'
		: useFileBrowserQuery
			? 'files'
			: overlaySection;

	return {
		// Keep the default separate from explicit links. On small screens an open pane
		// covers the site, and embeds should only show a pane when requested.
		dockPaneIsOpen:
			requestedSection !== undefined ||
			(shouldOpenDockPaneByDefault &&
				!isEmbeddedInAnIframe &&
				window.innerWidth >= BREAKPOINTS.tablet),
		dockPaneSection: requestedSection ?? 'settings',
		cloneRequested:
			requestedSection === 'transfer' ? { url: cloneSiteUrl } : undefined,
	};
}
