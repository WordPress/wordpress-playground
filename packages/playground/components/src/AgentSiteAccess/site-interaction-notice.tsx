import { Notice } from '@wordpress/components';
import type { AgentSiteRef } from './types';
import { formatAgentSite } from './format';
import css from './style.module.css';

/**
 * Shown while a site tool asks the user for input on an agent's behalf. The
 * prompt itself is drawn by the site, so this states who is asking.
 */
export function SiteInteractionNotice({ site }: { site: AgentSiteRef }) {
	return (
		<div className={css.interactionBanner} role="status">
			<Notice status="warning" isDismissible={false}>
				The WordPress site {formatAgentSite(site)} is asking for your
				input for an AI agent. This request comes from the site, not
				from Playground.
			</Notice>
		</div>
	);
}
