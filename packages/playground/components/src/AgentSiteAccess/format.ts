import type { AgentSiteRef } from './types';

export function formatAgentSite(
	site: AgentSiteRef,
	peers: AgentSiteRef[] = []
) {
	if (
		site.name &&
		peers.some(
			(other) => other.siteId !== site.siteId && other.name === site.name
		)
	) {
		return `${site.name} (${site.siteId})`;
	}
	return site.name || site.siteId;
}
