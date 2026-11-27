import { SiteInteractionNotice } from '@wp-playground/components';
import { useAgentSiteAccess } from '../../lib/agent-site-access';

/** States which site is asking for input while a site tool does so. */
export function SiteInteractionBanner() {
	const { snapshot } = useAgentSiteAccess();
	return snapshot?.interactingSite ? (
		<SiteInteractionNotice site={snapshot.interactingSite} />
	) : null;
}
