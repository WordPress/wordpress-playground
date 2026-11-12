import { AgentAccessPanel } from '@wp-playground/components';
import type { SiteToolPanelProps } from '../site-manager/site-info-panel/site-tool-renderers';
import { useAgentSiteAccess } from '../../lib/agent-site-access';

/** Dock adapter: agent access covers every site, so site props are unused. */
export function AgentAccessTool(_props: SiteToolPanelProps): JSX.Element {
	const { access, snapshot } = useAgentSiteAccess();
	return <AgentAccessPanel access={access} snapshot={snapshot} />;
}
