/**
 * The shapes these components render. They mirror `@wp-playground/mcp`'s
 * site access types structurally, so this package does not depend on it.
 */
export interface AgentSiteRef {
	siteId: string;
	name?: string;
}

export type AgentSiteAccessDecision =
	| 'allow'
	| 'allow-revoke-others'
	| 'allow-cross-site'
	| 'deny';

export interface AgentSiteAccessRequest {
	site: AgentSiteRef;
	earlierSites: AgentSiteRef[];
	sitesWithAccess: AgentSiteRef[];
	reason?: string;
}

export interface AgentSiteAccessSnapshot {
	grants: Array<{
		grantId: string;
		site: AgentSiteRef;
		inThisTab: boolean;
		expiresAt: number;
		crossSiteWith: AgentSiteRef[];
	}>;
	earlierSites: Array<AgentSiteRef & { lastUsedAt: number }>;
	calls: Array<{ at: number; siteId: string; tool: string; summary: string }>;
	interactingSite?: AgentSiteRef;
	error?: string;
}

export interface AgentSiteAccessActions {
	revoke(grantId: string): Promise<void>;
	endSession(): Promise<void>;
}
