import type { AgentSiteRef } from './types';

export function formatAgentSite(site: AgentSiteRef) {
	return site.name ? `${site.name} (${site.siteId})` : site.siteId;
}

export function formatAgentSites(sites: AgentSiteRef[]) {
	return sites.map(formatAgentSite).join(', ');
}
